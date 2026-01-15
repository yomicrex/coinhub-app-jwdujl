import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

/**
 * Feed Routes
 *
 * Provides public coin feeds with pagination and filtering
 */
export function registerFeedRoutes(app: App) {
  /**
   * GET /api/coins/feed
   * Get public coins feed ordered by most recent first
   *
   * Query parameters:
   *   - limit (default: 20, max: 100): Number of coins to return
   *   - offset (default: 0): Number of coins to skip
   *   - country (optional): Filter by country
   *   - year (optional): Filter by year
   *
   * Returns: { coins: [...], total, limit, offset }
   */
  app.fastify.get('/api/coins/feed', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));
    const country = query.country;
    const year = query.year ? parseInt(query.year, 10) : undefined;

    app.logger.info(
      { limit, offset, country, year },
      'Fetching public coins feed'
    );

    try {
      // Build where conditions - only public coins
      const whereConditions: any[] = [eq(schema.coins.visibility, 'public')];

      if (country) {
        whereConditions.push(eq(schema.coins.country, country));
      }

      if (year) {
        whereConditions.push(eq(schema.coins.year, year));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      // Fetch total count
      let totalCoins: any[] = [];
      try {
        totalCoins = await app.db.query.coins.findMany({
          where: whereClause,
          columns: { id: true },
        });
      } catch (countError) {
        app.logger.error({ err: countError }, 'Database error counting coins');
        return reply.status(503).send({ error: 'Database error' });
      }

      const total = totalCoins.length;

      // Fetch coins with pagination
      let coins: any[] = [];
      try {
        coins = await app.db.query.coins.findMany({
          where: whereClause,
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            images: {
              orderBy: (img) => img.orderIndex,
            },
            likes: {
              columns: { userId: true },
            },
            comments: {
              columns: { id: true },
            },
          },
          orderBy: desc(schema.coins.createdAt),
          limit,
          offset,
        });
      } catch (coinsError) {
        app.logger.error({ err: coinsError, limit, offset }, 'Database error fetching coins');
        return reply.status(503).send({ error: 'Database error' });
      }

      // Format results
      const formattedCoins = coins.map((coin) => ({
        id: coin.id,
        title: coin.title,
        country: coin.country,
        year: coin.year,
        condition: coin.condition,
        description: coin.description,
        tradeStatus: coin.tradeStatus,
        user: coin.user,
        images: coin.images.map((img) => ({
          id: img.id,
          url: img.url,
          orderIndex: img.orderIndex,
        })),
        likeCount: coin.likes.length,
        commentCount: coin.comments.length,
        createdAt: coin.createdAt,
        updatedAt: coin.updatedAt,
      }));

      app.logger.info(
        { count: formattedCoins.length, total, limit, offset },
        'Public coins feed fetched'
      );

      return {
        coins: formattedCoins,
        total,
        limit,
        offset,
      };
    } catch (error) {
      app.logger.error(
        { err: error, limit, offset, country, year },
        'Unexpected error fetching coins feed'
      );
      return reply.status(500).send({ error: 'Failed to fetch feed' });
    }
  });

  /**
   * GET /api/coins/feed/trending
   * Get trending public coins (most liked in past 7 days)
   *
   * Query parameters:
   *   - limit (default: 10, max: 50): Number of coins to return
   *   - offset (default: 0): Number of coins to skip
   *
   * Returns: { coins: [...], total, limit, offset }
   */
  app.fastify.get('/api/coins/feed/trending', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(50, Math.max(1, parseInt(query.limit || '10', 10)));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));

    app.logger.info({ limit, offset }, 'Fetching trending coins');

    try {
      // Calculate date 7 days ago
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // Fetch all public coins created in the last 7 days with like counts
      let allCoins: any[] = [];
      try {
        allCoins = await app.db.query.coins.findMany({
          where: and(
            eq(schema.coins.visibility, 'public')
          ),
          with: {
            user: {
              columns: {
                id: true,
                username: true,
                displayName: true,
                avatarUrl: true,
              },
            },
            images: {
              orderBy: (img) => img.orderIndex,
            },
            likes: {
              columns: { userId: true },
            },
            comments: {
              columns: { id: true },
            },
          },
        });
      } catch (coinsError) {
        app.logger.error({ err: coinsError }, 'Database error fetching coins');
        return reply.status(503).send({ error: 'Database error' });
      }

      // Filter by date and sort by like count
      const recentCoins = allCoins
        .filter((coin) => new Date(coin.createdAt) >= sevenDaysAgo)
        .map((coin) => ({
          ...coin,
          _likeCount: coin.likes.length,
        }))
        .sort((a, b) => b._likeCount - a._likeCount);

      const total = recentCoins.length;
      const paginatedCoins = recentCoins.slice(offset, offset + limit);

      // Format results
      const formattedCoins = paginatedCoins.map((coin) => ({
        id: coin.id,
        title: coin.title,
        country: coin.country,
        year: coin.year,
        condition: coin.condition,
        description: coin.description,
        tradeStatus: coin.tradeStatus,
        user: coin.user,
        images: coin.images.map((img) => ({
          id: img.id,
          url: img.url,
          orderIndex: img.orderIndex,
        })),
        likeCount: coin.likes.length,
        commentCount: coin.comments.length,
        createdAt: coin.createdAt,
        updatedAt: coin.updatedAt,
      }));

      app.logger.info(
        { count: formattedCoins.length, total, limit, offset },
        'Trending coins fetched'
      );

      return {
        coins: formattedCoins,
        total,
        limit,
        offset,
      };
    } catch (error) {
      app.logger.error({ err: error, limit, offset }, 'Unexpected error fetching trending coins');
      return reply.status(500).send({ error: 'Failed to fetch trending feed' });
    }
  });
}
