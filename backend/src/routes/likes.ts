import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerLikesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/coins/:id/like
   * Like a coin (creates or does nothing if already liked)
   */
  app.fastify.post('/api/coins/:id/like', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id: coinId } = request.params as { id: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Liking coin');

    try {
      // Check coin exists
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Check if already liked
      const existingLike = await app.db.query.likes.findFirst({
        where: and(eq(schema.likes.userId, session.user.id), eq(schema.likes.coinId, coinId)),
      });

      if (existingLike) {
        // Already liked, just return current state
        app.logger.info({ coinId, userId: session.user.id }, 'Coin already liked');

        // Get current like count
        const likeCount = await app.db.query.likes.findMany({
          where: eq(schema.likes.coinId, coinId),
        });

        return { liked: true, likeCount: likeCount.length };
      }

      // Create like
      await app.db.insert(schema.likes).values({
        userId: session.user.id,
        coinId,
      });

      // Get updated like count
      const likeCount = await app.db.query.likes.findMany({
        where: eq(schema.likes.coinId, coinId),
      });

      app.logger.info({ coinId, userId: session.user.id }, 'Coin liked successfully');
      return { liked: true, likeCount: likeCount.length };
    } catch (error) {
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Failed to like coin');
      throw error;
    }
  });

  /**
   * DELETE /api/coins/:id/like
   * Unlike a coin
   */
  app.fastify.delete('/api/coins/:id/like', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id: coinId } = request.params as { id: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Unliking coin');

    try {
      // Check coin exists
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Check if liked
      const like = await app.db.query.likes.findFirst({
        where: and(eq(schema.likes.userId, session.user.id), eq(schema.likes.coinId, coinId)),
      });

      if (!like) {
        // Not liked, just return current state
        app.logger.info({ coinId, userId: session.user.id }, 'Coin not liked');

        // Get current like count
        const likeCount = await app.db.query.likes.findMany({
          where: eq(schema.likes.coinId, coinId),
        });

        return { liked: false, likeCount: likeCount.length };
      }

      // Delete like
      await app.db.delete(schema.likes).where(eq(schema.likes.id, like.id));

      // Get updated like count
      const likeCount = await app.db.query.likes.findMany({
        where: eq(schema.likes.coinId, coinId),
      });

      app.logger.info({ coinId, userId: session.user.id }, 'Coin unliked successfully');
      return { liked: false, likeCount: likeCount.length };
    } catch (error) {
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Failed to unlike coin');
      throw error;
    }
  });

  /**
   * GET /api/coins/:id/likes
   * Get list of users who liked a coin
   */
  app.fastify.get('/api/coins/:id/likes', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: coinId } = request.params as { id: string };

    app.logger.info({ coinId }, 'Fetching coin likes');

    try {
      // Check coin exists
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Get likes with user info
      const likes = await app.db.query.likes.findMany({
        where: eq(schema.likes.coinId, coinId),
        with: {
          user: {
            columns: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
            },
          },
        },
      });

      const users = likes.map((like) => like.user);
      app.logger.info({ coinId, count: users.length }, 'Coin likes fetched');
      return users;
    } catch (error) {
      app.logger.error({ err: error, coinId }, 'Failed to fetch coin likes');
      throw error;
    }
  });
}
