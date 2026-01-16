import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

/**
 * CoinHub Auth Routes
 *
 * SIGNUP FLOW (2-step process):
 *
 * Step 1: Account Creation (Better Auth handles this)
 *   POST /api/auth/sign-up/email
 *   Body: { email, password, name }
 *   Returns: authenticated session with user object
 *
 * Step 2: CoinHub Profile Completion (custom endpoint below)
 *   POST /api/auth/complete-profile (requires authentication)
 *   Body: { username, displayName, inviteCode? }
 *   Returns: full CoinHub user profile
 *
 * The complete-profile endpoint:
 *   - Validates the invite code (if provided)
 *   - Increments invite code usage count
 *   - Creates or updates the user entry in the CoinHub users table
 *   - Returns the completed profile
 */

const ValidateInviteSchema = z.object({
  inviteCode: z.string().min(1),
});

const CompleteProfileSchema = z.object({
  username: z.string().min(3).max(30),
  displayName: z.string().min(1).max(100),
  inviteCode: z.string().min(1).optional(),
  bio: z.string().max(500).optional(),
  location: z.string().max(100).optional(),
  avatarUrl: z.string().optional(),
});

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  collectionPrivacy: z.enum(['public', 'private']).optional(),
});

const RequestPasswordResetSchema = z.object({
  email: z.string().email('Invalid email address'),
});

const ResetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

