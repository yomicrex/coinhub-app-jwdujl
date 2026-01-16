import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';

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
}
