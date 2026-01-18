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
   * Request body: { password: string } - New password (must be at least 8 characters)
   *
   * Returns: { success: true, message: "Password reset successfully for user {username}" }
   * Returns 404 if user not found: { error: "User not found" }
   * Returns 400 if password validation fails
   * Returns 500 if database error occurs
   */
  app.fastify.post('/api/admin/users/:username/reset-password', async (request: FastifyRequest, reply: FastifyReply) => {
    const { username } = request.params as { username: string };
    const requestBody = request.body as Record<string, any>;

    app.logger.info({ username }, 'Admin: Password reset requested for user');

    const ResetPasswordSchema = z.object({
      password: z.string().min(8, 'Password must be at least 8 characters'),
    });

    try {
      const body = ResetPasswordSchema.parse(requestBody);

      // Step 1: Find the user by username
      const coinHubUser = await app.db.query.users.findFirst({
        where: eq(schema.users.username, username),
      });

      if (!coinHubUser) {
        app.logger.warn({ username }, 'Admin: User not found for password reset');
        return reply.status(404).send({ error: 'User not found' });
      }

      app.logger.info({ userId: coinHubUser.id, username }, 'Admin: User found, resetting password');

      // Step 2: Hash the new password
      const bcrypt = await import('bcryptjs') as any;
      const hashedPassword = await bcrypt.hash(body.password, 10);

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
        await app.db
          .update(authSchema.account)
          .set({ password: hashedPassword })
          .where(eq(authSchema.account.id, credentialAccount.id));

        app.logger.info(
          { userId: coinHubUser.id, username, accountId: credentialAccount.id, providerId: credentialAccount.providerId },
          'Admin: Password updated in account'
        );
      } else {
        // Create new credential account as fallback
        await app.db.insert(authSchema.account).values({
          id: crypto.randomUUID(),
          userId: coinHubUser.id,
          accountId: `credential-${coinHubUser.id}`,
          providerId: 'credential',
          password: hashedPassword,
        });

        app.logger.info(
          { userId: coinHubUser.id, username },
          'Admin: Created new credential account with password'
        );
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
}