const UsernameEmailSignInSchema = z.object({
  identifier: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
  rememberMe: z.boolean().optional(),
});

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/auth/health
   * Health check endpoint to verify authentication system is running
   */
  app.fastify.get('/api/auth/health', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Auth health check requested');
    try {
      // Test database connection by checking if auth user table exists
      const testUser = await app.db.query.user.findMany({ limit: 1 });
      app.logger.info({ userCount: testUser.length }, 'Auth health check passed');
      return { status: 'healthy', timestamp: new Date().toISOString() };
    } catch (error) {
      app.logger.error({ err: error }, 'Auth health check failed - database connectivity issue');
      return reply.status(503).send({
        status: 'unhealthy',
        error: 'Database connectivity issue',
        timestamp: new Date().toISOString(),
      });
    }
  });

  /**
   * GET /api/auth/debug/users
   * DEBUG ENDPOINT - List all users in auth database to diagnose sign-up/sign-in issues
   * Shows email addresses and verification status
   * REMOVE IN PRODUCTION
   */
  app.fastify.get('/api/auth/debug/users', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.warn('DEBUG: Listing all users - this endpoint should be disabled in production');
    try {
      const users = await app.db.query.user.findMany();
      app.logger.info({ count: users.length }, 'DEBUG: Retrieved users for debugging');
      return {
        count: users.length,
        users: users.map(u => ({
          id: u.id,
          email: u.email,
          emailLowercase: String(u.email).toLowerCase(),
          name: u.name,
          emailVerified: u.emailVerified,
          createdAt: u.createdAt
        }))
      };
    } catch (error) {
      app.logger.error({ err: error }, 'DEBUG: Failed to list users');
      return reply.status(500).send({ error: 'Failed to list users' });
    }
  });

  /**
   * GET /api/auth/debug/check-email/:email
   * DEBUG ENDPOINT - Check if an email exists in the database
   * Shows exact matching and case-insensitive matching
   * REMOVE IN PRODUCTION
   */
  app.fastify.get('/api/auth/debug/check-email/:email', async (request: FastifyRequest, reply: FastifyReply) => {
    const email = String((request.params as any).email);
    app.logger.warn({ email }, 'DEBUG: Checking email existence - this endpoint should be disabled in production');
    try {
      // Exact match
      const exactMatch = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email)
      });

      // Case-insensitive match using lowercase
      const allUsers = await app.db.query.user.findMany();
      const caseInsensitiveMatch = allUsers.find(u => String(u.email).toLowerCase() === email.toLowerCase());

      app.logger.info({ email, exactMatch: !!exactMatch, caseInsensitive: !!caseInsensitiveMatch }, 'DEBUG: Email check result');
      return {
        searchEmail: email,
        exactMatch: exactMatch ? { id: exactMatch.id, email: exactMatch.email } : null,
        caseInsensitiveMatch: caseInsensitiveMatch ? { id: caseInsensitiveMatch.id, email: caseInsensitiveMatch.email } : null,
        note: 'If only caseInsensitiveMatch exists, the issue is email case sensitivity'
      };
    } catch (error) {
      app.logger.error({ err: error, email }, 'DEBUG: Failed to check email');
      return reply.status(500).send({ error: 'Failed to check email' });
    }
  });

  /**
   * IMPORTANT: Sign-in and Sign-up endpoints are automatically provided by Better Auth
   *
   * POST /api/auth/sign-in/email
   * - Sign in with email and password
   * - Request body: { email: string, password: string, rememberMe?: boolean }
   * - Returns: { user: { id, email, name, ... }, session: { token, ... } }
   * - Logging is performed by Better Auth framework
   *
   * POST /api/auth/sign-up/email
   * - Register with email and password
   * - Request body: { email: string, password: string, name: string }
   * - Returns: { user: { id, email, name, ... }, session: { token, ... } }
   * - Logging is performed by Better Auth framework
   *
   * These endpoints are reserved and MUST NOT be manually created.
   * The framework automatically handles:
   * - Email validation
   * - Password hashing and validation
   * - Unique email constraint checking
   * - Session creation and management
   * - HTTPOnly secure cookies
   *
   * IMPORTANT: Email Normalization
   * - All emails are normalized to lowercase to prevent case-sensitivity issues
   * - Users signing up as "User@Example.com" can sign in with "user@example.com"
   * - This is handled transparently by Better Auth
   */

  /**
   * POST /api/auth/validate-invite
   * Validate an invite code before registration
   */
  app.fastify.post('/api/auth/validate-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ code: (request.body as any)?.inviteCode }, 'Validating invite code');

    try {
      const body = ValidateInviteSchema.parse(request.body);

      // Validate invite code exists
      try {
        const inviteCode = await app.db.query.inviteCodes.findFirst({
          where: eq(schema.inviteCodes.code, body.inviteCode),
        });

        if (!inviteCode) {
          app.logger.warn({ code: body.inviteCode }, 'Invalid invite code');
          return reply.status(400).send({ error: 'Invalid invite code' });
        }

        // Check if code has expired
        if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
          app.logger.warn({ code: body.inviteCode }, 'Invite code expired');
          return reply.status(400).send({ error: 'Invite code has expired' });
        }

        // Check usage limit
        if (inviteCode.usageLimit && inviteCode.usageCount >= inviteCode.usageLimit) {
          app.logger.warn({ code: body.inviteCode, limit: inviteCode.usageLimit, count: inviteCode.usageCount }, 'Invite code usage limit reached');
          return reply.status(400).send({ error: 'Invite code usage limit reached' });
        }

        app.logger.info({ code: body.inviteCode }, 'Invite code validated successfully');
        return { valid: true, message: 'Invite code is valid' };
      } catch (dbError) {
        app.logger.error({ err: dbError, code: body.inviteCode }, 'Database error during invite validation');
        return reply.status(503).send({ error: 'Database error', message: 'Unable to validate invite code' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error }, 'Invite validation error');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user (protected)
   * Validates session and returns full user profile with signed avatar URL
   * Returns: { user: { id, email, name, ... }, profile: { username, displayName, avatarUrl, ... } }
   * Returns 401 if session is invalid
   */
  app.fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Session validation attempt');

    const session = await requireAuth(request, reply);
    if (!session) {
      app.logger.info('Session validation failed - no active session');
      return;
    }

    app.logger.info({ userId: session.user.id, email: session.user.email }, 'Session validation successful');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      // Generate signed URL for avatar if it exists
      let profileWithAvatar = profile;
      if (profile && profile.avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(profile.avatarUrl);
          profileWithAvatar = { ...profile, avatarUrl: url };
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: session.user.id }, 'Failed to generate avatar signed URL');
          profileWithAvatar = { ...profile, avatarUrl: null };
        }
      }

      app.logger.info(
        { userId: session.user.id, hasProfile: !!profile, username: profile?.username },
        'Current user profile fetched successfully'
      );
      return { user: session.user, profile: profileWithAvatar };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch current user');
      throw error;
    }
  });

  /**
   * POST /api/auth/complete-profile
   * Complete user profile after signup (protected)
   * Handles invite code validation and usage increment
   *
   * Request body:
   *   - username (required): 3-30 characters, must be unique
   *   - displayName (required): 1-100 characters
   *   - inviteCode (optional): valid invite code to track signup source
   *   - bio (optional): up to 500 characters
   *   - location (optional): up to 100 characters
   *   - avatarUrl (optional): URL to avatar image
   *
   * Returns: Complete user profile with all CoinHub fields
   * Returns 400 if validation fails, 409 if username already taken, 500 for database errors
   */
  app.fastify.post('/api/auth/complete-profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) {
      app.logger.warn('Profile completion attempted without authentication');
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    const requestBody = request.body as Record<string, any>;
    app.logger.info(
      { userId: session.user.id, email: session.user.email, username: requestBody?.username },
      'Profile completion started'
    );

    try {
      const body = CompleteProfileSchema.parse(requestBody);

      // Check if username is already taken
      // TEMPORARY BETA TESTING: Allow multiple accounts per email with different usernames
      const existingUsername = await app.db.query.users.findFirst({
        where: eq(schema.users.username, body.username),
      });

      if (existingUsername && existingUsername.id !== session.user.id) {
        app.logger.warn({ username: body.username, userId: session.user.id }, 'Username already taken');
        return reply.status(409).send({ error: 'Username already taken' });
      }

      // Validate and process invite code if provided
      let inviteCodeUsed = null;
      if (body.inviteCode) {
        app.logger.info({ userId: session.user.id, code: body.inviteCode }, 'Validating invite code');
        try {
          const inviteCode = await app.db.query.inviteCodes.findFirst({
            where: eq(schema.inviteCodes.code, body.inviteCode.toUpperCase()),
          });

          if (!inviteCode) {
            app.logger.warn({ code: body.inviteCode, userId: session.user.id }, 'Invalid invite code');
            return reply.status(400).send({ error: 'Invalid invite code', message: 'The invite code is not valid' });
          }

          if (!inviteCode.isActive) {
            app.logger.warn({ code: body.inviteCode, userId: session.user.id }, 'Invite code is not active');
            return reply.status(400).send({ error: 'Invite code is not active', message: 'This invite code has been deactivated' });
          }

          if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
            app.logger.warn({ code: body.inviteCode, userId: session.user.id, expiresAt: inviteCode.expiresAt }, 'Invite code has expired');
            return reply.status(400).send({ error: 'Invite code has expired', message: 'This invite code is no longer valid' });
          }

          if (
            inviteCode.usageLimit !== null &&
            inviteCode.usageCount >= inviteCode.usageLimit
          ) {
            app.logger.warn(
              { code: body.inviteCode, userId: session.user.id, limit: inviteCode.usageLimit, count: inviteCode.usageCount },
              'Invite code usage limit reached'
            );
            return reply.status(400).send({ error: 'Invite code usage limit reached', message: 'This invite code has reached its usage limit' });
          }

          // Increment invite code usage
          try {
            await app.db
              .update(schema.inviteCodes)
              .set({ usageCount: inviteCode.usageCount + 1 })
              .where(eq(schema.inviteCodes.id, inviteCode.id));

            inviteCodeUsed = body.inviteCode.toUpperCase();
            app.logger.info(
              { userId: session.user.id, code: body.inviteCode, newCount: inviteCode.usageCount + 1 },
              'Invite code used successfully'
            );
          } catch (updateError) {
            app.logger.error(
              { err: updateError, codeId: inviteCode.id, userId: session.user.id },
              'Failed to increment invite code usage'
            );
            return reply.status(500).send({ error: 'Server error', message: 'Failed to process invite code' });
          }
        } catch (dbError) {
          app.logger.error({ err: dbError, code: body.inviteCode, userId: session.user.id }, 'Database error during invite code processing');
          return reply.status(500).send({ error: 'Server error', message: 'Unable to validate invite code' });
        }
      }

      // Create or update user profile
      let profile;
      try {
        const existingProfile = await app.db.query.users.findFirst({
          where: eq(schema.users.id, session.user.id),
        });

        if (existingProfile) {
          // Update existing profile
          app.logger.info({ userId: session.user.id, username: body.username }, 'Updating existing user profile');
          try {
            const updates: any = {
              username: body.username,
              displayName: body.displayName,
              bio: body.bio || null,
              location: body.location || null,
              avatarUrl: body.avatarUrl || null,
            };

            if (inviteCodeUsed && !existingProfile.inviteCodeUsed) {
              updates.inviteCodeUsed = inviteCodeUsed;
            }

            await app.db
              .update(schema.users)
              .set(updates)
              .where(eq(schema.users.id, session.user.id));

            profile = await app.db.query.users.findFirst({
              where: eq(schema.users.id, session.user.id),
            });
            app.logger.info({ userId: session.user.id, username: body.username }, 'User profile updated successfully');
          } catch (updateError) {
            app.logger.error({ err: updateError, userId: session.user.id, username: body.username }, 'Failed to update user profile');
            return reply.status(500).send({ error: 'Server error', message: 'Failed to update profile' });
          }
        } else {
          // Create new profile - fetch email from Better Auth user table
          app.logger.info({ userId: session.user.id, username: body.username }, 'Creating new user profile');
          let email = '';
          try {
            const authUser = await app.db.query.user.findFirst({
              where: eq(authSchema.user.id, session.user.id),
            });
            email = authUser?.email || '';
            app.logger.info({ userId: session.user.id, email }, 'Fetched auth user email');
          } catch (err) {
            app.logger.warn({ userId: session.user.id, err }, 'Failed to fetch auth user email, using fallback');
            email = session.user.email || '';
          }

          try {
            await app.db.insert(schema.users).values({
              id: session.user.id,
              email: email,
              username: body.username,
              displayName: body.displayName,
              bio: body.bio || null,
              location: body.location || null,
              avatarUrl: body.avatarUrl || null,
              inviteCodeUsed: inviteCodeUsed,
            });

            profile = await app.db.query.users.findFirst({
              where: eq(schema.users.id, session.user.id),
            });
            app.logger.info(
              { userId: session.user.id, username: body.username, email, inviteCodeUsed },
              'User profile created successfully'
            );
          } catch (createError) {
            app.logger.error(
              { err: createError, userId: session.user.id, username: body.username },
              'Failed to create user profile'
            );
            return reply.status(500).send({ error: 'Server error', message: 'Failed to create profile' });
          }
        }
      } catch (profileError) {
        app.logger.error({ err: profileError, userId: session.user.id }, 'Unexpected error during profile creation/update');
        return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
      }

      app.logger.info(
        { userId: session.user.id, username: body.username, inviteCodeUsed, email: profile?.email },
        'Profile completion finished successfully'
      );
      return profile;
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn(
          { error: error.issues, userId: session.user.id, body: requestBody },
          'Profile completion validation error - missing or invalid fields'
        );
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
          message: 'Please provide username and displayName'
        });
      }

      // Check for unique constraint violations
      const errorMsg = String(error);
      if (errorMsg.includes('duplicate key') || errorMsg.includes('unique constraint')) {
        app.logger.warn({ err: error, userId: session.user.id, username: requestBody?.username }, 'Username already taken - unique constraint violation');
        return reply.status(409).send({ error: 'Username already taken' });
      }

      app.logger.error(
        { err: error, userId: session.user.id, username: requestBody?.username, body: requestBody },
        'Failed to complete profile - unexpected error'
      );
      return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
    }
  });

  /**
   * GET /api/auth/check-username/:username
   * Check if a username is available (public endpoint)
   * Used during signup to validate username availability
   *
   * TEMPORARY BETA TESTING: Allow multiple accounts per email with different usernames
   *
   * Response: { available: boolean, username: string }
   */
  app.fastify.get('/api/auth/check-username/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };

    app.logger.info({ username }, 'Checking username availability');

    try {
      const existingUser = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username.toLowerCase()),
      });

      const available = !existingUser;
      app.logger.info({ username, available }, 'Username availability checked');

      return { available, username };
    } catch (error) {
      app.logger.error({ err: error, username }, 'Failed to check username availability');
      return reply.status(500).send({ error: 'Server error', message: 'Failed to check username availability' });
    }
  });

  /**
   * IMPORTANT: Sign-out endpoint is automatically provided by Better Auth
   *
   * POST /api/auth/sign-out
   * - Sign out the current user
   * - Returns: { message: "Signed out successfully" }
   * - Automatically handles:
   *   - Session invalidation
   *   - Cookie clearing
   *   - Security token revocation
   */

  /**
   * PATCH /api/auth/profile
   * Update user profile (protected)
   * Updates CoinHub-specific profile fields
   *
   * Request body: { displayName?: string, bio?: string, location?: string, avatarUrl?: string, collectionPrivacy?: 'public' | 'private' }
   * Returns: Updated user profile object
   * Returns 400 if validation fails, 401 if not authenticated
   */
  app.fastify.patch('/api/auth/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) {
      app.logger.warn('Profile update attempted without authentication');
      return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
    }

    app.logger.info({ userId: session.user.id }, 'Profile update started');

    try {
      const body = UpdateProfileSchema.parse(request.body);

      const updates: any = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.location !== undefined) updates.location = body.location;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
      if (body.collectionPrivacy !== undefined) updates.collectionPrivacy = body.collectionPrivacy;

      // Only update if there are actual changes
      if (Object.keys(updates).length === 0) {
        app.logger.warn({ userId: session.user.id }, 'Profile update with no changes requested');
        return reply.status(400).send({ error: 'No fields to update', message: 'Provide at least one field to update' });
      }

      const profile = await app.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info(
        { userId: session.user.id, updatedFields: Object.keys(updates) },
        'Profile updated successfully'
      );
      return profile[0];
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn(
          { error: error.issues, userId: session.user.id },
          'Profile update validation error'
        );
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
          message: 'Please check the fields and try again'
        });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update profile');
      return reply.status(500).send({ error: 'Server error', message: 'Failed to update profile' });
    }
  });

  /**
   * POST /api/auth/request-password-reset
   * Request a password reset token via email (public endpoint)
   *
   * Request body: { email: string }
   * Returns: { message: "If the email exists, a password reset link has been sent" }
   * Returns 200 regardless of whether the email exists (for security - prevents email enumeration)
   *
   * What happens:
   * 1. User enters their email
   * 2. System checks if email exists in database
   * 3. If yes: Creates a reset token with 1-hour expiration
   * 4. Sends email with reset link (in production)
   * 5. Returns generic success message
   *
   * Log all password reset requests for security auditing
   */
  app.fastify.post('/api/auth/request-password-reset', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestBody = request.body as Record<string, any>;
    const email = requestBody?.email?.toLowerCase?.() || requestBody?.email || '';

    app.logger.info({ email }, 'Password reset request received');

    try {
      const body = RequestPasswordResetSchema.parse(requestBody);
      const normalizedEmail = body.email.toLowerCase();

      // Check if user exists (case-insensitive)
      app.logger.info({ email: normalizedEmail }, 'Looking up user for password reset');
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, normalizedEmail)
      });

      // Always return success message (don't leak whether email exists)
      if (!user) {
        app.logger.warn({ email: normalizedEmail }, 'Password reset requested for non-existent email');
        return {
          message: 'If an account exists with this email, a password reset link will be sent shortly'
        };
      }

      app.logger.info({ userId: user.id, email: normalizedEmail }, 'Password reset token generation started');

      // Generate reset token (random string)
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      try {
        // Store reset token in verification table (Better Auth convention)
        await app.db.insert(authSchema.verification).values({
          id: crypto.randomUUID(),
          identifier: normalizedEmail,
          value: resetToken,
          expiresAt: expiresAt,
        });

        app.logger.info(
          { userId: user.id, email: normalizedEmail, expiresAt },
          'Password reset token generated and stored successfully'
        );

        // Send password reset email
        const frontendUrl = process.env.FRONTEND_URL || 'https://coinhub.app';
        const emailService = (app as any).email;

        if (!emailService) {
          app.logger.error(
            { userId: user.id, email: normalizedEmail },
            'Email service not available - cannot send password reset email'
          );
          return reply.status(500).send({
            error: 'Email service is not available. Please try again later.'
          });
        }

        try {
          const emailResult = await emailService.sendPasswordResetEmail(
            normalizedEmail,
            resetToken,
            frontendUrl
          );

          if (!emailResult.success) {
            app.logger.error(
              { userId: user.id, email: normalizedEmail, error: emailResult.error },
              'Failed to send password reset email - returning error to user'
            );
            return reply.status(500).send({
              error: emailResult.error || 'Failed to send password reset email. Please try again later.'
            });
          }

          app.logger.info(
            { userId: user.id, email: normalizedEmail },
            'Password reset email sent successfully'
          );

          return {
            message: 'Password reset link has been sent to your email address',
            // For development/testing only - remove in production
            ...(process.env.NODE_ENV === 'development' && {
              debug: {
                token: resetToken,
                expiresAt: expiresAt.toISOString(),
                resetLink: `${frontendUrl}/auth?mode=reset&token=${encodeURIComponent(resetToken)}`
              }
            })
          };
        } catch (emailError) {
          app.logger.error(
            { err: emailError, userId: user.id, email: normalizedEmail },
            'Unexpected error sending password reset email'
          );
          return reply.status(500).send({
            error: 'An unexpected error occurred while sending the reset email. Please try again later.'
          });
        }
      } catch (tokenError) {
        app.logger.error(
          { err: tokenError, userId: user.id, email: normalizedEmail },
          'Failed to generate password reset token'
        );
        // Still return success message for security
        return {
          message: 'If an account exists with this email, a password reset link will be sent shortly'
        };
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, email }, 'Password reset request validation error');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
          message: 'Please provide a valid email address'
        });
      }
      app.logger.error({ err: error, email }, 'Password reset request error');
      return reply.status(500).send({
        error: 'Server error',
        message: 'Failed to process password reset request'
      });
    }
  });

  /**
   * POST /api/auth/reset-password
   * Reset password using a reset token (public endpoint)
   *
   * Request body: { token: string, password: string }
   * Returns: { message: "Password reset successfully" }
   * Returns 400 if token is invalid/expired
   * Returns 500 if database error
   *
   * What happens:
   * 1. User submits reset token and new password
   * 2. System validates token exists and hasn't expired
   * 3. System hashes new password
   * 4. System updates user's password in account table
   * 5. System deletes the reset token
   * 6. Returns success message
   *
   * Log all password resets for security auditing
   */
  app.fastify.post('/api/auth/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const requestBody = request.body as Record<string, any>;
    const token = requestBody?.token;

    app.logger.info({ tokenProvided: !!token }, 'Password reset attempt');

    try {
      const body = ResetPasswordSchema.parse(requestBody);

      // Find verification token
      app.logger.info('Looking up password reset token');
      const verification = await app.db.query.verification.findFirst({
        where: eq(authSchema.verification.value, body.token)
      });

      if (!verification) {
        app.logger.warn({ token: body.token }, 'Password reset token not found');
        return reply.status(400).send({
          error: 'Invalid reset token',
          message: 'This password reset link is invalid or has expired'
        });
      }

      // Check if token has expired
      if (new Date(verification.expiresAt) < new Date()) {
        app.logger.warn({ token: body.token, expiresAt: verification.expiresAt }, 'Password reset token has expired');
        // Delete expired token
        try {
          await app.db
            .delete(authSchema.verification)
            .where(eq(authSchema.verification.id, verification.id));
        } catch (deleteErr) {
          app.logger.warn({ err: deleteErr }, 'Failed to delete expired token');
        }
        return reply.status(400).send({
          error: 'Reset link expired',
          message: 'This password reset link has expired. Please request a new one.'
        });
      }

      // Find user by email (identifier)
      const user = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, verification.identifier.toLowerCase())
      });

      if (!user) {
        app.logger.warn({ identifier: verification.identifier }, 'User not found for password reset token');
        return reply.status(400).send({
          error: 'Invalid reset token',
          message: 'This password reset link is invalid'
        });
      }

      app.logger.info({ userId: user.id, email: user.email }, 'Resetting password for user');

      try {
        // Hash the new password using bcrypt (same as Better Auth)
        // Better Auth expects the hash to be stored in account.password with provider_id 'password'
        const bcrypt = await import('bcryptjs') as any;
        const hashedPassword = await bcrypt.hash(body.password, 10);

        // Find or create the password account record
        const passwordAccount = await app.db.query.account.findFirst({
          where: eq(authSchema.account.userId, user.id)
        });

        if (passwordAccount) {
          // Update existing account with new password
          await app.db
            .update(authSchema.account)
            .set({ password: hashedPassword })
            .where(eq(authSchema.account.id, passwordAccount.id));

          app.logger.info({ userId: user.id }, 'Password updated in existing account');
        } else {
          // This shouldn't happen if user did sign up with password
          app.logger.warn({ userId: user.id }, 'No password account found for user, creating one');
          await app.db.insert(authSchema.account).values({
            id: crypto.randomUUID(),
            userId: user.id,
            accountId: `password-${user.id}`,
            providerId: 'password',
            password: hashedPassword,
          });
        }

        // Delete the reset token
        await app.db
          .delete(authSchema.verification)
          .where(eq(authSchema.verification.id, verification.id));

        app.logger.info(
          { userId: user.id, email: user.email },
          'Password reset completed successfully'
        );

        // Invalidate all existing sessions for this user (for security)
        try {
          await app.db
            .delete(authSchema.session)
            .where(eq(authSchema.session.userId, user.id));
          app.logger.info({ userId: user.id }, 'All sessions invalidated after password reset');
        } catch (sessionErr) {
          app.logger.warn({ err: sessionErr, userId: user.id }, 'Failed to invalidate sessions');
        }

        return {
          message: 'Password has been reset successfully. Please sign in with your new password.'
        };
      } catch (hashError) {
        app.logger.error(
          { err: hashError, userId: user.id },
          'Failed to hash new password'
        );
        return reply.status(500).send({
          error: 'Server error',
          message: 'Failed to reset password. Please try again later.'
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Password reset validation error');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
          message: 'Please provide a valid reset token and password'
        });
      }
      app.logger.error({ err: error }, 'Password reset error');
      return reply.status(500).send({
        error: 'Server error',
        message: 'Failed to reset password'
      });
    }
  });

  /**
   * POST /api/auth/sign-in/username-email
   * Sign in with username or email address
   * Allows users to authenticate using either their username or email
   *
   * Request body: { identifier: string (username or email), password: string, rememberMe?: boolean }
   * Returns: { user: { id, email, name, ... }, session: { token, ... } }
   *
   * Security:
   * - Returns generic "Invalid username or password" error for all failures (doesn't reveal if user exists)
   * - Case-insensitive username lookup
   * - Logs all sign-in attempts for security auditing
   */
  app.fastify.post('/api/auth/sign-in/username-email', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ identifier: (request.body as any)?.identifier }, 'Attempting sign-in with username or email');

    try {
      const body = UsernameEmailSignInSchema.parse(request.body);
      const identifier = body.identifier.trim();

      // Determine if identifier is email or username
      const isEmail = identifier.includes('@');
      const email = isEmail ? identifier.toLowerCase() : null;
      const username = !isEmail ? identifier.toLowerCase() : null;

      app.logger.info({ identifier, isEmail, type: isEmail ? 'email' : 'username' }, 'Identifier type determined');

      // Step 1: Find user by username or email
      let coinHubUser;
      let authUser;

      if (isEmail) {
        // Look up by email in both auth user and CoinHub users tables
        try {
          authUser = await app.db.query.user.findFirst({
            where: eq(authSchema.user.email, email),
          });

          if (authUser) {
            coinHubUser = await app.db.query.users.findFirst({
              where: eq(schema.users.id, authUser.id),
              columns: {
                id: true,
                email: true,
                username: true,
                displayName: true,
                avatarUrl: true,
                bio: true,
                location: true,
                collectionPrivacy: true,
                role: true,
                inviteCodeUsed: true,
                createdAt: true,
                updatedAt: true,
              },
            });
          }
        } catch (lookupError) {
          app.logger.error({ err: lookupError, email }, 'Error looking up user by email');
          return reply.status(401).send({ error: 'Invalid username or password' });
        }
      } else {
        // Look up by username in CoinHub users table first
        try {
          coinHubUser = await app.db.query.users.findFirst({
            where: eq(schema.users.username, username),
            columns: {
              id: true,
              email: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              bio: true,
              location: true,
              collectionPrivacy: true,
              role: true,
              inviteCodeUsed: true,
              createdAt: true,
              updatedAt: true,
            },
          });

          if (coinHubUser) {
            // Now get the auth user with the resolved email
            authUser = await app.db.query.user.findFirst({
              where: eq(authSchema.user.id, coinHubUser.id),
            });
          }
        } catch (lookupError) {
          app.logger.error({ err: lookupError, username }, 'Error looking up user by username');
          return reply.status(401).send({ error: 'Invalid username or password' });
        }
      }

      // Step 2: Verify user exists
      if (!authUser || !coinHubUser) {
        app.logger.warn(
          { identifier, identifierType: isEmail ? 'email' : 'username', found: false },
          'Sign-in failed: user not found'
        );
        return reply.status(401).send({ error: 'Invalid username or password' });
      }

      // Step 3: Get account record with credential provider
      let accountRecord;
      try {
        accountRecord = await app.db.query.account.findFirst({
          where: and(
            eq(authSchema.account.userId, authUser.id),
            eq(authSchema.account.providerId, 'credential')
          ),
        });

        if (!accountRecord || !accountRecord.password) {
          app.logger.warn(
            { userId: authUser.id, identifier, identifierType: isEmail ? 'email' : 'username' },
            'Sign-in failed: no credential account found'
          );
          return reply.status(401).send({ error: 'Invalid username or password' });
        }
      } catch (accountError) {
        app.logger.error(
          { err: accountError, userId: authUser.id, identifier },
          'Error looking up credential account'
        );
        return reply.status(500).send({ error: 'Authentication error' });
      }

      // Step 4: Verify password
      try {
        const bcrypt = await import('bcryptjs') as any;
        const passwordMatch = await bcrypt.compare(body.password, accountRecord.password);

        if (!passwordMatch) {
          app.logger.warn(
            { userId: authUser.id, identifier, identifierType: isEmail ? 'email' : 'username' },
            'Sign-in failed: incorrect password'
          );
          return reply.status(401).send({ error: 'Invalid username or password' });
        }
      } catch (bcryptError) {
        app.logger.error(
          { err: bcryptError, userId: authUser.id, identifier },
          'Error comparing passwords'
        );
        return reply.status(500).send({ error: 'Authentication error' });
      }

      // Step 5: Create session
      try {
        const session = await app.db
          .insert(authSchema.session)
          .values({
            id: crypto.randomUUID(),
            userId: authUser.id,
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
            token: crypto.randomUUID(),
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .returning();

        app.logger.info(
          { userId: authUser.id, identifier, identifierType: isEmail ? 'email' : 'username' },
          'Sign-in successful: session created'
        );

        // Set secure HTTP-only cookie using native Fastify header
        const cookieOptions = [
          `session=${session[0].token}`,
          'HttpOnly',
          'Path=/',
          'SameSite=Lax',
          `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
        ];
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        reply.header('Set-Cookie', cookieOptions.join('; '));

        return {
          user: {
            id: coinHubUser.id,
            email: coinHubUser.email,
            username: coinHubUser.username,
            displayName: coinHubUser.displayName,
            avatarUrl: coinHubUser.avatarUrl,
            bio: coinHubUser.bio,
            location: coinHubUser.location,
            collectionPrivacy: coinHubUser.collectionPrivacy,
            role: coinHubUser.role,
            createdAt: coinHubUser.createdAt,
            updatedAt: coinHubUser.updatedAt,
          },
          session: {
            token: session[0].token,
            expiresAt: session[0].expiresAt,
          },
        };
      } catch (sessionError) {
        app.logger.error(
          { err: sessionError, userId: authUser.id, identifier },
          'Failed to create session'
        );
        return reply.status(500).send({ error: 'Failed to create session' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error during username/email sign-in');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error }, 'Unexpected error during username/email sign-in');
      return reply.status(500).send({ error: 'An error occurred during sign-in' });
    }
  });

  /**
   * GET /api/auth/verify-reset-token/:token
   * Verify if a password reset token is valid (public endpoint)
   *
   * Returns: { valid: true, email?: string } or { valid: false, message: string }
   *
   * Use this on the password reset form to validate the token before showing the form
   */
  app.fastify.get('/api/auth/verify-reset-token/:token', async (request: FastifyRequest, reply: FastifyReply) => {
    const token = (request.params as any).token;

    app.logger.info({ token }, 'Verifying password reset token');

    try {
      const verification = await app.db.query.verification.findFirst({
        where: eq(authSchema.verification.value, token)
      });

      if (!verification) {
        app.logger.warn({ token }, 'Reset token not found');
        return {
          valid: false,
          message: 'This password reset link is invalid or has expired'
        };
      }

      // Check if token has expired
      if (new Date(verification.expiresAt) < new Date()) {
        app.logger.warn({ token, expiresAt: verification.expiresAt }, 'Reset token has expired');
        return {
          valid: false,
          message: 'This password reset link has expired'
        };
      }

      app.logger.info({ token }, 'Reset token is valid');
      return {
        valid: true,
        email: verification.identifier
      };
    } catch (error) {
      app.logger.error({ err: error, token }, 'Failed to verify reset token');
      return reply.status(500).send({
        error: 'Server error',
        message: 'Failed to verify reset token'
      });
    }
  });
}
