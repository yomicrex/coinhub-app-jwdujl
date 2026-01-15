import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const UpdateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  bio: z.string().max(500).optional().nullable(),
  location: z.string().max(100).optional().nullable(),
  avatarUrl: z.string().optional().nullable(),
  collectionPrivacy: z.enum(['public', 'private']).optional(),
});

const UpdateSettingsSchema = z.object({
  collectionPrivacy: z.enum(['public', 'private']).optional(),
  emailNotifications: z.boolean().optional(),
  marketingEmails: z.boolean().optional(),
});

export function registerProfileRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/users/:username
   * Get public user profile by username
   */
  app.fastify.get('/api/users/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };

    app.logger.info({ username }, 'Fetching user profile');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!profile) {
        app.logger.warn({ username }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId: profile.id, username }, 'User profile fetched');
      return profile;
    } catch (error) {
      app.logger.error({ err: error, username }, 'Failed to fetch user profile');
      throw error;
    }
  });

  /**
   * PATCH /api/profiles/me
   * Update current user profile (protected)
   */
  app.fastify.patch('/api/profiles/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Updating user profile');

    try {
      const body = UpdateProfileSchema.parse(request.body);

      const updates: any = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.location !== undefined) updates.location = body.location;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
      if (body.collectionPrivacy !== undefined) updates.collectionPrivacy = body.collectionPrivacy;

      const updated = await app.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, session.user.id))
        .returning();

      app.logger.info({ userId: session.user.id }, 'User profile updated successfully');
      return updated[0];
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update user profile');
      throw error;
    }
  });

  /**
   * GET /api/profiles/me
   * Get current user's profile (protected)
   */
  app.fastify.get('/api/profiles/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching current user profile');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      if (!profile) {
        app.logger.warn({ userId: session.user.id }, 'User profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId: session.user.id }, 'Current user profile fetched');
      return profile;
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user profile');
      throw error;
    }
  });

  /**
   * GET /api/settings/me
   * Get current user's settings (protected)
   */
  app.fastify.get('/api/settings/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching user settings');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      if (!profile) {
        app.logger.warn({ userId: session.user.id }, 'User profile not found');
        return reply.status(404).send({ error: 'Profile not found' });
      }

      app.logger.info({ userId: session.user.id }, 'User settings fetched');
      return {
        id: profile.id,
        username: profile.username,
        email: profile.email,
        collectionPrivacy: profile.collectionPrivacy,
        role: profile.role,
        createdAt: profile.createdAt,
        preferences: {
          emailNotifications: true, // Default setting
          marketingEmails: false, // Default setting
        },
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch user settings');
      return reply.status(503).send({ error: 'Database error' });
    }
  });

  /**
   * PATCH /api/settings/me
   * Update user settings (protected)
   */
  app.fastify.patch('/api/settings/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Updating user settings');

    try {
      const body = UpdateSettingsSchema.parse(request.body);

      const updates: any = {};
      if (body.collectionPrivacy !== undefined) {
        updates.collectionPrivacy = body.collectionPrivacy;
      }

      if (Object.keys(updates).length === 0) {
        app.logger.warn({ userId: session.user.id }, 'No settings to update');
        return reply.status(400).send({ error: 'No settings provided' });
      }

      try {
        const updated = await app.db
          .update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, session.user.id))
          .returning();

        app.logger.info({ userId: session.user.id, updated: Object.keys(updates) }, 'User settings updated successfully');
        return {
          id: updated[0].id,
          username: updated[0].username,
          email: updated[0].email,
          collectionPrivacy: updated[0].collectionPrivacy,
          role: updated[0].role,
          createdAt: updated[0].createdAt,
          preferences: {
            emailNotifications: body.emailNotifications !== undefined ? body.emailNotifications : true,
            marketingEmails: body.marketingEmails !== undefined ? body.marketingEmails : false,
          },
        };
      } catch (dbError) {
        app.logger.error({ err: dbError, userId: session.user.id }, 'Database error updating settings');
        return reply.status(503).send({ error: 'Database error', message: 'Failed to update settings' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Unexpected error updating settings');
      return reply.status(500).send({ error: 'Update failed' });
    }
  });
}
