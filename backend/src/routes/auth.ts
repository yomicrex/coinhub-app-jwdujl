import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
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
      const existingUsername = await app.db.query.users.findFirst({
        where: eq(schema.users.username, body.username),
      });

      if (existingUsername && existingUsername.id !== session.user.id) {
        app.logger.warn({ username: body.username, userId: session.user.id }, 'Username already taken');
        return reply.status(409).send({ error: 'Username already taken', message: 'This username is already in use' });
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
        return reply.status(409).send({ error: 'Username already taken', message: 'This username is already in use' });
      }

      app.logger.error(
        { err: error, userId: session.user.id, username: requestBody?.username, body: requestBody },
        'Failed to complete profile - unexpected error'
      );
      return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
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
}
