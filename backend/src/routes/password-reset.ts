import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';

const PasswordResetRequestSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const PasswordResetConfirmSchema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().min(1, 'Reset token is required'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

const FixPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
  newPassword: z.string().min(6, 'Password must be at least 6 characters'),
});

/**
 * Generate a 6-digit numeric token for easy mobile entry
 */
function generateResetToken(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Hash password using bcrypt
 */
async function hashPassword(password: string): Promise<string> {
  const bcrypt = await import('bcryptjs') as any;
  return bcrypt.hash(password, 10);
}

export function registerPasswordResetRoutes(app: App) {
  /**
   * POST /api/password-reset/request
   * Request a password reset token
   *
   * Body: { email: string }
   * Returns: { success: true, token: string, message: string } (for development)
   * Returns: { success: true, message: "If email exists, password reset link has been sent" } (for production)
   *
   * For development, the token is returned in the response.
   * For production, it would be sent via email.
   */
  app.fastify.post('/api/password-reset/request', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string };
    const email = body.email?.toLowerCase().trim();

    app.logger.info({ email }, 'POST /api/password-reset/request - password reset requested');

    try {
      // Validate input
      if (!email) {
        app.logger.warn('POST /api/password-reset/request - missing email');
        return reply.status(400).send({
          error: 'Validation failed',
          details: 'Email is required'
        });
      }

      // Parse and validate
      const parsedEmail = PasswordResetRequestSchema.parse({ email });

      // Find user by email (case-insensitive)
      const authUser = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${parsedEmail.email})`
      });

      // Always return success for security (don't reveal if email exists)
      if (!authUser) {
        app.logger.info({ email: parsedEmail.email }, 'POST /api/password-reset/request - email not found');
        // Return success response without token for security
        return {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent'
        };
      }

      // Generate reset token (6-digit code)
      const resetToken = generateResetToken();
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

      app.logger.info(
        { userId: authUser.id, email: parsedEmail.email, expiresAt },
        'POST /api/password-reset/request - generating reset token'
      );

      // Store token in database
      await app.db
        .insert(schema.passwordResetTokens)
        .values({
          id: randomUUID(),
          userId: authUser.id,
          token: resetToken,
          expiresAt: expiresAt,
          used: false,
          createdAt: new Date()
        });

      app.logger.info(
        { userId: authUser.id, email: parsedEmail.email, tokenLength: resetToken.length },
        'POST /api/password-reset/request - reset token created successfully'
      );

      // For development, return the token. For production, send via email
      const isDevelopment = process.env.NODE_ENV !== 'production';

      if (isDevelopment) {
        app.logger.warn(
          { email: parsedEmail.email, token: resetToken },
          'POST /api/password-reset/request - DEVELOPMENT MODE: returning token in response'
        );
        return {
          success: true,
          token: resetToken,
          message: 'Password reset token generated (development mode). Use this token to reset your password.',
          expiresAt: expiresAt.toISOString()
        };
      } else {
        // In production, just confirm email was sent
        return {
          success: true,
          message: 'If an account exists with this email, a password reset link has been sent'
        };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ err: error }, 'POST /api/password-reset/request - validation failed');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues[0]?.message || 'Validation failed'
        });
      }
      app.logger.error({ err: error }, 'POST /api/password-reset/request - unexpected error');
      return reply.status(500).send({
        error: 'Failed to process password reset request',
        message: String(error)
      });
    }
  });

  /**
   * POST /api/password-reset/confirm
   * Confirm password reset with token and new password
   *
   * Body: { email: string, token: string, newPassword: string }
   * Returns: { success: true, message: "Password reset successfully" }
   * Returns: 400 if token invalid/expired/used
   * Returns: 401 if token doesn't match email
   */
  app.fastify.post('/api/password-reset/confirm', async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as { email?: string; token?: string; newPassword?: string };
    const email = body.email?.toLowerCase().trim();

    app.logger.info({ email, tokenLength: body.token?.length }, 'POST /api/password-reset/confirm - attempting password reset');

    try {
      // Validate input
      const parsed = PasswordResetConfirmSchema.parse({
        email: email || '',
        token: body.token || '',
        newPassword: body.newPassword || ''
      });

      // Find user by email
      const authUser = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${parsed.email})`
      });

      if (!authUser) {
        app.logger.warn({ email: parsed.email }, 'POST /api/password-reset/confirm - user not found');
        return reply.status(401).send({
          error: 'Invalid reset token',
          message: 'This password reset token is invalid or has expired'
        });
      }

      // Find and validate reset token
      const resetToken = await app.db.query.passwordResetTokens.findFirst({
        where: and(
          eq(schema.passwordResetTokens.token, parsed.token),
          eq(schema.passwordResetTokens.userId, authUser.id)
        )
      });

      if (!resetToken) {
        app.logger.warn({ userId: authUser.id, email: parsed.email }, 'POST /api/password-reset/confirm - token not found');
        return reply.status(400).send({
          error: 'Invalid reset token',
          message: 'This password reset token is invalid or has expired'
        });
      }

      // Check if token is already used
      if (resetToken.used) {
        app.logger.warn({ userId: authUser.id, email: parsed.email }, 'POST /api/password-reset/confirm - token already used');
        return reply.status(400).send({
          error: 'Token already used',
          message: 'This password reset token has already been used. Request a new one.'
        });
      }

      // Check if token is expired
      if (new Date(resetToken.expiresAt) < new Date()) {
        app.logger.warn({ userId: authUser.id, email: parsed.email }, 'POST /api/password-reset/confirm - token expired');
        return reply.status(400).send({
          error: 'Token expired',
          message: 'This password reset token has expired. Request a new one.'
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(parsed.newPassword);

      app.logger.info(
        { userId: authUser.id, email: parsed.email },
        'POST /api/password-reset/confirm - hashing new password'
      );

      // Find existing password account
      let account = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, authUser.id),
          eq(authSchema.account.providerId, 'credential')
        )
      });

      if (account) {
        // Update existing password account
        await app.db
          .update(authSchema.account)
          .set({
            password: hashedPassword,
            updatedAt: new Date()
          })
          .where(eq(authSchema.account.id, account.id));

        app.logger.info(
          { userId: authUser.id, email: parsed.email },
          'POST /api/password-reset/confirm - password updated'
        );
      } else {
        // Create new password account (shouldn't normally happen, but handle it)
        await app.db
          .insert(authSchema.account)
          .values({
            id: randomUUID(),
            accountId: randomUUID(),
            providerId: 'credential',
            userId: authUser.id,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
          });

        app.logger.info(
          { userId: authUser.id, email: parsed.email },
          'POST /api/password-reset/confirm - password account created'
        );
      }

      // Mark token as used
      await app.db
        .update(schema.passwordResetTokens)
        .set({ used: true })
        .where(eq(schema.passwordResetTokens.id, resetToken.id));

      app.logger.info(
        { userId: authUser.id, email: parsed.email },
        'POST /api/password-reset/confirm - password reset completed successfully'
      );

      return {
        success: true,
        message: 'Your password has been reset successfully. You can now log in with your new password.'
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ err: error }, 'POST /api/password-reset/confirm - validation failed');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues[0]?.message || 'Validation failed'
        });
      }
      app.logger.error({ err: error }, 'POST /api/password-reset/confirm - unexpected error');
      return reply.status(500).send({
        error: 'Failed to reset password',
        message: String(error)
      });
    }
  });

  /**
   * POST /api/admin/fix-corrupted-password
   * Admin endpoint to directly fix a corrupted password
   * Only available in development mode
   *
   * Body: { email: string, newPassword: string }
   * Returns: { success: true, message: "Password fixed successfully" }
   */
  app.fastify.post('/api/admin/fix-corrupted-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    if (!isDevelopment) {
      app.logger.warn('POST /api/admin/fix-corrupted-password - not available in production');
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'This endpoint is only available in development mode'
      });
    }

    const body = request.body as { email?: string; newPassword?: string };
    const email = body.email?.toLowerCase().trim();

    app.logger.info({ email }, 'POST /api/admin/fix-corrupted-password - fixing corrupted password');

    try {
      // Validate input
      const parsed = FixPasswordSchema.parse({
        email: email || '',
        newPassword: body.newPassword || ''
      });

      // Find user by email
      const authUser = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${parsed.email})`
      });

      if (!authUser) {
        app.logger.warn({ email: parsed.email }, 'POST /api/admin/fix-corrupted-password - user not found');
        return reply.status(404).send({
          error: 'Not found',
          message: 'User with this email does not exist'
        });
      }

      // Hash new password
      const hashedPassword = await hashPassword(parsed.newPassword);

      app.logger.info(
        { userId: authUser.id, email: parsed.email },
        'POST /api/admin/fix-corrupted-password - updating password'
      );

      // Find existing password account
      let account = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, authUser.id),
          eq(authSchema.account.providerId, 'credential')
        )
      });

      if (account) {
        // Update existing password account
        await app.db
          .update(authSchema.account)
          .set({
            password: hashedPassword,
            updatedAt: new Date()
          })
          .where(eq(authSchema.account.id, account.id));

        app.logger.info(
          { userId: authUser.id, email: parsed.email },
          'POST /api/admin/fix-corrupted-password - password updated'
        );
      } else {
        // Create new password account
        await app.db
          .insert(authSchema.account)
          .values({
            id: randomUUID(),
            accountId: randomUUID(),
            providerId: 'credential',
            userId: authUser.id,
            password: hashedPassword,
            createdAt: new Date(),
            updatedAt: new Date()
          });

        app.logger.info(
          { userId: authUser.id, email: parsed.email },
          'POST /api/admin/fix-corrupted-password - password account created'
        );
      }

      return {
        success: true,
        message: `Password fixed successfully for ${parsed.email}`,
        userId: authUser.id
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ err: error }, 'POST /api/admin/fix-corrupted-password - validation failed');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues[0]?.message || 'Validation failed'
        });
      }
      app.logger.error({ err: error }, 'POST /api/admin/fix-corrupted-password - unexpected error');
      return reply.status(500).send({
        error: 'Failed to fix password',
        message: String(error)
      });
    }
  });

  app.logger.info(
    {
      endpoints: [
        'POST /api/password-reset/request',
        'POST /api/password-reset/confirm',
        'POST /api/admin/fix-corrupted-password (development only)'
      ]
    },
    'Password reset routes registered'
  );
}
