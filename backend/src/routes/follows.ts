import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, ne, not, inArray } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Follow/Friend System Routes
 *
 * Enables users to follow other users and manage relationships
 */
export function registerFollowRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/users/:userId/follow
   * Follow a user
   * Requires authentication
   */
  app.fastify.post('/api/users/:userId/follow', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { userId } = request.params as { userId: string };
    const followerId = session.user.id;

    app.logger.info({ followerId, userId }, 'Follow user request');

    try {
      // Prevent self-following
      if (followerId === userId) {
        app.logger.warn({ userId }, 'User attempted to follow self');
        return reply.status(400).send({ error: 'Cannot follow yourself' });
      }

      // Check if target user exists
      let targetUser;
      try {
        targetUser = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error checking user');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!targetUser) {
        app.logger.warn({ userId }, 'Target user not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Check if already following
      let existingFollow;
      try {
        existingFollow = await app.db.query.follows.findFirst({
          where: and(
            eq(schema.follows.followerId, followerId),
            eq(schema.follows.followingId, userId)
          ),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, followerId, userId }, 'Database error checking follow');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (existingFollow) {
        app.logger.warn({ followerId, userId }, 'Already following this user');
        return reply.status(400).send({ error: 'Already following this user' });
      }

      // Create follow relationship
      try {
        await app.db.insert(schema.follows).values({
          followerId,
          followingId: userId,
        });
        app.logger.info({ followerId, userId }, 'User followed successfully');
        return { success: true, message: 'User followed' };
      } catch (dbError) {
        app.logger.error({ err: dbError, followerId, userId }, 'Database error creating follow');
        return reply.status(503).send({ error: 'Database error', message: 'Failed to follow user' });
      }
    } catch (error) {
      app.logger.error({ err: error, followerId, userId }, 'Unexpected error during follow');
      return reply.status(500).send({ error: 'Follow failed' });
    }
  });

  /**
   * DELETE /api/users/:userId/follow
   * Unfollow a user
   * Requires authentication
   */
  app.fastify.delete('/api/users/:userId/follow', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { userId } = request.params as { userId: string };
    const followerId = session.user.id;

    app.logger.info({ followerId, userId }, 'Unfollow user request');

    try {
      // Check if following
      let follow;
      try {
        follow = await app.db.query.follows.findFirst({
          where: and(
            eq(schema.follows.followerId, followerId),
            eq(schema.follows.followingId, userId)
          ),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, followerId, userId }, 'Database error checking follow');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!follow) {
        app.logger.warn({ followerId, userId }, 'Not following this user');
        return reply.status(400).send({ error: 'Not following this user' });
      }

      // Delete follow relationship
      try {
        await app.db.delete(schema.follows).where(
          and(
            eq(schema.follows.followerId, followerId),
            eq(schema.follows.followingId, userId)
          )
        );
        app.logger.info({ followerId, userId }, 'User unfollowed successfully');
        return { success: true, message: 'User unfollowed' };
      } catch (dbError) {
        app.logger.error({ err: dbError, followerId, userId }, 'Database error deleting follow');
        return reply.status(503).send({ error: 'Database error', message: 'Failed to unfollow user' });
      }
    } catch (error) {
      app.logger.error({ err: error, followerId, userId }, 'Unexpected error during unfollow');
      return reply.status(500).send({ error: 'Unfollow failed' });
    }
  });

  /**
   * GET /api/users/:userId/followers
   * Get list of users following this user
   * Public endpoint - no authentication required
   */
  app.fastify.get('/api/users/:userId/followers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));

    app.logger.info({ userId, limit, offset }, 'Fetching followers');

    try {
      // Check if user exists
      let user;
      try {
        user = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error checking user');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!user) {
        app.logger.warn({ userId }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Fetch followers with pagination
      let followers;
      try {
        followers = await app.db.query.follows.findMany({
          where: eq(schema.follows.followingId, userId),
          with: {
            follower: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          limit,
          offset,
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error fetching followers');
        return reply.status(503).send({ error: 'Database error' });
      }

      // Get total count
      let totalFollows;
      try {
        totalFollows = await app.db.query.follows.findMany({
          where: eq(schema.follows.followingId, userId),
          columns: { id: true },
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error counting followers');
        return reply.status(503).send({ error: 'Database error' });
      }

      const result = followers.map((f) => f.follower);

      app.logger.info({ userId, count: result.length, total: totalFollows.length }, 'Followers fetched');
      return {
        followers: result,
        total: totalFollows.length,
        limit,
        offset,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Unexpected error fetching followers');
      return reply.status(500).send({ error: 'Failed to fetch followers' });
    }
  });

  /**
   * GET /api/users/:userId/following
   * Get list of users this user is following
   * Public endpoint - no authentication required
   */
  app.fastify.get('/api/users/:userId/following', async (request: FastifyRequest, reply: FastifyReply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));

    app.logger.info({ userId, limit, offset }, 'Fetching following');

    try {
      // Check if user exists
      let user;
      try {
        user = await app.db.query.users.findFirst({
          where: eq(schema.users.id, userId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error checking user');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!user) {
        app.logger.warn({ userId }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Fetch following with pagination
      let following;
      try {
        following = await app.db.query.follows.findMany({
          where: eq(schema.follows.followerId, userId),
          with: {
            following: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
          },
          limit,
          offset,
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error fetching following');
        return reply.status(503).send({ error: 'Database error' });
      }

      // Get total count
      let totalFollowing;
      try {
        totalFollowing = await app.db.query.follows.findMany({
          where: eq(schema.follows.followerId, userId),
          columns: { id: true },
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, userId }, 'Database error counting following');
        return reply.status(503).send({ error: 'Database error' });
      }

      const result = following.map((f) => f.following);

      app.logger.info({ userId, count: result.length, total: totalFollowing.length }, 'Following fetched');
      return {
        following: result,
        total: totalFollowing.length,
        limit,
        offset,
      };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Unexpected error fetching following');
      return reply.status(500).send({ error: 'Failed to fetch following' });
    }
  });

  /**
   * GET /api/users/suggestions/follow
   * Get user suggestions for following
   * Returns users not yet followed by authenticated user
   * Requires authentication
   */
  app.fastify.get('/api/users/suggestions/follow', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10)));

    app.logger.info({ userId: session.user.id, limit }, 'Fetching follow suggestions');

    try {
      // Get all users we're already following
      let followingList;
      try {
        followingList = await app.db.query.follows.findMany({
          where: eq(schema.follows.followerId, session.user.id),
          columns: { followingId: true },
        });
      } catch (dbError) {
        app.logger.error({ err: dbError }, 'Database error fetching following list');
        return reply.status(503).send({ error: 'Database error' });
      }

      const followingIds = followingList.map((f) => f.followingId);

      // Get all users excluding self and already following
      let suggestions;
      try {
        suggestions = await app.db.query.users.findMany({
          where: and(
            ne(schema.users.id, session.user.id),
            followingIds.length > 0
              ? not(inArray(schema.users.id, followingIds))
              : undefined
          ),
          columns: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
          },
          limit,
        });
      } catch (dbError) {
        app.logger.error({ err: dbError }, 'Database error fetching suggestions');
        return reply.status(503).send({ error: 'Database error' });
      }

      app.logger.info({ userId: session.user.id, count: suggestions.length }, 'Follow suggestions fetched');
      return { suggestions };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Unexpected error fetching suggestions');
      return reply.status(500).send({ error: 'Failed to fetch suggestions' });
    }
  });

  /**
   * GET /api/users/:userId/is-following
   * Check if authenticated user is following a user
   * Requires authentication
   */
  app.fastify.get('/api/users/:userId/is-following', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { userId } = request.params as { userId: string };

    app.logger.debug({ followerId: session.user.id, userId }, 'Checking follow status');

    try {
      let follow;
      try {
        follow = await app.db.query.follows.findFirst({
          where: and(
            eq(schema.follows.followerId, session.user.id),
            eq(schema.follows.followingId, userId)
          ),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError }, 'Database error checking follow status');
        return reply.status(503).send({ error: 'Database error' });
      }

      return { isFollowing: !!follow };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Unexpected error checking follow status');
      return reply.status(500).send({ error: 'Check failed' });
    }
  });
}
