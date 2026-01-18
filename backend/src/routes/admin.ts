import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

export function registerAdminRoutes(app: App) {
  /**
   * DELETE /api/admin/users/:username
   * Deletes a user account and all associated data
   *
   * Cascading deletion includes:
   * - User's coins (cascades to: coin images, likes on coins, comments on coins)
   * - User's likes
   * - User's comments
   * - User's trades (both as initiator and coin owner)
   * - User's trade offers
   * - User's trade messages
   * - User's follows (both as follower and following)
   * - User's trade reports
   * - Better Auth user record
   *
   * Returns: { success: true, message: "User {username} and all associated data deleted successfully" }
   * Returns 404 if user not found: { error: "User not found" }
   */
  app.fastify.delete('/api/admin/users/:username', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };

    app.logger.info({ username }, 'Admin: Attempting to delete user account and all associated data');

    try {
      // Step 1: Find the user by username
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!user) {
        app.logger.warn({ username }, 'Admin: User not found for deletion');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId: user.id, username }, 'Admin: User found, beginning cascading deletion');

      // Step 2: Perform cascading deletions
      // Most deletions happen automatically via ON DELETE CASCADE in the database schema
      // But we need to explicitly delete the user from the Better Auth tables

      // Delete trades where user is involved (will cascade to offers, messages, shipping, reports)
      await app.db.delete(schema.trades).where(eq(schema.trades.initiatorId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted trades where user is initiator');

      // Delete trades where user owns the coin (will cascade to offers, messages, shipping, reports)
      await app.db.delete(schema.trades).where(eq(schema.trades.coinOwnerId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted trades where user is coin owner');

      // Delete user's coins (will cascade to coin images, likes, comments)
      await app.db.delete(schema.coins).where(eq(schema.coins.userId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user coins');

      // Delete user's likes
      await app.db.delete(schema.likes).where(eq(schema.likes.userId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user likes');

      // Delete user's comments
      await app.db.delete(schema.comments).where(eq(schema.comments.userId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user comments');

      // Delete user's follows (both as follower and following)
      await app.db.delete(schema.follows).where(eq(schema.follows.followerId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user followers');

      await app.db.delete(schema.follows).where(eq(schema.follows.followingId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user following');

      // Delete user from Better Auth tables
      // Delete sessions first (no cascade)
      await app.db.delete(authSchema.session).where(eq(authSchema.session.userId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user sessions');

      // Delete accounts (will cascade from user)
      await app.db.delete(authSchema.account).where(eq(authSchema.account.userId, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted user accounts');

      // Delete Better Auth user
      await app.db.delete(authSchema.user).where(eq(authSchema.user.id, user.id));
      app.logger.debug({ userId: user.id }, 'Admin: Deleted Better Auth user');

      // Step 3: Delete CoinHub user (final deletion)
      await app.db.delete(schema.users).where(eq(schema.users.id, user.id));
      app.logger.info({ userId: user.id, username }, 'Admin: User account and all associated data deleted successfully');

      return {
        success: true,
        message: `User ${username} and all associated data deleted successfully`,
      };
    } catch (error) {
      app.logger.error(
        { err: error, username },
        'Admin: Failed to delete user account'
      );
      return reply.status(500).send({ error: 'Failed to delete user account' });
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

    // Accept both 'password' and 'newPassword' field names
    const ResetPasswordSchema = z.object({
      password: z.string().min(8, 'Password must be at least 8 characters').optional(),
      newPassword: z.string().min(8, 'Password must be at least 8 characters').optional(),
    }).refine(
      (data) => data.password || data.newPassword,
      { message: 'Either password or newPassword must be provided' }
    );

    try {
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
        const newAccountId = crypto.randomUUID();
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
}
