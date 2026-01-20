import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, desc, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { extractSessionToken } from '../utils/auth-utils.js';

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

      // Format results with signed URLs
      const formattedCoins = await Promise.all(
        coins.map(async (coin) => {
          const imagesWithUrls = await Promise.all(
            coin.images.map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return {
                  id: img.id,
                  url,
                  orderIndex: img.orderIndex,
                };
              } catch (urlError) {
                app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                return {
                  id: img.id,
                  url: null,
                  orderIndex: img.orderIndex,
                };
              }
            })
          );

          // Generate signed URL for user avatar if it exists
          let userAvatarUrl = coin.user.avatarUrl;
          if (userAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(userAvatarUrl);
              userAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: coin.user.id }, 'Failed to generate avatar signed URL');
              userAvatarUrl = null;
            }
          }

          return {
            id: coin.id,
            title: coin.title,
            country: coin.country,
            year: coin.year,
            agency: coin.agency,
            condition: coin.condition,
            description: coin.description,
            version: coin.version,
            manufacturer: coin.manufacturer,
            tradeStatus: coin.tradeStatus,
            user: { ...coin.user, avatarUrl: userAvatarUrl },
            images: imagesWithUrls,
            likeCount: coin.likes.length,
            commentCount: coin.comments.length,
            createdAt: coin.createdAt,
            updatedAt: coin.updatedAt,
          };
        })
      );

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

      // Format results with signed URLs
      const formattedCoins = await Promise.all(
        paginatedCoins.map(async (coin) => {
          const imagesWithUrls = await Promise.all(
            coin.images.map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return {
                  id: img.id,
                  url,
                  orderIndex: img.orderIndex,
                };
              } catch (urlError) {
                app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                return {
                  id: img.id,
                  url: null,
                  orderIndex: img.orderIndex,
                };
              }
            })
          );

          // Generate signed URL for user avatar if it exists
          let userAvatarUrl = coin.user.avatarUrl;
          if (userAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(userAvatarUrl);
              userAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: coin.user.id }, 'Failed to generate avatar signed URL');
              userAvatarUrl = null;
            }
          }

          return {
            id: coin.id,
            title: coin.title,
            country: coin.country,
            year: coin.year,
            agency: coin.agency,
            condition: coin.condition,
            description: coin.description,
            version: coin.version,
            manufacturer: coin.manufacturer,
            tradeStatus: coin.tradeStatus,
            user: { ...coin.user, avatarUrl: userAvatarUrl },
            images: imagesWithUrls,
            likeCount: coin.likes.length,
            commentCount: coin.comments.length,
            createdAt: coin.createdAt,
            updatedAt: coin.updatedAt,
          };
        })
      );

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

  /**
   * GET /api/coins/feed/trade
   * Get coins marked as available for trade (most recent first)
   *
   * Query parameters:
   *   - limit (default: 20, max: 100): Number of coins to return
   *   - offset (default: 0): Number of coins to skip
   *   - country (optional): Filter by country
   *   - year (optional): Filter by year
   *
   * Returns: { coins: [...], total, limit, offset }
   */
  app.fastify.get('/api/coins/feed/trade', async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string | undefined>;
    const limit = Math.min(100, Math.max(1, parseInt(query.limit || '20', 10)));
    const offset = Math.max(0, parseInt(query.offset || '0', 10));
    const country = query.country;
    const year = query.year ? parseInt(query.year, 10) : undefined;

    app.logger.info(
      { limit, offset, country, year },
      'Fetching coins up for trade feed'
    );

    try {
      // Try to get current user session if authenticated
      let currentUserId: string | null = null;
      try {
        const sessionToken = extractSessionToken(request);
        if (sessionToken) {
          const sessionRecord = await app.db.query.session.findFirst({
            where: eq(authSchema.session.token, sessionToken),
          });

          if (sessionRecord && new Date(sessionRecord.expiresAt) > new Date()) {
            const userRecord = await app.db.query.user.findFirst({
              where: eq(authSchema.user.id, sessionRecord.userId),
            });
            if (userRecord) {
              currentUserId = userRecord.id;
            }
          }
        }
      } catch {
        // Not authenticated, that's fine - feed is public
      }

      // Build where conditions - only public coins marked as open_to_trade
      const whereConditions: any[] = [
        eq(schema.coins.visibility, 'public'),
        eq(schema.coins.tradeStatus, 'open_to_trade'),
      ];

      if (country) {
        whereConditions.push(eq(schema.coins.country, country));
      }

      if (year) {
        whereConditions.push(eq(schema.coins.year, year));
      }

      const whereClause = and(...whereConditions);

      // Fetch total count
      let totalCoins: any[] = [];
      try {
        totalCoins = await app.db.query.coins.findMany({
          where: whereClause,
          columns: { id: true },
        });
      } catch (countError) {
        app.logger.error({ err: countError }, 'Database error counting trade coins');
        return reply.status(503).send({ error: 'Database error' });
      }

      const total = totalCoins.length;

      // Fetch paginated coins with relations
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
          orderBy: (coin) => desc(coin.createdAt),
          limit,
          offset,
        });
      } catch (coinsError) {
        app.logger.error({ err: coinsError, limit, offset }, 'Database error fetching trade coins');
        return reply.status(503).send({ error: 'Database error' });
      }

      // Format results with signed URLs and like status
      const formattedCoins = await Promise.all(
        coins.map(async (coin) => {
          const imagesWithUrls = await Promise.all(
            coin.images.map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return {
                  id: img.id,
                  url,
                  orderIndex: img.orderIndex,
                };
              } catch (urlError) {
                app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                return {
                  id: img.id,
                  url: null,
                  orderIndex: img.orderIndex,
                };
              }
            })
          );

          // Generate signed URL for user avatar if it exists
          let userAvatarUrl = coin.user.avatarUrl;
          if (userAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(userAvatarUrl);
              userAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: coin.user.id }, 'Failed to generate avatar signed URL');
              userAvatarUrl = null;
            }
          }

          // Check if current user has liked this coin
          const userHasLiked = currentUserId ? coin.likes.some((like: any) => like.userId === currentUserId) : false;

          return {
            id: coin.id,
            title: coin.title,
            country: coin.country,
            year: coin.year,
            agency: coin.agency,
            condition: coin.condition,
            description: coin.description,
            version: coin.version,
            manufacturer: coin.manufacturer,
            tradeStatus: coin.tradeStatus,
            user: { ...coin.user, avatarUrl: userAvatarUrl },
            images: imagesWithUrls,
            likeCount: coin.likes.length,
            commentCount: coin.comments.length,
            userHasLiked,
            createdAt: coin.createdAt,
            updatedAt: coin.updatedAt,
          };
        })
      );

      app.logger.info(
        { count: formattedCoins.length, total, limit, offset },
        'Coins up for trade feed fetched'
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
        'Unexpected error fetching coins up for trade feed'
      );
      return reply.status(500).send({ error: 'Failed to fetch feed' });
    }
  });
}
