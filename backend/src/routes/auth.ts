import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

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

export function registerAuthRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/auth/validate-invite
   * Validate an invite code before registration
   */
  app.fastify.post('/api/auth/validate-invite', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ body: request.body }, 'Validating invite code');

    try {
      const body = ValidateInviteSchema.parse(request.body);

      // Validate invite code exists
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
        app.logger.warn({ code: body.inviteCode }, 'Invite code usage limit reached');
        return reply.status(400).send({ error: 'Invite code usage limit reached' });
      }

      app.logger.info({ code: body.inviteCode }, 'Invite code validated successfully');
      return { valid: true, message: 'Invite code is valid' };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error }, 'Invite validation error');
      throw error;
    }
  });

  /**
   * GET /api/auth/me
   * Get current authenticated user (protected)
   */
  app.fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Fetching current user');

    const session = await requireAuth(request, reply);
    if (!session) return;

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      app.logger.info({ userId: session.user.id }, 'Current user fetched');
      return { user: session.user, profile };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch current user');
      throw error;
    }
  });

  /**
   * POST /api/auth/complete-profile
   * Complete user profile after signup (protected)
   * Handles invite code validation and usage increment
   */
  app.fastify.post('/api/auth/complete-profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Completing user profile');

    try {
      const body = CompleteProfileSchema.parse(request.body);

      // Check if username is already taken
      const existingUsername = await app.db.query.users.findFirst({
        where: eq(schema.users.username, body.username),
      });

      if (existingUsername && existingUsername.id !== session.user.id) {
        app.logger.warn({ username: body.username }, 'Username already taken');
        return reply.status(400).send({ error: 'Username already taken' });
      }

      // Validate and process invite code if provided
      let inviteCodeUsed = null;
      if (body.inviteCode) {
        const inviteCode = await app.db.query.inviteCodes.findFirst({
          where: eq(schema.inviteCodes.code, body.inviteCode.toUpperCase()),
        });

        if (!inviteCode) {
          app.logger.warn({ code: body.inviteCode }, 'Invalid invite code');
          return reply.status(400).send({ error: 'Invalid invite code' });
        }

        if (!inviteCode.isActive) {
          app.logger.warn({ code: body.inviteCode }, 'Invite code is not active');
          return reply.status(400).send({ error: 'Invite code is not active' });
        }

        if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
          app.logger.warn({ code: body.inviteCode }, 'Invite code has expired');
          return reply.status(400).send({ error: 'Invite code has expired' });
        }

        if (
          inviteCode.usageLimit !== null &&
          inviteCode.usageCount >= inviteCode.usageLimit
        ) {
          app.logger.warn({ code: body.inviteCode }, 'Invite code usage limit reached');
          return reply.status(400).send({ error: 'Invite code usage limit reached' });
        }

        // Increment invite code usage
        await app.db
          .update(schema.inviteCodes)
          .set({ usageCount: inviteCode.usageCount + 1 })
          .where(eq(schema.inviteCodes.id, inviteCode.id));

        inviteCodeUsed = body.inviteCode.toUpperCase();
        app.logger.info({ code: body.inviteCode, newCount: inviteCode.usageCount + 1 }, 'Invite code used');
      }

      // Create or update user profile
      const existingProfile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      let profile;

      if (existingProfile) {
        // Update existing profile
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
      } else {
        // Create new profile
        await app.db.insert(schema.users).values({
          id: session.user.id,
          email: session.user.email || '',
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
      }

      app.logger.info(
        { userId: session.user.id, username: body.username, inviteCodeUsed },
        'Profile completed successfully'
      );
      return profile;
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to complete profile');
      throw error;
    }
  });

  /**
   * PATCH /api/auth/profile
   * Update user profile (protected)
   */
  app.fastify.patch('/api/auth/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Updating user profile');

    try {
      const body = UpdateProfileSchema.parse(request.body);

      const updates: any = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.location !== undefined) updates.location = body.location;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
      if (body.collectionPrivacy !== undefined) updates.collectionPrivacy = body.collectionPrivacy;

      const profile = await app.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id }, 'Profile updated successfully');
      return profile[0];
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update profile');
      throw error;
    }
  });
}
