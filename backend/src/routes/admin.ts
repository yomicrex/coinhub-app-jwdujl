import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ilike, or, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { randomUUID } from 'crypto';
import { validateSession } from '../utils/auth-utils.js';

export function registerAdminRoutes(app: App) {
  /**
   * GET /api/admin/accounts
   * List all user accounts with core details
   * Returns: { accounts: [ { userId, email, username, displayName, role, createdAt } ] }
   * Ordered by created_at DESC (newest first)
   * Requires authentication
   */
  app.fastify.get('/api/admin/accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Admin: Fetching list of all user accounts');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to accounts list');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Get all users from CoinHub users table with their details
      const allAccounts = await app.db.query.users.findMany({
        columns: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          createdAt: true,
        },
        orderBy: (users) => users.createdAt,
      });

      // Sort by createdAt descending (newest first)
      allAccounts.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      // Format response with camelCase
      const accounts = allAccounts.map((user) => ({
        userId: user.id,
        email: user.email,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        createdAt: user.createdAt,
      }));

      app.logger.info(
        { totalAccounts: accounts.length },
        'Admin: Account list fetched successfully'
      );

      return { accounts, total: accounts.length };
    } catch (error) {
      app.logger.error(
        { err: error },
        'Admin: Failed to fetch account list'
      );
      return reply.status(500).send({ error: 'Failed to fetch account list', details: String(error) });
    }
  });

  /**
   * GET /api/admin/verify-account/:email
   * Verify account information for a specific email
   * Returns: user record, CoinHub user record, and all accounts with password info
   * Admin only endpoint - helps diagnose email-to-username mapping issues
   */
  app.fastify.get('/api/admin/verify-account/:email', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.params as { email: string };

    app.logger.info({ email }, 'Admin: Verifying account information');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn({ email }, 'Admin: Unauthorized access attempt to verify account');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Get Better Auth user record
      const authUser = await app.db.query.user.findFirst({
        where: eq(authSchema.user.email, email),
      });

      if (!authUser) {
        app.logger.warn({ email }, 'Admin: Auth user not found');
        return reply.status(404).send({ error: 'User not found', email });
      }

      // Get CoinHub user record
      const coinHubUser = await app.db.query.users.findFirst({
        where: eq(schema.users.id, authUser.id),
      });

      if (!coinHubUser) {
        app.logger.warn({ userId: authUser.id, email }, 'Admin: CoinHub user not found');
        return reply.status(404).send({ error: 'CoinHub user not found', userId: authUser.id });
      }

      // Get all accounts for this user
      const allAccounts = await app.db.query.account.findMany({
        where: eq(authSchema.account.userId, authUser.id),
      });

      // Format account info (hide sensitive password data)
      const accountsInfo = allAccounts.map((account) => ({
        id: account.id,
        providerId: account.providerId,
        hasPassword: !!account.password,
        createdAt: account.createdAt,
      }));

      app.logger.info(
        { email, userId: authUser.id, totalAccounts: allAccounts.length },
        'Admin: Account verification completed'
      );

      return {
        authUser: {
          id: authUser.id,
          email: authUser.email,
          name: authUser.name,
          emailVerified: authUser.emailVerified,
        },
        coinHubUser: {
          id: coinHubUser.id,
          email: coinHubUser.email,
          username: coinHubUser.username,
          displayName: coinHubUser.displayName,
          role: coinHubUser.role,
        },
        accounts: accountsInfo,
        totalAccounts: allAccounts.length,
      };
    } catch (error) {
      app.logger.error(
        { err: error, email },
        'Admin: Failed to verify account'
      );
      return reply.status(500).send({ error: 'Failed to verify account', details: String(error) });
    }
  });

  /**
   * GET /api/admin/check-duplicate-accounts
   * Find all users with duplicate/similar emails (case-insensitive)
   * Groups users by normalized email and shows potential duplicates
   * Admin only endpoint - helps identify account consolidation issues
   */
  app.fastify.get('/api/admin/check-duplicate-accounts', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Admin: Checking for duplicate accounts');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to check duplicate accounts');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Get all users from CoinHub users table
      const allUsers = await app.db.query.users.findMany({
        columns: {
          id: true,
          email: true,
          username: true,
          displayName: true,
          role: true,
          createdAt: true,
        },
      });

      // Group users by normalized email (lowercase)
      const emailGroups: Record<string, typeof allUsers> = {};

      for (const user of allUsers) {
        const normalizedEmail = user.email.toLowerCase();
        if (!emailGroups[normalizedEmail]) {
          emailGroups[normalizedEmail] = [];
        }
        emailGroups[normalizedEmail].push(user);
      }

      // Filter to only groups with duplicates
      const duplicateAccounts = Object.entries(emailGroups)
        .filter(([_, users]) => users.length > 1)
        .map(([email, users]) => ({
          email,
          count: users.length,
          accounts: users.map((user) => ({
            userId: user.id,
            username: user.username,
            displayName: user.displayName,
            email: user.email,
            role: user.role,
            createdAt: user.createdAt,
          })),
        }))
        .sort((a, b) => b.count - a.count);

      app.logger.info(
        { totalUsers: allUsers.length, duplicateGroups: duplicateAccounts.length },
        'Admin: Duplicate account check completed'
      );

      return {
        totalUsers: allUsers.length,
        duplicateGroups: duplicateAccounts.length,
        duplicates: duplicateAccounts,
        message: duplicateAccounts.length === 0 ? 'No duplicate accounts found' : `Found ${duplicateAccounts.length} groups with duplicate emails`,
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'Admin: Failed to check duplicate accounts'
      );
      return reply.status(500).send({ error: 'Failed to check duplicate accounts', details: String(error) });
    }
  });

  /**
   * GET /api/admin/users
   * List all users with their authentication and profile information
   *
   * Returns: { users: [ { id, email, emailVerified, username, displayName, hasProfile, createdAt } ] }
   * Ordered by createdAt descending (newest first)
   *
   * Includes:
   * - All Better Auth users
   * - CoinHub profile information if they have one (hasProfile boolean)
   * - Email verification status
   *
   * Note: Password data is never exposed
   */
  app.fastify.get('/api/admin/users', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Admin: Fetching list of all users with profile information');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to users list');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Step 1: Get all Better Auth users
      const authUsers = await app.db.query.user.findMany({
        columns: {
          id: true,
          email: true,
          emailVerified: true,
          createdAt: true,
        },
      });

      app.logger.info({ totalAuthUsers: authUsers.length }, 'Admin: Found auth users');

      // Step 2: For each auth user, check if they have a CoinHub profile
      const usersWithProfiles = [];

      for (const authUser of authUsers) {
        try {
          const coinHubProfile = await app.db.query.users.findFirst({
            where: eq(schema.users.id, authUser.id),
            columns: {
              username: true,
              displayName: true,
            },
          });

          usersWithProfiles.push({
            id: authUser.id,
            email: authUser.email,
            emailVerified: authUser.emailVerified || false,
            username: coinHubProfile?.username || null,
            displayName: coinHubProfile?.displayName || null,
            hasProfile: !!coinHubProfile,
            createdAt: authUser.createdAt,
          });
        } catch (e) {
          app.logger.warn(
            { userId: authUser.id, email: authUser.email, err: e },
            'Admin: Error fetching CoinHub profile for user'
          );

          // Still include user without profile info
          usersWithProfiles.push({
            id: authUser.id,
            email: authUser.email,
            emailVerified: authUser.emailVerified || false,
            username: null,
            displayName: null,
            hasProfile: false,
            createdAt: authUser.createdAt,
          });
        }
      }

      // Step 3: Sort by createdAt descending (newest first)
      usersWithProfiles.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      app.logger.info(
        { totalUsers: usersWithProfiles.length, usersWithProfiles: usersWithProfiles.filter(u => u.hasProfile).length },
        'Admin: User list fetched successfully'
      );

      return {
        users: usersWithProfiles,
        count: usersWithProfiles.length,
        usersWithProfiles: usersWithProfiles.filter(u => u.hasProfile).length,
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'Admin: Failed to fetch user list'
      );
      return reply.status(500).send({ error: 'Failed to fetch user list', details: String(error) });
    }
  });

  /**
   * GET /api/admin/users/list
   * List all user accounts with their details
   *
   * Returns: { users: [ { id, username, email, displayName, createdAt, emailVerified } ] }
   * Ordered by createdAt descending (newest first)
   *
   * Note: Password data is never exposed
   * Only non-sensitive user profile information is returned
   */
  app.fastify.get('/api/admin/users/list', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info('Admin: Fetching list of all users');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to users list endpoint');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Get all users from CoinHub users table
      const allUsers = await app.db.query.users.findMany({
        columns: {
          id: true,
          username: true,
          email: true,
          displayName: true,
          createdAt: true,
          updatedAt: true,
        }
      });

      // Get email verification status from Better Auth user table
      const usersWithVerification = [];

      for (const user of allUsers) {
        try {
          const authUser = await app.db.query.user.findFirst({
            where: eq(authSchema.user.id, user.id),
            columns: {
              emailVerified: true,
            }
          });

          usersWithVerification.push({
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
            emailVerified: authUser?.emailVerified || false,
          });
        } catch (e) {
          app.logger.warn(
            { userId: user.id, username: user.username, err: e },
            'Admin: Failed to fetch auth user details'
          );
          // Still include user without email verification status
          usersWithVerification.push({
            id: user.id,
            username: user.username,
            email: user.email,
            displayName: user.displayName,
            createdAt: user.createdAt,
            emailVerified: false,
          });
        }
      }

      // Sort by createdAt descending (newest first)
      usersWithVerification.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });

      app.logger.info(
        { totalUsers: usersWithVerification.length },
        'Admin: User list fetched successfully'
      );

      return {
        users: usersWithVerification,
        count: usersWithVerification.length,
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'Admin: Failed to fetch user list'
      );
      return reply.status(500).send({ error: 'Failed to fetch user list', details: String(error) });
    }
  });


  /**
   * POST /api/admin/users/:username/reset-password
   * Admin endpoint to directly reset a user's password
   *
   * Path parameter: username (string) - The username of the account to reset password for
   * Request body: { password: string } OR { newPassword: string } - New password (must be at least 8 characters)
   *
   * Behavior:
   * 1. Hashes password with bcrypt (10 rounds)
   * 2. Updates or creates credential account with hashed password
   * 3. Invalidates all existing sessions for the user (forces re-login)
   * 4. Verifies password was stored correctly in database
   *
   * Returns: { success: true, message: "Password reset successfully for user {username}" }
   * Returns 404 if user not found: { error: "User not found" }
   * Returns 400 if password validation fails
   * Returns 500 if database error occurs or hash generation fails
   */
  app.fastify.post('/api/admin/users/:username/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };
    const requestBody = request.body as Record<string, any>;

    app.logger.info({ username }, 'Admin: Password reset requested for user');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn({ username }, 'Admin: Unauthorized access attempt to reset password');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Accept both 'password' and 'newPassword' field names
      const ResetPasswordSchema = z.object({
      password: z.string().min(8, 'Password must be at least 8 characters').optional(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
    }).refine(
      (data) => data.password || data.newPassword,
      { message: 'Either password or newPassword must be provided' }
    );
      const body = ResetPasswordSchema.parse(requestBody);
      const newPasswordValue = body.password || body.newPassword;

      if (!newPasswordValue) {
        app.logger.warn({ username }, 'Admin: No password provided in request');
        return reply.status(400).send({ error: 'Password or newPassword field is required' });
      }

      // Step 1: Find the user by username
      const coinHubUser = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!coinHubUser) {
        app.logger.warn({ username }, 'Admin: User not found for password reset');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId: coinHubUser.id, username }, 'Admin: User found, resetting password');

      // Step 2: Hash the new password with bcrypt (rounds: 10)
      // This matches the standard bcrypt configuration used by authentication systems
      const bcrypt = await import('bcryptjs') as any;
      app.logger.debug({ username, userId: coinHubUser.id }, 'Admin: Hashing new password with bcrypt');
      const hashedPassword = await bcrypt.hash(newPasswordValue, 10);

      // Validate the hash format
      if (!hashedPassword || !/^\$2[aby]\$\d+\$/.test(hashedPassword)) {
        app.logger.error(
          { username, userId: coinHubUser.id, hashStart: hashedPassword?.substring(0, 20) },
          'Admin: Generated hash has invalid format'
        );
        return reply.status(500).send({ error: 'Failed to generate password hash' });
      }

      app.logger.debug(
        { username, userId: coinHubUser.id, hashLength: hashedPassword.length },
        'Admin: Password hash generated successfully'
      );

      // Step 3: Find or create the credential account
      let credentialAccount = await app.db.query.account.findFirst({
        where: and(
          eq(authSchema.account.userId, coinHubUser.id),
          eq(authSchema.account.providerId, 'credential')
        ),
      });

      // If credential account not found, look for any account with a password
      if (!credentialAccount) {
        app.logger.debug(
          { userId: coinHubUser.id, username },
          'Admin: No credential account found, checking for any account with password'
        );
        const allAccounts = await app.db.query.account.findMany({
          where: eq(authSchema.account.userId, coinHubUser.id)
        });

        app.logger.info(
          { userId: coinHubUser.id, username, totalAccounts: allAccounts.length, providers: allAccounts.map(a => a.providerId) },
          'Admin: All accounts for user'
        );

        // Find the first account with a password
        credentialAccount = allAccounts.find(a => a.password) || null;
        if (credentialAccount) {
          app.logger.info(
            { userId: coinHubUser.id, username, providerId: credentialAccount.providerId },
            'Admin: Found account with password using provider: ' + credentialAccount.providerId
          );
        }
      }

      if (credentialAccount) {
        // Update existing account with new password
        const updateResult = await app.db
          .update(authSchema.account)
          .set({ password: hashedPassword, updatedAt: new Date() })
          .where(eq(authSchema.account.id, credentialAccount.id))
          .returning();

        app.logger.info(
          { userId: coinHubUser.id, username, accountId: credentialAccount.id, providerId: credentialAccount.providerId, updated: !!updateResult.length },
          'Admin: Password updated in account'
        );

        // Verify the password was stored correctly
        const verifyAccount = await app.db.query.account.findFirst({
          where: eq(authSchema.account.id, credentialAccount.id)
        });
        if (verifyAccount && verifyAccount.password) {
          app.logger.debug(
            { userId: coinHubUser.id, username, storedHashLength: verifyAccount.password.length, isValidBcrypt: /^\$2[aby]\$\d+\$/.test(verifyAccount.password) },
            'Admin: Password verification - stored hash is valid'
          );
        } else {
          app.logger.error(
            { userId: coinHubUser.id, username },
            'Admin: Password verification failed - hash not stored'
          );
        }
      } else {
        // Create new credential account as fallback
        const newAccountId = randomUUID();
        await app.db.insert(authSchema.account).values({
          id: newAccountId,
          userId: coinHubUser.id,
          accountId: `credential-${coinHubUser.id}`,
          providerId: 'credential',
          password: hashedPassword,
        });

        app.logger.info(
          { userId: coinHubUser.id, username, newAccountId },
          'Admin: Created new credential account with password'
        );

        // Verify the password was stored correctly
        const verifyNewAccount = await app.db.query.account.findFirst({
          where: eq(authSchema.account.id, newAccountId)
        });
        if (verifyNewAccount && verifyNewAccount.password) {
          app.logger.debug(
            { userId: coinHubUser.id, username, storedHashLength: verifyNewAccount.password.length, isValidBcrypt: /^\$2[aby]\$\d+\$/.test(verifyNewAccount.password) },
            'Admin: New account password verification - stored hash is valid'
          );
        } else {
          app.logger.error(
            { userId: coinHubUser.id, username, newAccountId },
            'Admin: New account password verification failed - hash not stored'
          );
        }
      }

      // Step 4: Invalidate all existing sessions for security
      try {
        await app.db
          .delete(authSchema.session)
          .where(eq(authSchema.session.userId, coinHubUser.id));

        app.logger.info(
          { userId: coinHubUser.id, username },
          'Admin: Invalidated all sessions for user after password reset'
        );
      } catch (sessionErr) {
        app.logger.warn(
          { err: sessionErr, userId: coinHubUser.id, username },
          'Admin: Failed to invalidate sessions after password reset'
        );
      }

      return {
        success: true,
        message: `Password reset successfully for user ${username}`,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, username }, 'Admin: Password validation failed');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }

      app.logger.error(
        { err: error, username },
        'Admin: Failed to reset user password'
      );
      return reply.status(500).send({ error: 'Failed to reset password' });
    }
  });

  /**
   * POST /api/admin/verify-password/:username
   * Admin endpoint to verify that a user's password is working correctly
   * Useful for testing after password resets
   *
   * Path parameter: username (string) - The username to verify
   * Request body: { password: string } - The password to test
   *
   * Returns: { verified: true, message: "Password verified successfully" }
   * Returns: { verified: false, message: "Password verification failed" }
   * Returns 404 if user not found
   */
  app.fastify.post('/api/admin/verify-password/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };
    const { password } = request.body as { password?: string };

    app.logger.info({ username }, 'Admin: Password verification requested');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn({ username }, 'Admin: Unauthorized access attempt to verify password');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      if (!password) {
        app.logger.warn({ username }, 'Admin: No password provided for verification');
        return reply.status(400).send({ error: 'Password is required' });
      }

      // Find the user by username
      const coinHubUser = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!coinHubUser) {
        app.logger.warn({ username }, 'Admin: User not found for password verification');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Get all accounts for this user
      const allAccounts = await app.db.query.account.findMany({
        where: eq(authSchema.account.userId, coinHubUser.id)
      });

      // Find accounts with passwords
      const accountsWithPassword = allAccounts.filter(a => a.password);

      if (accountsWithPassword.length === 0) {
        app.logger.warn({ username, userId: coinHubUser.id }, 'Admin: No accounts with passwords found');
        return {
          verified: false,
          message: 'No password accounts found for this user',
          accountsWithPassword: 0,
          totalAccounts: allAccounts.length
        };
      }

      // Test password against each account
      const bcrypt = await import('bcryptjs') as any;
      const verificationResults = [];

      for (const account of accountsWithPassword) {
        try {
          const isValid = /^\$2[aby]\$\d+\$/.test(account.password);
          const match = await bcrypt.compare(password, account.password);

          verificationResults.push({
            accountId: account.id,
            providerId: account.providerId,
            hashValid: isValid,
            passwordMatch: match
          });

          app.logger.debug(
            { username, userId: coinHubUser.id, providerId: account.providerId, match },
            `Admin: Password test for ${account.providerId} account`
          );
        } catch (e) {
          verificationResults.push({
            accountId: account.id,
            providerId: account.providerId,
            error: String(e).substring(0, 100)
          });

          app.logger.error(
            { username, userId: coinHubUser.id, providerId: account.providerId, err: e },
            'Admin: Error verifying password'
          );
        }
      }

      const successfulMatches = verificationResults.filter(r => r.passwordMatch).length;
      const verified = successfulMatches > 0;

      return {
        verified,
        message: verified ? 'Password verified successfully' : 'Password verification failed',
        username,
        userId: coinHubUser.id,
        accountsWithPassword: accountsWithPassword.length,
        verificationResults,
        successfulMatches
      };
    } catch (error) {
      app.logger.error(
        { err: error, username },
        'Admin: Password verification error'
      );
      return reply.status(500).send({ error: 'Password verification error' });
    }
  });

  /**
   * POST /api/admin/reset-all-passwords
   * CRITICAL FIX: Reset ALL user passwords in the database to "123456"
   *
   * This endpoint is used to fix corrupted password hashes across all accounts
   * All users will be reset to password: "123456"
   *
   * WARNING: This is a destructive operation that resets all passwords
   *
   * Returns: { success: true, usersUpdated: number, message: "All passwords reset to 123456" }
   */
  app.fastify.post('/api/admin/reset-all-passwords', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.warn('CRITICAL: Reset-all-passwords operation started - resetting ALL user passwords to 123456');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to reset all passwords');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      const bcrypt = await import('bcryptjs') as any;
      const defaultPassword = '123456';
      let usersUpdated = 0;
      const updateDetails = [];

      // Step 1: Get all CoinHub users
      const allUsers = await app.db.query.users.findMany();
      app.logger.info({ totalUsers: allUsers.length }, 'Admin: Found all users for reset');

      // Step 2: For each user, reset password
      for (const coinHubUser of allUsers) {
        const userId = String(coinHubUser.id);
        const username = String(coinHubUser.username);

        try {
          // Hash the default password
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);

          // Validate hash format
          if (!hashedPassword || !/^\$2[aby]\$\d+\$/.test(hashedPassword)) {
            app.logger.error(
              { username, userId },
              'Admin: Failed to generate valid hash for default password'
            );
            updateDetails.push({
              username,
              status: 'failed',
              reason: 'Failed to generate password hash'
            });
            continue;
          }

          // Find credential account or any account
          let targetAccount = await app.db.query.account.findFirst({
            where: and(
              eq(authSchema.account.userId, userId),
              eq(authSchema.account.providerId, 'credential')
            )
          });

          // If no credential account, look for any account with password
          if (!targetAccount) {
            const allAccounts = await app.db.query.account.findMany({
              where: eq(authSchema.account.userId, userId)
            });
            targetAccount = allAccounts.find(a => a.password);
          }

          // If still no account, create a credential account
          if (!targetAccount) {
            const newAccountId = randomUUID();
            await app.db.insert(authSchema.account).values({
              id: newAccountId,
              userId,
              accountId: `credential-${userId}`,
              providerId: 'credential',
              password: hashedPassword,
            });

            app.logger.info(
              { username, userId, newAccountId },
              'Admin: Created credential account with default password'
            );

            usersUpdated++;
            updateDetails.push({
              username,
              status: 'created',
              action: 'created_credential_account'
            });
          } else {
            // Update existing account with new password
            await app.db
              .update(authSchema.account)
              .set({ password: hashedPassword, updatedAt: new Date() })
              .where(eq(authSchema.account.id, targetAccount.id));

            app.logger.info(
              { username, userId, accountId: targetAccount.id },
              'Admin: Password reset to default (123456)'
            );

            usersUpdated++;
            updateDetails.push({
              username,
              status: 'updated',
              action: 'reset_password'
            });
          }

          // Invalidate all sessions for this user
          try {
            await app.db
              .delete(authSchema.session)
              .where(eq(authSchema.session.userId, userId));
          } catch (e) {
            app.logger.warn(
              { username, err: e },
              'Admin: Failed to invalidate sessions'
            );
          }
        } catch (userError) {
          app.logger.error(
            { err: userError, username, userId },
            'Admin: Error resetting password for user'
          );
          updateDetails.push({
            username,
            status: 'error',
            reason: String(userError).substring(0, 100)
          });
        }
      }

      app.logger.warn(
        { usersUpdated, totalUsers: allUsers.length },
        'CRITICAL: Reset-all-passwords operation completed'
      );

      return {
        success: true,
        usersUpdated,
        totalUsers: allUsers.length,
        message: `All passwords reset to 123456. Updated ${usersUpdated} out of ${allUsers.length} users.`,
        details: updateDetails,
        defaultPassword: '123456'
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'CRITICAL: Reset-all-passwords operation failed'
      );
      return reply.status(500).send({
        error: 'Reset-all-passwords operation failed',
        details: String(error)
      });
    }
  });

  /**
   * POST /api/admin/fix-all-passwords
   * Admin utility to find and fix all accounts with corrupted/invalid password data
   *
   * Identifies accounts where:
   * - Password hash is empty/null
   * - Password hash is not in valid bcrypt format
   * - Password verification fails
   *
   * Resets all affected accounts to: "TempPass123!"
   *
   * Returns: { fixed: ["username1", "username2"], count: 2, details: [...] }
   */
  app.fastify.post('/api/admin/fix-all-passwords', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.warn('Admin: Fix-all-passwords utility started - scanning for corrupted accounts');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to fix all passwords');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      const bcrypt = await import('bcryptjs') as any;
      const tempPassword = 'TempPass123!';
      const fixedUsernames = [];
      const fixDetails = [];

      // Step 1: Get all CoinHub users
      const allUsers = await app.db.query.users.findMany();
      app.logger.info({ totalUsers: allUsers.length }, 'Admin: Scanning all users for corrupted passwords');

      // Step 2: For each user, check their accounts
      for (const coinHubUser of allUsers) {
        const userId = String(coinHubUser.id);
        const username = String(coinHubUser.username);

        try {

          // Get the Better Auth user
          const authUser = await app.db.query.user.findFirst({
            where: eq(authSchema.user.id, userId)
          });

          if (!authUser) {
            app.logger.debug(
              { userId, username },
              'Admin: Auth user not found'
            );
            continue;
          }

          // Get all accounts for this user
          const allAccounts = await app.db.query.account.findMany({
            where: eq(authSchema.account.userId, userId)
          });

          let isCorrupted = false;
          let corruptionReason = '';

          // Check if accounts have password issues
          const accountsWithPassword = allAccounts.filter(a => a.password);

          if (accountsWithPassword.length === 0) {
            isCorrupted = true;
            corruptionReason = 'No accounts with passwords found';
          } else {
            // Check if any password hash is invalid
            for (const account of accountsWithPassword) {
              const isValidBcrypt = /^\$2[aby]\$\d+\$/.test(account.password);

              if (!isValidBcrypt) {
                isCorrupted = true;
                corruptionReason = `Account ${account.id} has invalid bcrypt format`;
                break;
              }

              // Try to compare with a test password to verify hash integrity
              try {
                await bcrypt.compare('test', account.password);
              } catch (e) {
                isCorrupted = true;
                corruptionReason = `Account ${account.id} hash comparison failed: ${String(e).substring(0, 50)}`;
                break;
              }
            }
          }

          // If corrupted, reset the password
          if (isCorrupted) {
            app.logger.info(
              { userId, username, reason: corruptionReason },
              'Admin: Found corrupted password account, resetting'
            );

            // Hash the temporary password
            const hashedTempPassword = await bcrypt.hash(tempPassword, 10);

            // Validate hash format
            if (!/^\$2[aby]\$\d+\$/.test(hashedTempPassword)) {
              app.logger.error(
                { username },
                'Admin: Failed to generate valid hash for temporary password'
              );
              fixDetails.push({
                username,
                status: 'failed',
                reason: 'Failed to generate password hash'
              });
              continue;
            }

            // Find credential account or create one
            let targetAccount = allAccounts.find(a => a.providerId === 'credential');

            if (!targetAccount) {
              // Find any account with password
              targetAccount = accountsWithPassword[0];

              if (!targetAccount) {
                // Create new credential account
                const newAccountId = randomUUID();
                await app.db.insert(authSchema.account).values({
                  id: newAccountId,
                  userId,
                  accountId: `credential-${userId}`,
                  providerId: 'credential',
                  password: hashedTempPassword,
                });

                app.logger.info(
                  { username, newAccountId },
                  'Admin: Created new credential account with temp password'
                );

                fixedUsernames.push(username);
                fixDetails.push({
                  username,
                  status: 'fixed',
                  action: 'created_new_account',
                  tempPassword
                });
                continue;
              }
            }

            // Update the target account with temporary password
            await app.db
              .update(authSchema.account)
              .set({ password: hashedTempPassword, updatedAt: new Date() })
              .where(eq(authSchema.account.id, targetAccount.id));

            app.logger.info(
              { username, accountId: targetAccount.id },
              'Admin: Password reset to temporary password'
            );

            // Invalidate all sessions
            try {
              await app.db
                .delete(authSchema.session)
                .where(eq(authSchema.session.userId, userId));
            } catch (e) {
              app.logger.warn(
                { username, err: e },
                'Admin: Failed to invalidate sessions'
              );
            }

            fixedUsernames.push(username);
            fixDetails.push({
              username,
              status: 'fixed',
              action: 'reset_password',
              tempPassword,
              corruptionReason
            });
          }
        } catch (userError) {
          app.logger.error(
            { err: userError, username },
            'Admin: Error processing user during fix-all-passwords'
          );
          fixDetails.push({
            username,
            status: 'error',
            reason: String(userError).substring(0, 100)
          });
        }
      }

      app.logger.info(
        { fixedCount: fixedUsernames.length, usernames: fixedUsernames },
        'Admin: Fix-all-passwords completed'
      );

      return {
        success: true,
        fixed: fixedUsernames,
        count: fixedUsernames.length,
        details: fixDetails,
        tempPassword: 'TempPass123!',
        message: `Fixed ${fixedUsernames.length} accounts with corrupted passwords. Users must change these temporary passwords on next login.`
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'Admin: Fix-all-passwords utility failed'
      );
      return reply.status(500).send({ error: 'Fix-all-passwords utility failed', details: String(error) });
    }
  });

  /**
   * POST /api/admin/grant-admin-access
   * Grant admin access to a user by email
   *
   * This endpoint is accessible to ANY authenticated user (for development/testing purposes)
   * and allows granting admin privileges to any user account via their email address.
   *
   * Body: { email: string }
   * Returns: { success: true, message: string, userId: string, email: string }
   * Returns 404 if user not found
   */
  app.fastify.post('/api/admin/grant-admin-access', async (request: FastifyRequest, reply: FastifyReply) => {
    const { email } = request.body as { email?: string };

    app.logger.info({ email }, 'Admin: Grant admin access request');

    try {
      // Validate session - any authenticated user can grant admin access (for dev/testing)
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn({ email }, 'Admin: Unauthorized access attempt to grant admin access');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      if (!email || typeof email !== 'string') {
        app.logger.warn({ email }, 'Admin: Invalid email provided for grant admin access');
        return reply.status(400).send({ error: 'Email is required and must be a valid string' });
      }

      // Find user by email
      const targetUser = await app.db.query.users.findFirst({
        where: eq(schema.users.email, email),
        columns: { id: true, username: true, email: true, role: true },
      });

      if (!targetUser) {
        app.logger.warn({ email }, 'Admin: User not found for admin grant');
        return reply.status(404).send({ message: 'User not found' });
      }

      // Update user role to admin
      const updatedUser = await app.db
        .update(schema.users)
        .set({ role: 'admin', updatedAt: new Date() })
        .where(eq(schema.users.id, targetUser.id))
        .returning({
          id: schema.users.id,
          email: schema.users.email,
          username: schema.users.username,
          role: schema.users.role,
        });

      app.logger.info(
        { userId: targetUser.id, email, username: targetUser.username, updatedRole: updatedUser[0]?.role },
        'Admin: Admin access granted to user'
      );

      return {
        success: true,
        message: `Admin access granted to user ${targetUser.username}`,
        userId: targetUser.id,
        email: targetUser.email,
        username: targetUser.username,
        previousRole: targetUser.role,
        newRole: 'admin',
      };
    } catch (error) {
      app.logger.error(
        { err: error, email },
        'Admin: Failed to grant admin access'
      );
      return reply.status(500).send({
        error: 'Failed to grant admin access',
        details: String(error),
      });
    }
  });

  /**
   * DELETE /api/admin/delete-all-users
   * DESTRUCTIVE: Deletes ALL user accounts and all associated data from the system
   *
   * This endpoint wipes the following data completely:
   * - All user profiles from the CoinHub users table
   * - All coins posted by users
   * - All coin images
   * - All trades (including offers, messages, shipping)
   * - All comments on coins
   * - All likes on coins
   * - All follow relationships
   * - All trade reports
   * - All Better Auth accounts and sessions
   *
   * WARNING: This is a PERMANENT, IRREVERSIBLE operation!
   *
   * Requires: Authentication + Admin role verification
   * Returns: { success: true, deletedCount: number, message: string }
   */
  app.fastify.delete('/api/admin/delete-all-users', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.warn('CRITICAL: Delete-all-users operation started - preparing to wipe ALL user data');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn('Admin: Unauthorized access attempt to delete all users');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Verify user is admin
      const adminUser = await app.db.query.users.findFirst({
        where: eq(schema.users.id, sessionData.user.id),
        columns: { role: true },
      });

      if (!adminUser || adminUser.role !== 'admin') {
        app.logger.warn(
          { userId: sessionData.user.id, userRole: adminUser?.role },
          'Admin: Non-admin user attempted to delete all users'
        );
        return reply.status(403).send({
          error: 'Forbidden - admin access required',
          message: 'Admin access required. Use POST /api/admin/grant-admin-access to grant yourself admin privileges first.',
          grantAdminEndpoint: 'POST /api/admin/grant-admin-access',
        });
      }

      app.logger.warn('CRITICAL: Delete-all-users - Admin verification passed, proceeding with data deletion');

      const deletedCounts: Record<string, number> = {};

      // Step 1: Delete from Better Auth tables FIRST (before deleting CoinHub users)
      // This ensures we clean up all authentication data

      // Delete sessions (references user)
      try {
        const result = await app.db.delete(authSchema.session);
        deletedCounts.sessions = 1; // Drizzle doesn't return count, mark as attempted
        app.logger.info({ deletedSessions: deletedCounts.sessions }, 'Admin: Deleted all sessions from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting sessions');
        deletedCounts.sessions = 0;
      }

      // Delete verification codes (no user reference, safe to delete)
      try {
        const result = await app.db.delete(authSchema.verification);
        deletedCounts.verifications = 1;
        app.logger.info({ deletedVerifications: deletedCounts.verifications }, 'Admin: Deleted all verification codes');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting verification codes');
        deletedCounts.verifications = 0;
      }

      // Delete accounts (references user)
      try {
        const result = await app.db.delete(authSchema.account);
        deletedCounts.accounts = 1;
        app.logger.info({ deletedAccounts: deletedCounts.accounts }, 'Admin: Deleted all accounts from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting accounts');
        deletedCounts.accounts = 0;
      }

      // Delete Better Auth users (final step for auth tables)
      try {
        const result = await app.db.delete(authSchema.user);
        deletedCounts.authUsers = 1;
        app.logger.info({ deletedAuthUsers: deletedCounts.authUsers }, 'Admin: Deleted all users from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting Better Auth users');
        deletedCounts.authUsers = 0;
      }

      // Step 2: Delete from CoinHub tables (in proper order to respect foreign key constraints)
      // Child records must be deleted before parent records

      // Delete trade reports (references trades and users)
      try {
        const result = await app.db.delete(schema.tradeReports);
        deletedCounts.tradeReports = 1;
        app.logger.info({ deletedReports: deletedCounts.tradeReports }, 'Admin: Deleted all trade reports');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting trade reports');
        deletedCounts.tradeReports = 0;
      }

      // Delete trade shipping (references trades)
      try {
        const result = await app.db.delete(schema.tradeShipping);
        deletedCounts.tradeShipping = 1;
        app.logger.info({ deletedShipping: deletedCounts.tradeShipping }, 'Admin: Deleted all trade shipping records');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting trade shipping');
        deletedCounts.tradeShipping = 0;
      }

      // Delete trade messages (references trades and users)
      try {
        const result = await app.db.delete(schema.tradeMessages);
        deletedCounts.tradeMessages = 1;
        app.logger.info({ deletedMessages: deletedCounts.tradeMessages }, 'Admin: Deleted all trade messages');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting trade messages');
        deletedCounts.tradeMessages = 0;
      }

      // Delete trade offers (references trades and users)
      try {
        const result = await app.db.delete(schema.tradeOffers);
        deletedCounts.tradeOffers = 1;
        app.logger.info({ deletedOffers: deletedCounts.tradeOffers }, 'Admin: Deleted all trade offers');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting trade offers');
        deletedCounts.tradeOffers = 0;
      }

      // Delete trades (references users and coins)
      try {
        const result = await app.db.delete(schema.trades);
        deletedCounts.trades = 1;
        app.logger.info({ deletedTrades: deletedCounts.trades }, 'Admin: Deleted all trades');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting trades');
        deletedCounts.trades = 0;
      }

      // Delete comments (references users and coins)
      try {
        const result = await app.db.delete(schema.comments);
        deletedCounts.comments = 1;
        app.logger.info({ deletedComments: deletedCounts.comments }, 'Admin: Deleted all comments');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting comments');
        deletedCounts.comments = 0;
      }

      // Delete likes (references users and coins)
      try {
        const result = await app.db.delete(schema.likes);
        deletedCounts.likes = 1;
        app.logger.info({ deletedLikes: deletedCounts.likes }, 'Admin: Deleted all likes');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting likes');
        deletedCounts.likes = 0;
      }

      // Delete follows (references users)
      try {
        const result = await app.db.delete(schema.follows);
        deletedCounts.follows = 1;
        app.logger.info({ deletedFollows: deletedCounts.follows }, 'Admin: Deleted all follow relationships');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting follows');
        deletedCounts.follows = 0;
      }

      // Delete coin images (references coins)
      try {
        const result = await app.db.delete(schema.coinImages);
        deletedCounts.coinImages = 1;
        app.logger.info({ deletedImages: deletedCounts.coinImages }, 'Admin: Deleted all coin images');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting coin images');
        deletedCounts.coinImages = 0;
      }

      // Delete coins (references users)
      try {
        const result = await app.db.delete(schema.coins);
        deletedCounts.coins = 1;
        app.logger.info({ deletedCoins: deletedCounts.coins }, 'Admin: Deleted all coins');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting coins');
        deletedCounts.coins = 0;
      }

      // Delete CoinHub users (final step)
      try {
        const result = await app.db.delete(schema.users);
        deletedCounts.users = 1;
        app.logger.info({ deletedUsers: deletedCounts.users }, 'Admin: Deleted all CoinHub user profiles');
      } catch (e) {
        app.logger.warn({ err: e }, 'Admin: Error deleting users');
        deletedCounts.users = 0;
      }

      app.logger.warn(
        { deletedCounts },
        'CRITICAL: Delete-all-users operation completed successfully - all user data has been wiped'
      );

      return {
        success: true,
        message: 'All user data deleted successfully',
        deletedCounts,
      };
    } catch (error) {
      app.logger.error(
        { err: error },
        'CRITICAL: Delete-all-users operation failed - PARTIAL DATA DELETION MAY HAVE OCCURRED'
      );
      return reply.status(500).send({
        error: 'Delete-all-users operation failed',
        details: String(error),
        message: 'CRITICAL: Operation may have partially completed. Check database integrity.',
      });
    }
  });

  /**
   * DELETE /api/admin/users/:userId
   * Delete a specific user account and all associated data
   *
   * This endpoint deletes a single user account including:
   * - The user profile from the CoinHub users table
   * - The user account from Better Auth user table
   * - All associated coins
   * - All trades (offers, messages, shipping)
   * - All comments, likes, follows, trade reports
   *
   * Requires: Authentication + Admin role verification
   * Returns: { success: true, message: 'User account deleted successfully' }
   * Returns 404 if user not found
   * Returns 403 if not admin
   * Returns 400 if trying to delete yourself
   */
  app.fastify.delete('/api/admin/users/:userId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    app.logger.info({ targetUserId: userId }, 'Admin: Delete user account request');

    try {
      // Validate session - admin endpoints require authentication
      const sessionData = await validateSession(request, app);
      if (!sessionData) {
        app.logger.warn({ targetUserId: userId }, 'Admin: Unauthorized access attempt to delete user');
        return reply.status(401).send({ error: 'Unauthorized - authentication required' });
      }

      // Verify user is admin
      const adminUser = await app.db.query.users.findFirst({
        where: eq(schema.users.id, sessionData.user.id),
        columns: { role: true },
      });

      if (!adminUser || adminUser.role !== 'admin') {
        app.logger.warn(
          { requesterId: sessionData.user.id, targetUserId: userId, userRole: adminUser?.role },
          'Admin: Non-admin user attempted to delete a user'
        );
        return reply.status(403).send({
          error: 'Forbidden - admin access required',
          message: 'Admin access required. Use POST /api/admin/grant-admin-access to grant yourself admin privileges first.',
        });
      }

      // Prevent admins from deleting their own account
      if (sessionData.user.id === userId) {
        app.logger.warn(
          { adminId: sessionData.user.id },
          'Admin: Attempted to delete own account - operation denied'
        );
        return reply.status(400).send({
          error: 'Cannot delete own account',
          message: 'Admins cannot delete their own account. Please contact another admin if account deletion is needed.',
        });
      }

      // Check if target user exists
      const targetUserProfile = await app.db.query.users.findFirst({
        where: eq(schema.users.id, userId),
        columns: { email: true, username: true },
      });

      if (!targetUserProfile) {
        app.logger.warn({ targetUserId: userId }, 'Admin: Target user not found for deletion');
        return reply.status(404).send({
          error: 'User not found',
          message: `User with ID ${userId} not found`,
        });
      }

      app.logger.warn(
        { adminId: sessionData.user.id, targetUserId: userId, targetEmail: targetUserProfile.email },
        'Admin: User deletion verified - proceeding with cascading deletes'
      );

      // Delete in proper order to respect foreign key constraints
      // Delete child records first, then parent records

      // 1. Delete trade reports (references trades and users)
      try {
        await app.db.delete(schema.tradeReports).where(
          or(
            eq(schema.tradeReports.reporterId, userId),
            eq(schema.tradeReports.reportedUserId, userId)
          )
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted trade reports');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting trade reports');
      }

      // 2. Delete trade shipping (references trades via tradeId)
      // First get all trades for this user to find their shipping records
      try {
        const userTrades = await app.db.query.trades.findMany({
          where: or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          ),
          columns: { id: true },
        });

        const tradeIds = userTrades.map(t => t.id);
        if (tradeIds.length > 0) {
          await app.db.delete(schema.tradeShipping).where(
            inArray(schema.tradeShipping.tradeId, tradeIds)
          );
        }
        app.logger.debug({ targetUserId: userId, tradeCount: tradeIds.length }, 'Admin: Deleted trade shipping records');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting trade shipping');
      }

      // 3. Delete trade messages (references trades and users)
      try {
        const userTrades = await app.db.query.trades.findMany({
          where: or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          ),
          columns: { id: true },
        });

        const tradeIds = userTrades.map(t => t.id);
        if (tradeIds.length > 0) {
          await app.db.delete(schema.tradeMessages).where(
            or(
              eq(schema.tradeMessages.senderId, userId),
              inArray(schema.tradeMessages.tradeId, tradeIds)
            )
          );
        } else {
          await app.db.delete(schema.tradeMessages).where(
            eq(schema.tradeMessages.senderId, userId)
          );
        }
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted trade messages');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting trade messages');
      }

      // 4. Delete trade offers (references trades and users)
      try {
        const userTrades = await app.db.query.trades.findMany({
          where: or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          ),
          columns: { id: true },
        });

        const tradeIds = userTrades.map(t => t.id);
        if (tradeIds.length > 0) {
          await app.db.delete(schema.tradeOffers).where(
            or(
              eq(schema.tradeOffers.offererId, userId),
              inArray(schema.tradeOffers.tradeId, tradeIds)
            )
          );
        } else {
          await app.db.delete(schema.tradeOffers).where(
            eq(schema.tradeOffers.offererId, userId)
          );
        }
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted trade offers');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting trade offers');
      }

      // 5. Delete trades (references users and coins)
      try {
        await app.db.delete(schema.trades).where(
          or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          )
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted trades');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting trades');
      }

      // 6. Delete comments (references users and coins)
      try {
        await app.db.delete(schema.comments).where(
          eq(schema.comments.userId, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted comments');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting comments');
      }

      // 7. Delete likes (references users and coins)
      try {
        await app.db.delete(schema.likes).where(
          eq(schema.likes.userId, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted likes');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting likes');
      }

      // 8. Delete follow relationships (references users)
      try {
        await app.db.delete(schema.follows).where(
          or(
            eq(schema.follows.followerId, userId),
            eq(schema.follows.followingId, userId)
          )
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted follow relationships');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting follows');
      }

      // 9. Delete coin images (child of coins)
      try {
        // First get all coins for this user to find their images
        const userCoins = await app.db.query.coins.findMany({
          where: eq(schema.coins.userId, userId),
          columns: { id: true },
        });

        const coinIds = userCoins.map(c => c.id);
        if (coinIds.length > 0) {
          await app.db.delete(schema.coinImages).where(
            inArray(schema.coinImages.coinId, coinIds)
          );
        }
        app.logger.debug({ targetUserId: userId, coinCount: coinIds.length }, 'Admin: Deleted coin images');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting coin images');
      }

      // 10. Delete coins (references users)
      try {
        await app.db.delete(schema.coins).where(
          eq(schema.coins.userId, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted coins');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting coins');
      }

      // 11. Delete Better Auth tables (must be in reverse order of foreign keys)
      // Delete sessions first (references user)
      try {
        await app.db.delete(authSchema.session).where(
          eq(authSchema.session.userId, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted sessions from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting sessions');
      }

      // Delete accounts (references user)
      try {
        await app.db.delete(authSchema.account).where(
          eq(authSchema.account.userId, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted accounts from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting accounts');
      }

      // Delete the Better Auth user
      try {
        await app.db.delete(authSchema.user).where(
          eq(authSchema.user.id, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted user from Better Auth');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting Better Auth user');
      }

      // 12. Finally, delete the CoinHub user profile
      try {
        await app.db.delete(schema.users).where(
          eq(schema.users.id, userId)
        );
        app.logger.debug({ targetUserId: userId }, 'Admin: Deleted user profile from CoinHub');
      } catch (e) {
        app.logger.warn({ err: e, targetUserId: userId }, 'Admin: Error deleting CoinHub user');
      }

      app.logger.warn(
        { adminId: sessionData.user.id, targetUserId: userId, targetEmail: targetUserProfile.email },
        'Admin: User account deleted successfully'
      );

      return reply.status(200).send({
        success: true,
        message: 'User account deleted successfully',
        deletedUser: {
          userId,
          email: targetUserProfile.email,
          username: targetUserProfile.username,
        },
      });
    } catch (error) {
      app.logger.error(
        { err: error, targetUserId: userId },
        'Admin: Error deleting user account'
      );
      return reply.status(500).send({
        error: 'Failed to delete user account',
        details: String(error),
      });
    }
  });
}
