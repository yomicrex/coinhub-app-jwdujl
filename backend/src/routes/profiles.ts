import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { extractSessionToken } from '../utils/auth-utils.js';

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
   * GET /api/profiles/:userId
   * Get user profile by user ID
   * Returns: { id, username, displayName, avatarUrl, bio, location, role, email }
   */
  app.fastify.get('/api/profiles/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };

    app.logger.info({ userId }, 'Fetching user profile by ID');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
      });

      if (!profile) {
        app.logger.warn({ userId }, 'User profile not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId, username: profile.username }, 'User profile fetched by ID');

      // Generate signed URL for avatar if it exists
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(avatarUrl);
          avatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId }, 'Failed to generate avatar signed URL');
          avatarUrl = null;
        }
      }

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl,
        bio: profile.bio || null,
        location: profile.location || null,
        role: profile.role,
        email: profile.email,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch user profile by ID');
      return reply.status(500).send({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * GET /api/profiles/username/:username
   * Get user profile by username (case-insensitive)
   * Returns: { id, username, displayName, avatarUrl, bio, location, role, email }
   */
  app.fastify.get('/api/profiles/username/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };

    app.logger.info({ username }, 'Fetching user profile by username');

    try {
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!profile) {
        app.logger.warn({ username }, 'User profile not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ username, userId: profile.id }, 'User profile fetched by username');

      // Generate signed URL for avatar if it exists
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(avatarUrl);
          avatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: profile.id }, 'Failed to generate avatar signed URL');
          avatarUrl = null;
        }
      }

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl,
        bio: profile.bio || null,
        location: profile.location || null,
        role: profile.role,
        email: profile.email,
      };
    } catch (error) {
      app.logger.error({ err: error, username }, 'Failed to fetch user profile by username');
      return reply.status(500).send({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * GET /api/users/:username
   * Get public user profile by username with follow counts
   * Shows if authenticated user is following this profile
   */
  app.fastify.get('/api/users/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };

    app.logger.info({ username }, 'Fetching user profile');

    try {
      let profile;
      try {
        profile = await app.db.query.users.findFirst({
          where: eq(schema.users.username, username),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, username }, 'Database error fetching profile');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!profile) {
        app.logger.warn({ username }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Get follow counts
      let followerCount = 0;
      let followingCount = 0;
      let isFollowing = false;

      try {
        const followers = await app.db.query.follows.findMany({
          where: eq(schema.follows.followingId, profile.id),
          columns: { id: true },
        });
        followerCount = followers.length;

        const following = await app.db.query.follows.findMany({
          where: eq(schema.follows.followerId, profile.id),
          columns: { id: true },
        });
        followingCount = following.length;

        // Check if authenticated user is following
        // Use extractSessionToken instead of requireAuth to avoid sending 401 response on public endpoint
        const sessionToken = extractSessionToken(request);
        if (sessionToken) {
          try {
            const sessionRecord = await app.db.query.session.findFirst({
              where: eq(authSchema.session.token, sessionToken),
            });

            if (sessionRecord && new Date(sessionRecord.expiresAt) > new Date()) {
              const userRecord = await app.db.query.user.findFirst({
                where: eq(authSchema.user.id, sessionRecord.userId),
              });

              if (userRecord) {
                const follow = await app.db.query.follows.findFirst({
                  where: and(
                    eq(schema.follows.followerId, userRecord.id),
                    eq(schema.follows.followingId, profile.id)
                  ),
                });
                isFollowing = !!follow;
              }
            }
          } catch {
            // Not authenticated, that's fine
          }
        }
      } catch (dbError) {
        app.logger.warn({ err: dbError, userId: profile.id }, 'Failed to fetch follow counts');
        // Continue without follow counts
      }

      app.logger.info({ userId: profile.id, username }, 'User profile fetched');

      // Generate signed URL for avatar if it exists
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(avatarUrl);
          avatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: profile.id }, 'Failed to generate avatar signed URL');
          avatarUrl = null;
        }
      }

      return {
        id: profile.id,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl,
        bio: profile.bio || null,
        location: profile.location || null,
        followerCount,
        followingCount,
        isFollowing,
      };
    } catch (error) {
      app.logger.error({ err: error, username }, 'Failed to fetch user profile');
      return reply.status(500).send({ error: 'Failed to fetch profile' });
    }
  });

  /**
   * POST /api/profiles/me/avatar
   * Upload profile picture
   * Requires authentication
   * Accepts: jpg, jpeg, png, webp up to 10MB
   */
  app.fastify.post('/api/profiles/me/avatar', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Uploading profile picture');

    try {
      // Get file
      const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });

      if (!data) {
        app.logger.warn({ userId: session.user.id }, 'No file provided');
        return reply.status(400).send({ error: 'No file provided' });
      }

      // Validate file format
      const fileExtension = data.filename.split('.').pop()?.toLowerCase();
      const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp'];
      if (!fileExtension || !allowedExtensions.includes(fileExtension)) {
        app.logger.warn({ userId: session.user.id, ext: fileExtension }, 'Invalid file format');
        return reply.status(400).send({
          error: 'Invalid file format',
          message: 'Supported formats: jpg, jpeg, png, webp',
        });
      }

      // Read file
      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        app.logger.warn({ userId: session.user.id }, 'File too large');
        return reply.status(413).send({ error: 'File too large (max 10MB)' });
      }

      // Upload to storage
      let storageKey: string;
      try {
        const timestamp = Date.now();
        const cleanFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `avatars/${session.user.id}/${timestamp}-${cleanFilename}`;
        storageKey = await app.storage.upload(key, buffer);
        app.logger.debug({ userId: session.user.id, storageKey }, 'Avatar uploaded to storage');
      } catch (storageError) {
        app.logger.error({ err: storageError, userId: session.user.id }, 'Storage upload failed');
        return reply.status(503).send({ error: 'Storage error', message: 'Failed to upload avatar' });
      }

      // Update user profile with new avatar
      try {
        const updated = await app.db
          .update(schema.users)
          .set({ avatarUrl: storageKey })
          .where(eq(schema.users.id, session.user.id))
          .returning();

        // Generate signed URL for response
        let signedUrl;
        try {
          const { url } = await app.storage.getSignedUrl(storageKey);
          signedUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, storageKey }, 'Failed to generate signed URL');
          signedUrl = null;
        }

        app.logger.info({ userId: session.user.id }, 'Profile picture uploaded successfully');
        return {
          success: true,
          avatarUrl: signedUrl,
          storageKey: updated[0].avatarUrl,
        };
      } catch (dbError) {
        app.logger.error({ err: dbError, userId: session.user.id }, 'Database error saving avatar');
        // Try to cleanup uploaded file
        try {
          await app.storage.delete(storageKey);
        } catch (deleteError) {
          app.logger.error({ err: deleteError, storageKey }, 'Failed to cleanup uploaded file');
        }
        return reply.status(503).send({ error: 'Database error', message: 'Failed to save avatar' });
      }
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Unexpected error uploading avatar');
      return reply.status(500).send({ error: 'Upload failed' });
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

      try {
        const updated = await app.db
          .update(schema.users)
          .set(updates)
          .where(eq(schema.users.id, session.user.id))
          .returning();

        app.logger.info({ userId: session.user.id }, 'User profile updated successfully');
        return updated[0];
      } catch (dbError) {
        app.logger.error({ err: dbError, userId: session.user.id }, 'Database error updating profile');
        return reply.status(503).send({ error: 'Database error' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to update user profile');
      return reply.status(500).send({ error: 'Update failed' });
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

      // Generate signed URL for avatar if it exists
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(avatarUrl);
          avatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: session.user.id }, 'Failed to generate avatar signed URL');
          avatarUrl = null;
        }
      }

      return { ...profile, avatarUrl };
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
