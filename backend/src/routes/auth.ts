import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { extractSessionToken } from '../utils/auth-utils.js';

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

const EmailOnlySignInSchema = z.object({
  email: z.string().email('Invalid email address'),
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
   * GET /api/debug/version
   * PUBLIC DEBUG ENDPOINT - Returns backend version and timestamp for deployment verification
   * No authentication required
   */
  app.fastify.get('/api/debug/version', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Debug version endpoint requested');
    return {
      backendVersion: '2026-01-31-03',
      timestamp: new Date().toISOString(),
    };
  });

  /**
   * GET /api/debug/headers
   * PUBLIC DEBUG ENDPOINT - Returns raw request headers to debug mobile app auth issues
   * Helps diagnose what iOS/TestFlight/Expo is actually sending
   * No authentication required
   */
  app.fastify.get('/api/debug/headers', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info(
      {
        method: request.method,
        path: request.url,
        origin: request.headers.origin || 'undefined',
        referer: request.headers.referer || 'undefined',
        xAppType: request.headers['x-app-type'] || 'undefined'
      },
      'DEBUG: Headers request received'
    );

    return {
      timestampISO: new Date().toISOString(),
      method: request.method,
      url: request.url,
      host: request.headers.host || undefined,
      'x-forwarded-host': request.headers['x-forwarded-host'] || undefined,
      'x-forwarded-proto': request.headers['x-forwarded-proto'] || undefined,
      origin: request.headers.origin || undefined,
      referer: request.headers.referer || undefined,
      'x-app-type': request.headers['x-app-type'] || undefined,
      'x-platform': request.headers['x-platform'] || undefined,
      hasAuthorization: !!request.headers.authorization,
      'user-agent': request.headers['user-agent'] || undefined
    };
  });

  /**
   * GET /api/auth/debug/users
   * DEBUG ENDPOINT - List all users in auth database to diagnose sign-up/sign-in issues
   * Shows email addresses and verification status
   * DISABLED IN PRODUCTION - Only available in development/staging
   */
  if (process.env.NODE_ENV !== 'production') {
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
     * DISABLED IN PRODUCTION - Only available in development/staging
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
     * GET /api/auth/debug/accounts/:userId
     * DEBUG ENDPOINT - Check account records for a user (by Better Auth user ID)
     * Shows which provider_id values are stored and if password exists
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.get('/api/auth/debug/accounts/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = String((request.params as any).userId);
      app.logger.warn({ userId }, 'DEBUG: Checking accounts for user - this endpoint should be disabled in production');
      try {
        const accounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, userId)
        });

        app.logger.info({ userId, count: accounts.length }, 'DEBUG: Retrieved accounts for user');
        return {
          userId,
          accountCount: accounts.length,
          accounts: accounts.map(a => ({
            id: a.id,
            accountId: a.accountId,
            providerId: a.providerId,
            hasPassword: !!a.password,
            passwordLength: a.password ? a.password.length : 0,
            passwordFirst50Chars: a.password ? a.password.substring(0, 50) : null,
            createdAt: a.createdAt
          }))
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'DEBUG: Failed to check accounts');
        return reply.status(500).send({ error: 'Failed to check accounts' });
      }
    });

    /**
     * POST /api/auth/debug/test-password
     * DEBUG ENDPOINT - Test password hashing and comparison
     * Helps diagnose bcrypt issues
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.post('/api/auth/debug/test-password', async (request: FastifyRequest, reply: FastifyReply) => {
      const { password, hash } = request.body as { password?: string; hash?: string };
      app.logger.warn('DEBUG: Testing password hashing - this endpoint should be disabled in production');

      try {
        const bcrypt = await import('bcryptjs') as any;

        if (!password) {
          return reply.status(400).send({ error: 'Password required' });
        }

        if (!hash) {
          // Hash the password and return it
          const newHash = await bcrypt.hash(password, 10);
          return {
            action: 'hash',
            passwordLength: password.length,
            hashLength: newHash.length,
            hash: newHash.substring(0, 50) + '...',
            note: 'Use this hash in subsequent test calls'
          };
        } else {
          // Compare password to hash
          const match = await bcrypt.compare(password, hash);
          return {
            action: 'compare',
            passwordLength: password.length,
            hashLength: hash.length,
            match,
            hashFirst50: hash.substring(0, 50),
            note: match ? 'Password matches hash' : 'Password does NOT match hash'
          };
        }
      } catch (error) {
        app.logger.error({ err: error }, 'DEBUG: Password test failed');
        return reply.status(500).send({ error: 'Password test failed', details: String(error) });
      }
    });

    /**
     * POST /api/auth/debug/diagnose/:userId
     * DEBUG ENDPOINT - Complete password authentication diagnosis
     * Test if a specific user can authenticate with a password
     * Body: { password: string }
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.post('/api/auth/debug/diagnose/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = String((request.params as any).userId);
      const { password } = request.body as { password?: string };

      app.logger.warn({ userId }, 'DEBUG: Running full auth diagnosis - this endpoint should be disabled in production');

      try {
        if (!password) {
          return reply.status(400).send({ error: 'Password required' });
        }

        // Step 1: Get auth user
        const authUser = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, userId)
        });

        if (!authUser) {
          return {
            step: 'user_lookup',
            status: 'failed',
            message: 'Auth user not found'
          };
        }

        // Step 2: Get all accounts for this user
        const allAccounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, userId)
        });

        // Step 3: Find accounts with passwords
        const accountsWithPassword = allAccounts.filter(a => a.password);

        // Step 4: Try to verify with each account
        const bcrypt = await import('bcryptjs') as any;
        const results = [];

        for (const account of accountsWithPassword) {
          try {
            const match = await bcrypt.compare(password, account.password);
            results.push({
              accountId: account.id,
              providerId: account.providerId,
              passwordHashLength: account.password.length,
              match,
              bcryptValid: true
            });
          } catch (e) {
            results.push({
              accountId: account.id,
              providerId: account.providerId,
              passwordHashLength: account.password.length,
              match: false,
              bcryptValid: false,
              error: String(e).substring(0, 100)
            });
          }
        }

        const successfulMatches = results.filter(r => r.match).length;

        return {
          diagnosis: 'complete',
          userId,
          authUserFound: true,
          totalAccounts: allAccounts.length,
          accountsWithPassword: accountsWithPassword.length,
          providers: allAccounts.map(a => a.providerId),
          passwordVerificationResults: results,
          successfulMatches,
          note: successfulMatches > 0 ? 'Password verified successfully' : 'Password failed to verify with all accounts'
        };
      } catch (error) {
        app.logger.error({ err: error, userId }, 'DEBUG: Diagnosis failed');
        return reply.status(500).send({ error: 'Diagnosis failed', details: String(error) });
      }
    });

    /**
     * GET /api/auth/debug/email-by-username/:username
     * DEBUG ENDPOINT - Find user by CoinHub username and get their Better Auth ID and email
     * Helps correlate CoinHub usernames with Better Auth accounts
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.get('/api/auth/debug/email-by-username/:username', async (request: FastifyRequest, reply: FastifyReply) => {
      const username = String((request.params as any).username);
      app.logger.warn({ username }, 'DEBUG: Looking up user by username');

      try {
        const coinHubUser = await app.db.query.users.findFirst({
          where: eq(schema.users.username, username)
        });

        if (!coinHubUser) {
          return {
            username,
            found: false,
            message: 'User not found in CoinHub users table'
          };
        }

        // Get Better Auth user record
        const authUser = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, coinHubUser.id)
        });

        // Get all accounts for this user
        const accounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, coinHubUser.id)
        });

        return {
          username,
          found: true,
          coinHubUserId: coinHubUser.id,
          coinHubEmail: coinHubUser.email,
          authUserEmail: authUser?.email,
          authUserId: authUser?.id,
          accounts: accounts.map(a => ({
            id: a.id,
            providerId: a.providerId,
            hasPassword: !!a.password,
            passwordHashLength: a.password?.length
          }))
        };
      } catch (error) {
        app.logger.error({ err: error, username }, 'DEBUG: Lookup failed');
        return reply.status(500).send({ error: 'Lookup failed', details: String(error) });
      }
    });

    /**
     * GET /api/auth/debug/sessions
     * DEBUG ENDPOINT - List all sessions in the database
     * Shows session tokens, user IDs, and expiry times
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.get('/api/auth/debug/sessions', async (request: FastifyRequest, reply: FastifyReply) => {
      app.logger.warn('DEBUG: Listing all sessions - this endpoint should be disabled in production');

      try {
        const sessions = await app.db.query.session.findMany();
        app.logger.info({ count: sessions.length }, 'DEBUG: Retrieved sessions for debugging');

        return {
          count: sessions.length,
          sessions: sessions.map((s: any) => {
            const token = String(s.token || '');
            const expiresAt = s.expiresAt instanceof Date ? s.expiresAt : new Date(s.expiresAt as string | number);
            return {
              id: s.id,
              userId: s.userId,
              tokenLength: token.length,
              tokenStart: token.substring(0, 20),
              tokenEnd: token.substring(token.length - 10),
              expiresAt: expiresAt,
              isExpired: expiresAt < new Date(),
              createdAt: s.createdAt,
              updatedAt: s.updatedAt,
            };
          })
        };
      } catch (error) {
        app.logger.error({ err: error }, 'DEBUG: Failed to list sessions');
        return reply.status(500).send({ error: 'Failed to list sessions', details: String(error) });
      }
    });

    /**
     * GET /api/auth/debug/session/:token
     * DEBUG ENDPOINT - Check if a specific session token exists in the database
     * Helps diagnose session matching issues
     * DISABLED IN PRODUCTION - Only available in development/staging
     */
    app.fastify.get('/api/auth/debug/session/:token', async (request: FastifyRequest, reply: FastifyReply) => {
      const token = String((request.params as any).token);
      app.logger.warn({ tokenLength: token.length }, 'DEBUG: Checking session token - this endpoint should be disabled in production');

      try {
        const session = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, token)
        });

        if (!session) {
          app.logger.info({ tokenLength: token.length }, 'DEBUG: Session token not found');
          return {
            found: false,
            tokenLength: token.length,
            tokenStart: token.substring(0, 20),
            message: 'Session token not found in database'
          };
        }

        // Get the user for this session
        const user = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, session.userId)
        });

        app.logger.info({ sessionId: session.id, userId: session.userId }, 'DEBUG: Session found');

        return {
          found: true,
          sessionId: session.id,
          userId: session.userId,
          userEmail: user?.email,
          tokenLength: session.token.length,
          tokenMatch: session.token === token,
          expiresAt: session.expiresAt,
          isExpired: new Date(session.expiresAt) < new Date(),
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          note: new Date(session.expiresAt) < new Date() ? 'Session is expired' : 'Session is valid'
        };
      } catch (error) {
        app.logger.error({ err: error, tokenLength: token.length }, 'DEBUG: Session lookup failed');
        return reply.status(500).send({ error: 'Session lookup failed', details: String(error) });
      }
    });
  }

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
   * Returns: { id, email, username, displayName, avatarUrl, bio, location, hasProfile: true }
   * Returns 401 if session is invalid
   */
  app.fastify.get('/api/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('GET /api/auth/me - fetching current user');

    try {
      // Log incoming headers for debugging
      const cookieHeader = request.headers.cookie || '';
      const authHeader = request.headers.authorization || '';
      app.logger.debug(
        {
          hasCookie: !!cookieHeader,
          cookieLength: cookieHeader.length,
          cookiePreview: cookieHeader.substring(0, 100),
          hasAuthHeader: !!authHeader,
          authHeaderPreview: authHeader.substring(0, 50)
        },
        'GET /api/auth/me - Headers received'
      );

      // Extract session token for debugging
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        {
          sessionTokenFound: !!sessionToken,
          tokenLength: sessionToken?.length || 0,
          tokenStart: sessionToken?.substring(0, 30) || 'N/A',
          tokenEnd: sessionToken ? sessionToken.substring(Math.max(0, sessionToken.length - 20)) : 'N/A'
        },
        'GET /api/auth/me - Session token extraction'
      );

      if (!sessionToken) {
        app.logger.warn('GET /api/auth/me - No session token found in request');
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'No active session'
        });
      }

      // Look up session directly in database
      app.logger.debug({ tokenStart: sessionToken.substring(0, 20) }, 'GET /api/auth/me - Looking up session in database');
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken)
      });

      if (!sessionRecord) {
        app.logger.warn(
          { tokenLength: sessionToken.length, tokenStart: sessionToken.substring(0, 20) },
          'GET /api/auth/me - Session token not found in database'
        );
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Session not found'
        });
      }

      app.logger.debug({ sessionUserId: sessionRecord.userId }, 'GET /api/auth/me - Session found in database');

      // Check if session is expired
      const expiresAt = new Date(sessionRecord.expiresAt);
      const now = new Date();
      if (expiresAt < now) {
        app.logger.warn(
          { expiresAt, now },
          'GET /api/auth/me - Session has expired'
        );
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Session expired'
        });
      }

      // Get user record from Better Auth
      app.logger.debug({ userId: sessionRecord.userId }, 'GET /api/auth/me - Looking up user in database');
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId)
      });

      if (!userRecord) {
        app.logger.warn(
          { userId: sessionRecord.userId },
          'GET /api/auth/me - User not found for valid session'
        );
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found'
        });
      }

      app.logger.info(
        { userId: userRecord.id, email: userRecord.email },
        'GET /api/auth/me - Session validated, user authenticated'
      );

      // Get CoinHub user profile by user ID
      // The users.id field MUST match the user.id field from Better Auth
      const profile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, userRecord.id),
      });

      app.logger.info(
        {
          userId: userRecord.id,
          email: userRecord.email,
          profileFound: !!profile,
          profileUsername: profile?.username
        },
        'GET /api/auth/me - Profile lookup complete'
      );

      // Handle case where profile doesn't exist
      if (!profile) {
        app.logger.info(
          { userId: userRecord.id, email: userRecord.email },
          'GET /api/auth/me - Profile not found for authenticated user'
        );
        return reply.status(200).send({
          id: userRecord.id,
          email: userRecord.email,
          hasProfile: false,
          message: 'Profile not yet completed. Please complete your profile using POST /api/profiles/complete'
        });
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
        {
          userId: userRecord.id,
          username: profile.username,
          email: userRecord.email,
          hasProfile: true
        },
        'GET /api/auth/me - Returning full profile for user'
      );

      return {
        id: userRecord.id,
        email: userRecord.email,
        username: profile.username,
        displayName: profile.displayName,
        avatarUrl: avatarUrl,
        bio: profile.bio || null,
        location: profile.location || null,
        hasProfile: true
      };
    } catch (error) {
      app.logger.error({ err: error }, 'GET /api/auth/me - Failed to fetch current user');
      return reply.status(500).send({
        error: 'Failed to fetch user',
        message: String(error)
      });
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
    app.logger.info('POST /api/auth/complete-profile - starting profile completion');

    let userRecord: any;
    let requestBody: Record<string, any> | undefined;

    try {
      // Get session token from cookie header
      const cookieHeader = request.headers.cookie || '';
      const sessionToken = cookieHeader
        .split(';')
        .find(cookie => cookie.trim().startsWith('session='))
        ?.split('=')[1]
        ?.trim();

      if (!sessionToken) {
        app.logger.warn('Profile completion attempted without authentication');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken)
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session not found for profile completion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session expired for profile completion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId)
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for profile completion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      app.logger.info({ userId: userRecord.id, email: userRecord.email }, 'Session validated for profile completion');

      requestBody = request.body as Record<string, any>;
      app.logger.info(
        { userId: userRecord.id, email: userRecord.email, username: requestBody?.username },
        'Profile completion started'
      );

      const body = CompleteProfileSchema.parse(requestBody);

      // Check if username is already taken
      // TEMPORARY BETA TESTING: Allow multiple accounts per email with different usernames
      const existingUsername = await app.db.query.users.findFirst({
        where: eq(schema.users.username, body.username),
      });

      if (existingUsername && existingUsername.id !== userRecord.id) {
        app.logger.warn({ username: body.username, userId: userRecord.id }, 'Username already taken');
        return reply.status(409).send({ error: 'Username already taken' });
      }

      // Validate and process invite code if provided
      let inviteCodeUsed = null;
      if (body.inviteCode) {
        app.logger.info({ userId: userRecord.id, code: body.inviteCode }, 'Validating invite code');
        try {
          const inviteCode = await app.db.query.inviteCodes.findFirst({
            where: eq(schema.inviteCodes.code, body.inviteCode.toUpperCase()),
          });

          if (!inviteCode) {
            app.logger.warn({ code: body.inviteCode, userId: userRecord.id }, 'Invalid invite code');
            return reply.status(400).send({ error: 'Invalid invite code', message: 'The invite code is not valid' });
          }

          if (!inviteCode.isActive) {
            app.logger.warn({ code: body.inviteCode, userId: userRecord.id }, 'Invite code is not active');
            return reply.status(400).send({ error: 'Invite code is not active', message: 'This invite code has been deactivated' });
          }

          if (inviteCode.expiresAt && new Date(inviteCode.expiresAt) < new Date()) {
            app.logger.warn({ code: body.inviteCode, userId: userRecord.id, expiresAt: inviteCode.expiresAt }, 'Invite code has expired');
            return reply.status(400).send({ error: 'Invite code has expired', message: 'This invite code is no longer valid' });
          }

          if (
            inviteCode.usageLimit !== null &&
            inviteCode.usageCount >= inviteCode.usageLimit
          ) {
            app.logger.warn(
              { code: body.inviteCode, userId: userRecord.id, limit: inviteCode.usageLimit, count: inviteCode.usageCount },
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
              { userId: userRecord.id, code: body.inviteCode, newCount: inviteCode.usageCount + 1 },
              'Invite code used successfully'
            );
          } catch (updateError) {
            app.logger.error(
              { err: updateError, codeId: inviteCode.id, userId: userRecord.id },
              'Failed to increment invite code usage'
            );
            return reply.status(500).send({ error: 'Server error', message: 'Failed to process invite code' });
          }
        } catch (dbError) {
          app.logger.error({ err: dbError, code: body.inviteCode, userId: userRecord.id }, 'Database error during invite code processing');
          return reply.status(500).send({ error: 'Server error', message: 'Unable to validate invite code' });
        }
      }

      // Create or update user profile
      let profile;
      try {
        const existingProfile = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userRecord.id),
        });

        if (existingProfile) {
          // Update existing profile
          app.logger.info({ userId: userRecord.id, username: body.username }, 'Updating existing user profile');
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
              .where(eq(schema.users.id, userRecord.id));

            profile = await app.db.query.users.findFirst({
              where: eq(schema.users.id, userRecord.id),
            });
            app.logger.info({ userId: userRecord.id, username: body.username }, 'User profile updated successfully');
          } catch (updateError) {
            app.logger.error({ err: updateError, userId: userRecord.id, username: body.username }, 'Failed to update user profile');
            return reply.status(500).send({ error: 'Server error', message: 'Failed to update profile' });
          }
        } else {
          // Create new profile - fetch email from Better Auth user table
          app.logger.info({ userId: userRecord.id, username: body.username }, 'Creating new user profile');
          const email = userRecord.email;
          app.logger.info({ userId: userRecord.id, email }, 'Using auth user email');

          try {
            await app.db.insert(schema.users).values({
              id: userRecord.id,
              email: email,
              username: body.username,
              displayName: body.displayName,
              bio: body.bio || null,
              location: body.location || null,
              avatarUrl: body.avatarUrl || null,
              inviteCodeUsed: inviteCodeUsed,
            });

            profile = await app.db.query.users.findFirst({
              where: eq(schema.users.id, userRecord.id),
            });
            app.logger.info(
              { userId: userRecord.id, username: body.username, email, inviteCodeUsed },
              'User profile created successfully'
            );
          } catch (createError) {
            app.logger.error(
              { err: createError, userId: userRecord.id, username: body.username },
              'Failed to create user profile'
            );
            return reply.status(500).send({ error: 'Server error', message: 'Failed to create profile' });
          }
        }
      } catch (profileError) {
        app.logger.error({ err: profileError, userId: userRecord.id }, 'Unexpected error during profile creation/update');
        return reply.status(500).send({ error: 'Server error', message: 'Failed to complete profile' });
      }

      app.logger.info(
        { userId: userRecord.id, username: body.username, inviteCodeUsed, email: profile?.email },
        'Profile completion finished successfully'
      );
      return profile;
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn(
          { error: error.issues, userId: userRecord.id, body: requestBody },
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
        app.logger.warn({ err: error, userId: userRecord.id, username: requestBody?.username }, 'Username already taken - unique constraint violation');
        return reply.status(409).send({ error: 'Username already taken' });
      }

      app.logger.error(
        { err: error, userId: userRecord.id, username: requestBody?.username, body: requestBody },
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
    app.logger.info('PATCH /api/auth/profile - updating profile');

    try {
      // Get session token from cookie header
      const cookieHeader = request.headers.cookie || '';
      const sessionToken = cookieHeader
        .split(';')
        .find(cookie => cookie.trim().startsWith('session='))
        ?.split('=')[1]
        ?.trim();

      if (!sessionToken) {
        app.logger.warn('Profile update attempted without authentication');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Authentication required' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken)
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session not found for profile update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session expired for profile update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId)
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for profile update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      app.logger.info({ userId: userRecord.id }, 'Profile update started');

      const body = UpdateProfileSchema.parse(request.body);

      const updates: any = {};
      if (body.displayName !== undefined) updates.displayName = body.displayName;
      if (body.bio !== undefined) updates.bio = body.bio;
      if (body.location !== undefined) updates.location = body.location;
      if (body.avatarUrl !== undefined) updates.avatarUrl = body.avatarUrl;
      if (body.collectionPrivacy !== undefined) updates.collectionPrivacy = body.collectionPrivacy;

      // Only update if there are actual changes
      if (Object.keys(updates).length === 0) {
        app.logger.warn({ userId: userRecord.id }, 'Profile update with no changes requested');
        return reply.status(400).send({ error: 'No fields to update', message: 'Provide at least one field to update' });
      }

      const profile = await app.db
        .update(schema.users)
        .set(updates)
        .where(eq(schema.users.id, userRecord.id))
        .returning();

      app.logger.info(
        { userId: userRecord.id, updatedFields: Object.keys(updates) },
        'Profile updated successfully'
      );
      return profile[0];
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn(
          { error: error.issues },
          'Profile update validation error'
        );
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
          message: 'Please check the fields and try again'
        });
      }
      app.logger.error({ err: error }, 'Failed to update profile');
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

      // Check if user exists (case-insensitive using SQL LOWER function)
      app.logger.info({ email: normalizedEmail }, 'Looking up user for password reset');
      const user = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${normalizedEmail})`
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
      const resetToken = randomUUID();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour from now

      try {
        // Store reset token in verification table (Better Auth convention)
        await app.db.insert(authSchema.verification).values({
          id: randomUUID(),
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

      // Find user by email (identifier) using case-insensitive comparison
      const user = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${verification.identifier})`
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
        // Better Auth stores the hash in account.password with provider_id 'credential'
        const bcrypt = await import('bcryptjs') as any;
        const hashedPassword = await bcrypt.hash(body.password, 10);

        // Find the credential account record
        let credentialAccount = await app.db.query.account.findFirst({
          where: and(
            eq(authSchema.account.userId, user.id),
            eq(authSchema.account.providerId, 'credential')
          )
        });

        // If credential account not found, look for any account with a password
        if (!credentialAccount) {
          app.logger.debug(
            { userId: user.id },
            'No credential account found for reset, checking for any account with password'
          );
          const allAccounts = await app.db.query.account.findMany({
            where: eq(authSchema.account.userId, user.id)
          });

          app.logger.info(
            { userId: user.id, totalAccounts: allAccounts.length, providers: allAccounts.map(a => a.providerId) },
            'All accounts for password reset user'
          );

          // Find the first account with a password
          credentialAccount = allAccounts.find(a => a.password) || null;
          if (credentialAccount) {
            app.logger.info(
              { userId: user.id, providerId: credentialAccount.providerId },
              'Found account with password using provider: ' + credentialAccount.providerId
            );
          }
        }

        if (credentialAccount) {
          // Update existing account with new password
          await app.db
            .update(authSchema.account)
            .set({ password: hashedPassword })
            .where(eq(authSchema.account.id, credentialAccount.id));

          app.logger.info(
            { userId: user.id, accountId: credentialAccount.id, providerId: credentialAccount.providerId },
            'Password updated in account'
          );
        } else {
          // This shouldn't happen if user did sign up with password
          app.logger.warn({ userId: user.id }, 'No account with password found for user, creating credential account');
          await app.db.insert(authSchema.account).values({
            id: randomUUID(),
            userId: user.id,
            accountId: `credential-${user.id}`,
            providerId: 'credential',
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
        // Look up by email in Better Auth user table
        // Using case-insensitive comparison for email using SQL LOWER function
        try {
          authUser = await app.db.query.user.findFirst({
            where: sql`LOWER(${authSchema.user.email}) = LOWER(${email})`,
          });

          if (authUser) {
            // Look up CoinHub profile by user ID (CRITICAL: must match Better Auth user ID)
            // The users.id field MUST match the user.id field from Better Auth
            app.logger.debug(
              { authUserId: authUser.id, email },
              'Sign-in: Looking up profile by user ID (users.id matches user.id)'
            );
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
        // First try credential provider
        accountRecord = await app.db.query.account.findFirst({
          where: and(
            eq(authSchema.account.userId, authUser.id),
            eq(authSchema.account.providerId, 'credential')
          ),
        });

        // If not found, try to find ANY account with password for this user
        if (!accountRecord) {
          app.logger.debug(
            { userId: authUser.id },
            'No credential account found, checking for any account with password'
          );
          const allAccounts = await app.db.query.account.findMany({
            where: eq(authSchema.account.userId, authUser.id)
          });

          app.logger.info(
            { userId: authUser.id, totalAccounts: allAccounts.length, providers: allAccounts.map(a => a.providerId) },
            'Debug: All accounts for user'
          );

          // Find the first account with a password
          accountRecord = allAccounts.find(a => a.password);

          if (accountRecord) {
            app.logger.info(
              { userId: authUser.id, providerId: accountRecord.providerId },
              'Found account with password using provider: ' + accountRecord.providerId
            );
          }
        }

        if (!accountRecord || !accountRecord.password) {
          app.logger.warn(
            { userId: authUser.id, identifier, identifierType: isEmail ? 'email' : 'username' },
            'Sign-in failed: no account with password found'
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

        // Validate the hash format first (bcrypt hashes start with $2a$, $2b$, or $2y$)
        const isBcryptHash = /^\$2[aby]\$\d+\$/.test(accountRecord.password);

        // Log the hash format to diagnose issues
        app.logger.debug(
          { userId: authUser.id, hashLength: accountRecord.password?.length, isBcryptHash },
          'Password hash info for comparison'
        );

        if (!isBcryptHash) {
          app.logger.error(
            { userId: authUser.id, identifier, hashLength: accountRecord.password?.length, hashStart: accountRecord.password?.substring(0, 20) },
            'Password hash format is invalid - not a valid bcrypt hash'
          );
          return reply.status(500).send({ error: 'Authentication error' });
        }

        const passwordMatch = await bcrypt.compare(body.password, accountRecord.password);

        if (!passwordMatch) {
          app.logger.warn(
            { userId: authUser.id, identifier, identifierType: isEmail ? 'email' : 'username', hashLength: accountRecord.password?.length },
            'Sign-in failed: incorrect password'
          );
          return reply.status(401).send({ error: 'Invalid username or password' });
        }

        app.logger.debug(
          { userId: authUser.id, identifier },
          'Password verified successfully'
        );
      } catch (bcryptError) {
        app.logger.error(
          { err: bcryptError, userId: authUser.id, identifier, hashLength: accountRecord.password?.length },
          'Error comparing passwords - hash may be corrupted'
        );
        return reply.status(500).send({ error: 'Authentication error' });
      }

      // Step 5: Create session
      try {
        const sessionToken = randomUUID();
        const sessionId = randomUUID();
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

        app.logger.debug(
          { userId: authUser.id, sessionToken, sessionId, expiresAt },
          'Creating session with generated token'
        );

        const session = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId: authUser.id,
            expiresAt: expiresAt,
            token: sessionToken,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .returning();

        app.logger.info(
          {
            userId: authUser.id,
            identifier,
            identifierType: isEmail ? 'email' : 'username',
            sessionToken: session[0].token,
            sessionId: session[0].id,
            expiresAt: session[0].expiresAt,
            tokenLength: session[0].token.length,
          },
          'Sign-in successful: session created and stored in database'
        );

        // Verify session was stored correctly
        const verifySession = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, sessionToken)
        });

        if (verifySession) {
          app.logger.debug(
            { sessionId: verifySession.id, userId: verifySession.userId, tokenMatch: verifySession.token === sessionToken },
            'Session verification: session found in database'
          );
        } else {
          app.logger.error(
            { sessionToken, sessionId },
            'CRITICAL: Session not found in database after insertion'
          );
        }

        // Set secure HTTP-only cookie with proper cross-origin attributes
        const cookieOptions = [
          `session=${sessionToken}`,
          'HttpOnly',
          'Path=/',
          'SameSite=Lax',
          `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
        ];
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        const setCookieHeader = cookieOptions.join('; ');
        reply.header('Set-Cookie', setCookieHeader);

        app.logger.debug(
          { setCookieHeader: setCookieHeader.substring(0, 100) },
          'Set-Cookie header set'
        );

        // Also set Access-Control headers to allow credentials
        reply.header('Access-Control-Allow-Credentials', 'true');

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
            token: sessionToken,
            expiresAt: expiresAt,
          },
        };
      } catch (sessionError) {
        app.logger.error(
          { err: sessionError, userId: authUser.id, identifier, errorMessage: String(sessionError) },
          'Failed to create session'
        );
        return reply.status(500).send({
          error: 'Failed to create session',
          details: String(sessionError)
        });
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
   * POST /api/auth/email/signin
   * BETA TESTING ENDPOINT - Email-only authentication (no password required)
   *
   * This is a temporary endpoint for beta testing that allows users to sign in
   * with ONLY their email address, bypassing password verification.
   *
   * Session Management:
   * - Creates session in database with 7-day expiration
   * - Sets HTTP-only secure cookie with session token
   * - Uses same cookie format as other signin endpoints (session=token)
   * - Session is validated by requireAuth() middleware on protected endpoints
   *
   * Request body: { email: string }
   * Returns: { user: { id, email, name } }
   * Cookie: session=<token> (HTTP-only, Secure in production)
   *
   * TODO: Remove this endpoint after beta testing is complete
   */
  app.fastify.post('/api/auth/email/signin', async (request: FastifyRequest, reply: FastifyReply) => {
    const email = (request.body as any)?.email;
    app.logger.info({ email }, 'Email-only sign-in attempt (BETA)');

    try {
      // Validate request schema
      const { email: validatedEmail } = EmailOnlySignInSchema.parse(request.body);
      const normalizedEmail = validatedEmail.toLowerCase();

      app.logger.debug({ email: normalizedEmail }, 'Looking up user by email');

      // Look up user in Better Auth table using case-insensitive comparison
      const authUser = await app.db.query.user.findFirst({
        where: sql`LOWER(${authSchema.user.email}) = LOWER(${normalizedEmail})`
      });

      if (!authUser) {
        app.logger.warn({ email: normalizedEmail }, 'Email-only sign-in: user not found');
        return reply.status(404).send({ error: 'No account found with this email address' });
      }

      app.logger.info({ userId: authUser.id, email: normalizedEmail }, 'Email-only sign-in: user found');

      // Get CoinHub user profile by user ID (CRITICAL: must match Better Auth user ID)
      // The users.id field MUST match the user.id field from Better Auth
      app.logger.debug(
        { userId: authUser.id, email: normalizedEmail },
        'Email-only sign-in: Looking up profile by user ID (users.id matches user.id)'
      );

      const coinHubProfile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, authUser.id)
      });

      if (!coinHubProfile) {
        app.logger.warn({ userId: authUser.id, email: normalizedEmail }, 'Email-only sign-in: CoinHub profile not found for user');
        return reply.status(404).send({ error: 'Profile not found - please complete your profile first' });
      }

      app.logger.info(
        { userId: authUser.id, email: normalizedEmail, username: coinHubProfile.username, profileId: coinHubProfile.id },
        'Email-only sign-in: CoinHub profile found with email-based lookup'
      );

      // Create session in Better Auth session table
      const sessionToken = randomUUID();
      const sessionId = randomUUID();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      try {
        app.logger.debug(
          { userId: authUser.id, sessionToken, sessionId, expiresAt },
          'Email-only sign-in: creating session with generated token'
        );

        const session = await app.db
          .insert(authSchema.session)
          .values({
            id: sessionId,
            userId: authUser.id,
            expiresAt,
            token: sessionToken,
            ipAddress: request.ip,
            userAgent: request.headers['user-agent'],
          })
          .returning();

        app.logger.info(
          {
            userId: authUser.id,
            email: normalizedEmail,
            username: coinHubProfile.username,
            sessionId: session[0].id,
            sessionToken: session[0].token,
            expiresAt: session[0].expiresAt,
            tokenLength: session[0].token.length,
          },
          'Email-only sign-in successful: session created and stored in database'
        );

        // Verify session was stored correctly
        const verifySession = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, sessionToken)
        });

        if (verifySession) {
          app.logger.debug(
            { sessionId: verifySession.id, userId: verifySession.userId, tokenMatch: verifySession.token === sessionToken },
            'Email-only sign-in: session verification - session found in database'
          );
        } else {
          app.logger.error(
            { sessionToken, sessionId },
            'CRITICAL: Email-only sign-in - Session not found in database after insertion'
          );
        }

        // Set secure HTTP-only cookie with proper cross-origin attributes
        // Use same cookie format as other signin endpoints for consistency
        const cookieOptions = [
          `session=${sessionToken}`,
          'HttpOnly',
          'Path=/',
          'SameSite=Lax',
          `Max-Age=${7 * 24 * 60 * 60}`, // 7 days
        ];
        if (process.env.NODE_ENV === 'production') {
          cookieOptions.push('Secure');
        }
        const setCookieHeader = cookieOptions.join('; ');
        reply.header('Set-Cookie', setCookieHeader);

        app.logger.debug(
          { setCookieHeader: setCookieHeader.substring(0, 100) },
          'Email-only sign-in: Set-Cookie header set'
        );

        // Also set Access-Control headers to allow credentials
        reply.header('Access-Control-Allow-Credentials', 'true');

        // Generate signed URL for avatar if it exists
        let avatarUrl = coinHubProfile.avatarUrl;
        if (avatarUrl) {
          try {
            const { url } = await app.storage.getSignedUrl(avatarUrl);
            avatarUrl = url;
          } catch (urlError) {
            app.logger.warn({ err: urlError, userId: authUser.id }, 'Failed to generate avatar signed URL');
            avatarUrl = null;
          }
        }

        // Return user data with session token for Authorization header fallback
        return {
          user: {
            id: authUser.id,
            email: authUser.email,
            name: authUser.name,
          },
          profile: {
            id: coinHubProfile.id,
            username: coinHubProfile.username,
            displayName: coinHubProfile.displayName,
            avatarUrl: avatarUrl,
            role: coinHubProfile.role,
          },
          session: {
            token: sessionToken,
            expiresAt,
          },
        };
      } catch (sessionError) {
        app.logger.error(
          { err: sessionError, userId: authUser.id, email: normalizedEmail },
          'Email-only sign-in: failed to create session'
        );
        return reply.status(500).send({ error: 'Failed to create session' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Email-only sign-in: validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error }, 'Email-only sign-in: unexpected error');
      return reply.status(500).send({ error: 'An error occurred during sign-in' });
    }
  });

  /**
   * DEBUG ENDPOINT: GET /api/auth/debug/verify-session/:token
   * Check if a session token exists in the database
   * Helps diagnose session lookup issues
   */
  if (process.env.NODE_ENV !== 'production') {
    app.fastify.get('/api/auth/debug/verify-session/:token', async (request: FastifyRequest, reply: FastifyReply) => {
      const token = (request.params as any).token;
      app.logger.info({ token }, 'DEBUG: Checking if session token exists');

      try {
        const session = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, token)
        });

        if (!session) {
          app.logger.warn({ token }, 'DEBUG: Session token not found in database');
          return {
            found: false,
            token,
            message: 'Session token not found in database'
          };
        }

        app.logger.info(
          { token, userId: session.userId, expiresAt: session.expiresAt },
          'DEBUG: Session token found in database'
        );

        const isExpired = new Date(session.expiresAt) < new Date();

        return {
          found: true,
          token,
          sessionId: session.id,
          userId: session.userId,
          expiresAt: session.expiresAt,
          isExpired,
          message: isExpired ? 'Session found but expired' : 'Session found and valid'
        };
      } catch (error) {
        app.logger.error({ err: error, token }, 'DEBUG: Error checking session');
        return reply.status(500).send({ error: 'Error checking session', details: String(error) });
      }
    });

    /**
     * DEBUG ENDPOINT: GET /api/auth/debug/auth-middleware-status
     * Check what the requireAuth middleware returns
     */
    app.fastify.get('/api/auth/debug/auth-middleware-status', async (request: FastifyRequest, reply: FastifyReply) => {
      const cookies = request.headers.cookie || '';
      const authHeader = request.headers.authorization || '';
      app.logger.info(
        {
          cookieString: cookies.substring(0, 150),
          authHeaderString: authHeader.substring(0, 100)
        },
        'DEBUG: Auth middleware status check'
      );

      const session = await requireAuth(request, reply);
      if (!session) {
        app.logger.warn(
          { cookies, authHeader },
          'DEBUG: requireAuth returned null - no session found'
        );
        return {
          sessionFound: false,
          incomingCookie: cookies.substring(0, 150),
          incomingAuthHeader: authHeader.substring(0, 100),
          message: 'requireAuth returned null'
        };
      }

      app.logger.info(
        { userId: session.user?.id },
        'DEBUG: requireAuth returned a session'
      );
      return {
        sessionFound: true,
        userId: session.user?.id,
        userEmail: session.user?.email,
        incomingCookie: cookies.substring(0, 150),
        incomingAuthHeader: authHeader.substring(0, 100)
      };
    });

    /**
     * DEBUG ENDPOINT: GET /api/debug/session-profile
     * Comprehensive session-to-profile tracing
     * Query params: token (optional - session token) or uses cookie
     * Shows the full chain: token → session → user ID → auth user → CoinHub profile
     */
    app.fastify.get('/api/debug/session-profile', async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | undefined>;
      let sessionToken = query.token;

      // If no token provided, try to extract from request
      if (!sessionToken) {
        sessionToken = extractSessionToken(request);
      }

      if (!sessionToken) {
        return {
          success: false,
          message: 'No session token provided. Use ?token=<token> or send session cookie',
          hint: 'Example: GET /api/debug/session-profile?token=<session-token>'
        };
      }

      app.logger.info(
        { token: sessionToken.substring(0, 20) },
        'DEBUG: Session-to-profile trace started'
      );

      try {
        // Step 1: Look up session
        app.logger.info({ token: sessionToken.substring(0, 20) }, 'DEBUG: Step 1 - Looking up session by token');
        const sessionRecord = await app.db.query.session.findFirst({
          where: eq(authSchema.session.token, sessionToken)
        });

        if (!sessionRecord) {
          app.logger.warn({ token: sessionToken.substring(0, 20) }, 'DEBUG: Session not found');
          return {
            success: false,
            token: sessionToken.substring(0, 20),
            step: 1,
            message: 'Session token not found in database',
            chain: {
              token: 'NOT_FOUND'
            }
          };
        }

        app.logger.info(
          { token: sessionToken.substring(0, 20), sessionUserId: sessionRecord.userId },
          'DEBUG: Step 1 - Session found'
        );

        // Step 2: Check session expiration
        const isExpired = new Date(sessionRecord.expiresAt) < new Date();
        if (isExpired) {
          app.logger.warn({ expiresAt: sessionRecord.expiresAt }, 'DEBUG: Session is expired');
          return {
            success: false,
            token: sessionToken.substring(0, 20),
            step: 2,
            message: 'Session is expired',
            chain: {
              token: sessionToken.substring(0, 20),
              sessionId: sessionRecord.id,
              sessionUserId: sessionRecord.userId,
              expiresAt: sessionRecord.expiresAt,
              isExpired: true
            }
          };
        }

        // Step 3: Get auth user record
        app.logger.info(
          { userId: sessionRecord.userId },
          'DEBUG: Step 3 - Looking up auth user by ID'
        );
        const authUser = await app.db.query.user.findFirst({
          where: eq(authSchema.user.id, sessionRecord.userId)
        });

        if (!authUser) {
          app.logger.warn({ userId: sessionRecord.userId }, 'DEBUG: Auth user not found');
          return {
            success: false,
            token: sessionToken.substring(0, 20),
            step: 3,
            message: 'Auth user not found for session userId',
            chain: {
              token: sessionToken.substring(0, 20),
              sessionId: sessionRecord.id,
              sessionUserId: sessionRecord.userId,
              authUserFound: false
            }
          };
        }

        app.logger.info(
          { userId: authUser.id, email: authUser.email },
          'DEBUG: Step 3 - Auth user found'
        );

        // Step 4: Get CoinHub profile
        app.logger.info(
          { userId: authUser.id },
          'DEBUG: Step 4 - Looking up CoinHub profile by user ID'
        );
        const coinHubProfile = await app.db.query.users.findFirst({
          where: eq(schema.users.id, authUser.id)
        });

        if (!coinHubProfile) {
          app.logger.warn({ userId: authUser.id }, 'DEBUG: CoinHub profile not found');
          return {
            success: false,
            token: sessionToken.substring(0, 20),
            step: 4,
            message: 'CoinHub profile not found for auth user',
            chain: {
              token: sessionToken.substring(0, 20),
              sessionId: sessionRecord.id,
              sessionUserId: sessionRecord.userId,
              authUserId: authUser.id,
              authUserEmail: authUser.email,
              coinHubProfileFound: false
            }
          };
        }

        app.logger.info(
          { userId: coinHubProfile.id, username: coinHubProfile.username, email: coinHubProfile.email },
          'DEBUG: Step 4 - CoinHub profile found'
        );

        // Step 5: Verify chain consistency
        const chainConsistent =
          sessionRecord.userId === authUser.id &&
          authUser.id === coinHubProfile.id &&
          authUser.email === coinHubProfile.email;

        app.logger.info(
          {
            sessionUserId: sessionRecord.userId,
            authUserId: authUser.id,
            profileId: coinHubProfile.id,
            consistent: chainConsistent
          },
          'DEBUG: Step 5 - Chain verification'
        );

        return {
          success: true,
          token: sessionToken.substring(0, 20),
          chain: {
            token: sessionToken.substring(0, 20),
            session: {
              id: sessionRecord.id,
              userId: sessionRecord.userId,
              expiresAt: sessionRecord.expiresAt,
              isExpired: false
            },
            authUser: {
              id: authUser.id,
              email: authUser.email,
              name: authUser.name
            },
            coinHubProfile: {
              id: coinHubProfile.id,
              username: coinHubProfile.username,
              displayName: coinHubProfile.displayName,
              email: coinHubProfile.email,
              role: coinHubProfile.role
            },
            chainConsistent,
            warning: chainConsistent ? null : 'CHAIN INCONSISTENCY DETECTED - IDs do not match!'
          }
        };
      } catch (error) {
        app.logger.error({ err: error, token: sessionToken.substring(0, 20) }, 'DEBUG: Error during trace');
        return {
          success: false,
          token: sessionToken.substring(0, 20),
          error: String(error),
          message: 'Error occurred during session-to-profile trace'
        };
      }
    });
  }

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
