import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
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

  /**
   * DELETE /api/users/me
   * Delete the current authenticated user's account and all associated data
   * This is a destructive operation that permanently removes:
   * - All trade offers where user is the offerer
   * - All trade messages sent by the user
   * - All trades where user is initiator or coin owner
   * - All comments by the user
   * - All likes by the user
   * - All coin images for user's coins
   * - All coins owned by the user
   * - All follows (both as follower and following)
   * - All notifications for the user
   * - All reports by the user
   * - The user's profile
   * - The user record from the users table
   *
   * Returns: { success: true, message: "Account deleted successfully" }
   */
  app.fastify.delete('/api/users/me', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'DELETE /api/users/me - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for account deletion'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for account deletion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session token not found in database');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid or expired' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({ token: sessionToken.substring(0, 20), expiresAt: sessionRecord.expiresAt }, 'Session token expired');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user from session
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for valid session');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      userId = userRecord.id;
      app.logger.info({ userId }, 'Session validated successfully for account deletion');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for account deletion');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ userId }, 'Processing account deletion - DESTRUCTIVE OPERATION');

    try {
      // Start deletion in order of foreign key dependencies
      // This order ensures we don't violate any foreign key constraints

      // 1. Delete all trade offers where user is the offerer
      app.logger.debug({ userId }, 'Deleting trade offers');
      await app.db
        .delete(schema.tradeOffers)
        .where(eq(schema.tradeOffers.offererId, userId));

      // 2. Delete all trade messages sent by the user
      app.logger.debug({ userId }, 'Deleting trade messages');
      await app.db
        .delete(schema.tradeMessages)
        .where(eq(schema.tradeMessages.senderId, userId));

      // 3. Delete all trades where user is initiator or coin owner
      app.logger.debug({ userId }, 'Deleting trades');
      await app.db
        .delete(schema.trades)
        .where(
          or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          )
        );

      // 4. Delete all comments by the user
      app.logger.debug({ userId }, 'Deleting comments');
      await app.db
        .delete(schema.comments)
        .where(eq(schema.comments.userId, userId));

      // 5. Delete all likes by the user
      app.logger.debug({ userId }, 'Deleting likes');
      await app.db
        .delete(schema.likes)
        .where(eq(schema.likes.userId, userId));

      // 6. Delete all coin images for user's coins
      // First get all coins owned by the user
      app.logger.debug({ userId }, 'Deleting coin images');
      const userCoins = await app.db.query.coins.findMany({
        where: eq(schema.coins.userId, userId),
      });

      for (const coin of userCoins) {
        await app.db
          .delete(schema.coinImages)
          .where(eq(schema.coinImages.coinId, coin.id));
      }

      // 7. Delete all coins owned by the user
      app.logger.debug({ userId }, 'Deleting coins');
      await app.db
        .delete(schema.coins)
        .where(eq(schema.coins.userId, userId));

      // 8. Delete all follows (both as follower and following)
      app.logger.debug({ userId }, 'Deleting follows');
      await app.db
        .delete(schema.follows)
        .where(
          or(
            eq(schema.follows.followerId, userId),
            eq(schema.follows.followingId, userId)
          )
        );

      // 9. Delete all trade reports by or about the user
      app.logger.debug({ userId }, 'Deleting trade reports');
      await app.db
        .delete(schema.tradeReports)
        .where(
          or(
            eq(schema.tradeReports.reporterId, userId),
            eq(schema.tradeReports.reportedUserId, userId)
          )
        );

      // 10. Delete the user's profile from the users table
      app.logger.debug({ userId }, 'Deleting user profile');
      await app.db
        .delete(schema.users)
        .where(eq(schema.users.id, userId));

      // 11. Delete the user record from Better Auth user table
      // NOTE: This is handled by Better Auth's cascade delete or should be done through Better Auth API
      // For now, we just log this for manual cleanup
      app.logger.info({ userId }, 'User profile and all associated data deleted');

      app.logger.warn({ userId }, 'ACCOUNT DELETION COMPLETE - User account and all data permanently removed from system');

      return {
        success: true,
        message: 'Account deleted successfully',
      };
    } catch (error) {
      app.logger.error(
        { err: error, userId },
        'Failed to delete account - PARTIAL DELETION MAY HAVE OCCURRED'
      );
      return reply.status(500).send({
        error: 'Account deletion failed',
        message: 'An error occurred while deleting your account. Please contact support.',
      });
    }
  });

  /**
   * POST /api/profiles/complete
   * Complete user profile for authenticated user (alternative to POST /api/auth/complete-profile)
   * Creates profile if it doesn't exist, updates if it does
   *
   * Requires authentication via session
   * Body: { username: string, displayName: string, bio?: string, location?: string, avatarUrl?: string }
   * Returns: { id, email, username, displayName, bio, location, avatarUrl, role, hasProfile: true }
   * Returns 401 if not authenticated
   * Returns 400 if validation fails
   * Returns 409 if username already taken
   */
  app.fastify.post('/api/profiles/complete', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('POST /api/profiles/complete - completing user profile');

    try {
      // Extract session token from cookies or Authorization header
      const sessionToken = extractSessionToken(request);

      if (!sessionToken) {
        app.logger.warn('POST /api/profiles/complete - No session token found');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!sessionRecord) {
        app.logger.warn({ tokenStart: sessionToken.substring(0, 20) }, 'POST /api/profiles/complete - Session not found');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({ tokenStart: sessionToken.substring(0, 20) }, 'POST /api/profiles/complete - Session expired');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'POST /api/profiles/complete - User not found');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      app.logger.info({ userId: userRecord.id, email: userRecord.email }, 'Session validated for profile completion');

      // Validate request body
      const CompleteProfileSchema = z.object({
        username: z.string().min(3).max(30),
        displayName: z.string().min(1).max(100),
        bio: z.string().max(500).optional(),
        location: z.string().max(100).optional(),
        avatarUrl: z.string().optional(),
      });

      const body = CompleteProfileSchema.parse(request.body);

      app.logger.info(
        { userId: userRecord.id, email: userRecord.email, username: body.username },
        'Profile completion request validated'
      );

      // Check if username is already taken by a different user
      const existingUsername = await app.db.query.users.findFirst({
        where: eq(schema.users.username, body.username),
      });

      if (existingUsername && existingUsername.id !== userRecord.id) {
        app.logger.warn({ username: body.username, userId: userRecord.id }, 'Username already taken');
        return reply.status(409).send({ error: 'Username already taken' });
      }

      // Check if user already has a profile
      const existingProfile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, userRecord.id),
      });

      let profile;

      if (existingProfile) {
        // Update existing profile
        app.logger.info({ userId: userRecord.id, username: body.username }, 'Updating existing user profile');

        await app.db
          .update(schema.users)
          .set({
            username: body.username,
            displayName: body.displayName,
            bio: body.bio || null,
            location: body.location || null,
            avatarUrl: body.avatarUrl || null,
            updatedAt: new Date(),
          })
          .where(eq(schema.users.id, userRecord.id));

        profile = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userRecord.id),
        });

        app.logger.info({ userId: userRecord.id, username: body.username }, 'User profile updated successfully');
      } else {
        // Create new profile
        app.logger.info({ userId: userRecord.id, username: body.username }, 'Creating new user profile');

        try {
          await app.db.insert(schema.users).values({
            id: userRecord.id,
            email: userRecord.email,
            username: body.username,
            displayName: body.displayName,
            bio: body.bio || null,
            location: body.location || null,
            avatarUrl: body.avatarUrl || null,
            collectionPrivacy: 'public',
            role: 'user',
          });

          profile = await app.db.query.users.findFirst({
            where: eq(schema.users.id, userRecord.id),
          });

          app.logger.info(
            { userId: userRecord.id, username: body.username, email: userRecord.email },
            'User profile created successfully'
          );
        } catch (createError) {
          app.logger.error(
            { err: createError, userId: userRecord.id, username: body.username },
            'Failed to create user profile'
          );
          throw createError;
        }
      }

      if (!profile) {
        app.logger.error({ userId: userRecord.id }, 'Failed to retrieve profile after creation/update');
        return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
      }

      // Generate signed URL for avatar if it exists
      let avatarUrl = profile.avatarUrl;
      if (avatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(avatarUrl);
          avatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: userRecord.id }, 'Failed to generate avatar signed URL');
          avatarUrl = null;
        }
      }

      app.logger.info(
        { userId: userRecord.id, username: profile.username },
        'Returning completed profile'
      );

      return {
        id: profile.id,
        email: profile.email,
        username: profile.username,
        displayName: profile.displayName,
        bio: profile.bio || null,
        location: profile.location || null,
        avatarUrl,
        role: profile.role,
        hasProfile: true,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }

      app.logger.error({ err: error }, 'Failed to complete profile');
      return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
    }
  });
}
