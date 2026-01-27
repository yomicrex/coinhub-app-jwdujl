import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, count, or, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { extractSessionToken } from '../utils/auth-utils.js';

const CreateCoinSchema = z.object({
  title: z.string().min(1).max(255),
  country: z.string().min(1).max(100),
  year: z.number().int().min(1800).max(new Date().getFullYear()),
  unit: z.string().max(100).optional(),
  organization: z.string().max(100).optional(),
  agency: z.string().min(1).max(100), // Required field for new coins
  deployment: z.string().max(100).optional(),
  coinNumber: z.string().max(100).optional(),
  mintMark: z.string().max(50).optional(),
  condition: z.string().max(100).optional(),
  description: z.string().max(2000).optional(),
  version: z.string().max(100).optional(),
  manufacturer: z.string().max(100).optional(),
  visibility: z.enum(['public', 'private']).default('public'),
  tradeStatus: z.enum(['not_for_trade', 'open_to_trade']).default('not_for_trade'),
  images: z.array(z.object({
    url: z.string(),
    orderIndex: z.number().int().default(0),
  })).optional(),
});

const UpdateCoinAvailabilitySchema = z.object({
  forTrade: z.boolean().optional(),
  tradeStatus: z.enum(['open_to_trade', 'not_for_trade']).optional(),
}).refine(
  (data) => data.forTrade !== undefined || data.tradeStatus !== undefined,
  { message: 'Either "forTrade" or "tradeStatus" field is required' }
).transform((data) => {
  // Support both forTrade boolean and tradeStatus enum
  if (data.forTrade !== undefined) {
    return { forTrade: data.forTrade };
  }
  return { forTrade: data.tradeStatus === 'open_to_trade' };
});

const UpdateCoinSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  country: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1800).max(new Date().getFullYear()).optional(),
  unit: z.string().max(100).optional().nullable(),
  organization: z.string().max(100).optional().nullable(),
  agency: z.string().max(100).optional().nullable(),
  deployment: z.string().max(100).optional().nullable(),
  coinNumber: z.string().max(100).optional().nullable(),
  mintMark: z.string().max(50).optional().nullable(),
  condition: z.string().max(100).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
  version: z.string().max(100).optional().nullable(),
  manufacturer: z.string().max(100).optional().nullable(),
  visibility: z.enum(['public', 'private']).optional(),
  tradeStatus: z.enum(['not_for_trade', 'open_to_trade']).optional(),
  images: z.array(z.object({
    url: z.string(),
    orderIndex: z.number().int().default(0),
  })).optional(),
});

export function registerCoinsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/coins
   * Create a new coin (requires authentication)
   */
  app.fastify.post('/api/coins', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ cookies: request.headers.cookie ? 'present' : 'missing', authHeader: request.headers.authorization ? 'present' : 'missing' }, 'POST /api/coins - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug({ tokenPresent: !!sessionToken }, 'Session token extraction result');

      if (!sessionToken) {
        app.logger.warn({ cookieHeader: request.headers.cookie?.substring(0, 100), authHeader: request.headers.authorization?.substring(0, 50) }, 'No session token found in request');
        return reply.status(401).send({ error: 'Unauthorized', message: 'No active session - session token not found in cookies or Authorization header' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      app.logger.debug({ sessionFound: !!sessionRecord }, 'Session lookup result');

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session token not found in database');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid - token not found in database' });
      }

      // Check if session is expired
      const expiresAt = new Date(sessionRecord.expiresAt);
      const now = new Date();
      app.logger.debug({ expiresAt: expiresAt.toISOString(), now: now.toISOString(), expired: expiresAt < now }, 'Session expiration check');

      if (expiresAt < now) {
        app.logger.warn({ expiresAt: expiresAt.toISOString() }, 'Session expired');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      app.logger.debug({ userFound: !!userRecord, userId: sessionRecord.userId }, 'User lookup result');

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for valid session');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      userId = userRecord.id;
      app.logger.info({ userId }, 'Session validated successfully for coin creation');
    } catch (sessionError) {
      app.logger.error({ err: sessionError }, 'Error during session validation');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to validate session' });
    }

    try {
      const body = CreateCoinSchema.parse(request.body);
      app.logger.info({ userId, title: body.title, country: body.country, year: body.year }, 'Creating coin with validated session');

      const [coin] = await app.db
        .insert(schema.coins)
        .values({
          userId,
          title: body.title,
          country: body.country,
          year: body.year,
          unit: body.unit || null,
          organization: body.organization || null,
          agency: body.agency,
          deployment: body.deployment || null,
          coinNumber: body.coinNumber || null,
          mintMark: body.mintMark || null,
          condition: body.condition || null,
          description: body.description || null,
          version: body.version || null,
          manufacturer: body.manufacturer || null,
          visibility: body.visibility,
          tradeStatus: body.tradeStatus,
        })
        .returning();

      // Create coin images if provided
      if (body.images && body.images.length > 0) {
        await app.db.insert(schema.coinImages).values(
          body.images.map((img) => ({
            coinId: coin.id,
            url: img.url,
            orderIndex: img.orderIndex,
          }))
        );
      }

      // Fetch full coin with images
      const fullCoin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coin.id),
        with: { images: true },
      });

      app.logger.info({ coinId: coin.id, userId }, 'Coin created successfully');
      return fullCoin;
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId }, 'Validation error creating coin');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId }, 'Failed to create coin');
      throw error;
    }
  });

  /**
   * GET /api/coins/trade-feed
   * Get coins available for trade (trade_status = 'open_to_trade')
   * Public endpoint - no authentication required
   * If authenticated, excludes coins owned by the current user
   * Returns coins in feed format ordered by creation date
   */
  app.fastify.get('/api/coins/trade-feed', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'Fetching trade feed coins');

    let currentUserId: string | null = null;

    // Try to extract authenticated user ID
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
            app.logger.debug({ userId: currentUserId }, 'Trade feed request from authenticated user');
          }
        }
      }
    } catch (authError) {
      app.logger.debug({ err: authError }, 'Failed to extract session, proceeding as guest');
      // Continue as guest user
    }

    try {
      // Build where conditions
      const conditions: any[] = [
        eq(schema.coins.tradeStatus, 'open_to_trade'),
        eq(schema.coins.visibility, 'public'),
        eq(schema.coins.isTemporaryTradeCoin, false)
      ];

      // If user is authenticated, exclude their own coins
      if (currentUserId) {
        conditions.push(sql`${schema.coins.userId} != ${currentUserId}`);
        app.logger.debug({ userId: currentUserId }, 'Filtering out user\'s own coins from trade feed');
      }

      // Get coins marked as open_to_trade, public visibility, not temporary trade coins
      const coins = await app.db.query.coins.findMany({
        where: and(...conditions),
        with: {
          user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
          images: { orderBy: (img) => img.orderIndex },
          likes: { columns: { userId: true } },
          comments: { columns: { id: true } },
        },
        orderBy: (coin) => coin.createdAt,
        limit: 20,
      });

      app.logger.info({ count: coins.length, isAuthenticated: !!currentUserId }, 'Trade feed coins fetched');

      // Generate signed URLs for images and avatars
      const coinsWithUrls = await Promise.all(
        coins.map(async (coin) => {
          // Generate signed URLs for coin images
          const imagesWithUrls = await Promise.all(
            coin.images.map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return {
                  url,
                  orderIndex: img.orderIndex,
                };
              } catch (urlError) {
                app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                return {
                  url: null,
                  orderIndex: img.orderIndex,
                };
              }
            })
          );

          // Generate signed URL for user avatar
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
            unit: coin.unit,
            agency: coin.agency,
            images: imagesWithUrls,
            user: {
              id: coin.user.id,
              username: coin.user.username,
              displayName: coin.user.displayName,
              avatarUrl: userAvatarUrl,
            },
            likeCount: coin.likes.length,
            commentCount: coin.comments.length,
            tradeStatus: coin.tradeStatus,
            createdAt: coin.createdAt,
          };
        })
      );

      return {
        coins: coinsWithUrls,
      };
    } catch (error) {
      app.logger.error({ err: error }, 'Failed to fetch trade feed');
      throw error;
    }
  });

  /**
   * GET /api/coins/:id
   * Get a single coin with full details
   */
  app.fastify.get('/api/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    app.logger.info({ coinId: id }, 'Fetching coin');

    try {
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, id),
        with: {
          user: true,
          images: { orderBy: (img) => img.orderIndex },
          likes: { columns: { userId: true } },
          comments: {
            with: { user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } } },
          },
        },
      });

      if (!coin) {
        app.logger.warn({ coinId: id }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Check visibility (allow viewing private coins only if owner)
      let userId: string | null = null;
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
              userId = userRecord.id;
            }
          }
        }
      } catch {
        // Not authenticated
      }

      if (coin.visibility === 'private' && coin.userId !== userId) {
        app.logger.warn({ coinId: id, userId }, 'Coin is private');
        return reply.status(403).send({ error: 'Coin is private' });
      }

      app.logger.info(
        { coinId: id, userId, isLiked: userId ? coin.likes.some((like: any) => like.userId === userId) : false },
        'Coin fetched successfully'
      );

      // Generate signed URLs for images
      const imagesWithUrls = await Promise.all(
        coin.images.map(async (img) => {
          try {
            const { url } = await app.storage.getSignedUrl(img.url);
            return {
              url,
              orderIndex: img.orderIndex,
            };
          } catch (urlError) {
            app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
            return {
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
        unit: coin.unit,
        organization: coin.organization,
        agency: coin.agency,
        deployment: coin.deployment,
        coinNumber: coin.coinNumber,
        mintMark: coin.mintMark,
        condition: coin.condition,
        description: coin.description,
        version: coin.version,
        manufacturer: coin.manufacturer,
        visibility: coin.visibility,
        tradeStatus: coin.tradeStatus,
        user: {
          id: coin.user.id,
          username: coin.user.username,
          displayName: coin.user.displayName,
          avatarUrl: userAvatarUrl,
        },
        images: imagesWithUrls,
        likeCount: coin.likes.length,
        commentCount: coin.comments.length,
        isLiked: userId ? coin.likes.some((like: any) => like.userId === userId) : false,
        createdAt: coin.createdAt,
      };
    } catch (error) {
      app.logger.error({ err: error, coinId: id }, 'Failed to fetch coin');
      throw error;
    }
  });

  /**
   * PUT /api/coins/:id
   * Update a coin (owner only)
   */
  app.fastify.put('/api/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    app.logger.info({ coinId: id }, 'PUT /api/coins/:id - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug({ tokenPresent: !!sessionToken }, 'Session token extraction result');

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for coin update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session token not found in database');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({}, 'Session expired for coin update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for valid session');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      userId = userRecord.id;
      app.logger.info({ userId }, 'Session validated successfully for coin update');
    } catch (sessionError) {
      app.logger.error({ err: sessionError }, 'Error during session validation');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to validate session' });
    }

    try {
      const body = UpdateCoinSchema.parse(request.body);

      // Check ownership
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, id),
      });

      if (!coin) {
        app.logger.warn({ coinId: id }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== userId) {
        app.logger.warn({ coinId: id, userId, ownerId: coin.userId }, 'Unauthorized coin update');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Build updates
      const updates: any = {};
      if (body.title !== undefined) updates.title = body.title;
      if (body.country !== undefined) updates.country = body.country;
      if (body.year !== undefined) updates.year = body.year;
      if (body.unit !== undefined) updates.unit = body.unit;
      if (body.organization !== undefined) updates.organization = body.organization;
      if (body.agency !== undefined) updates.agency = body.agency;
      if (body.deployment !== undefined) updates.deployment = body.deployment;
      if (body.coinNumber !== undefined) updates.coinNumber = body.coinNumber;
      if (body.mintMark !== undefined) updates.mintMark = body.mintMark;
      if (body.condition !== undefined) updates.condition = body.condition;
      if (body.description !== undefined) updates.description = body.description;
      if (body.version !== undefined) updates.version = body.version;
      if (body.manufacturer !== undefined) updates.manufacturer = body.manufacturer;
      if (body.visibility !== undefined) updates.visibility = body.visibility;
      if (body.tradeStatus !== undefined) updates.tradeStatus = body.tradeStatus;

      const [updated] = await app.db
        .update(schema.coins)
        .set(updates)
        .where(eq(schema.coins.id, id))
        .returning();

      // Update images if provided
      if (body.images !== undefined) {
        // Delete existing images
        await app.db.delete(schema.coinImages).where(eq(schema.coinImages.coinId, id));

        // Insert new images
        if (body.images.length > 0) {
          await app.db.insert(schema.coinImages).values(
            body.images.map((img) => ({
              coinId: id,
              url: img.url,
              orderIndex: img.orderIndex,
            }))
          );
        }
      }

      // Fetch full updated coin
      const fullCoin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, id),
        with: { images: true, likes: true, comments: true },
      });

      app.logger.info({ coinId: id, userId }, 'Coin updated successfully');
      return fullCoin;
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, coinId: id, userId }, 'Failed to update coin');
      throw error;
    }
  });

  /**
   * DELETE /api/coins/:id
   * Delete a coin (owner only)
   */
  app.fastify.delete('/api/coins/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    app.logger.info({ coinId: id }, 'DELETE /api/coins/:id - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug({ tokenPresent: !!sessionToken }, 'Session token extraction result');

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for coin deletion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session token not found in database');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({}, 'Session expired for coin deletion');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user record
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for valid session');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      userId = userRecord.id;
      app.logger.info({ userId }, 'Session validated successfully for coin deletion');
    } catch (sessionError) {
      app.logger.error({ err: sessionError }, 'Error during session validation');
      return reply.status(500).send({ error: 'Internal server error', message: 'Failed to validate session' });
    }

    try {
      // Check ownership
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, id),
      });

      if (!coin) {
        app.logger.warn({ coinId: id }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== userId) {
        app.logger.warn({ coinId: id, userId, ownerId: coin.userId }, 'Unauthorized coin deletion');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Delete coin (cascade will handle images, likes, comments)
      await app.db.delete(schema.coins).where(eq(schema.coins.id, id));

      app.logger.info({ coinId: id, userId }, 'Coin deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, coinId: id, userId }, 'Failed to delete coin');
      throw error;
    }
  });

  /**
   * GET /api/coins
   * Get public coins with pagination and filtering
   * Query params: page (default 1), limit (default 20), country?, year?, trade_status?, user_id?
   */
  app.fastify.get(
    '/api/coins',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as Record<string, string | undefined>;
      const { page = '1', limit = '20', country, year, trade_status, user_id } = query;
      const pageNum = Math.max(1, parseInt(page, 10) || 1);
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
      const offset = (pageNum - 1) * limitNum;

      app.logger.info(
        { page: pageNum, limit: limitNum, country, year, trade_status, user_id },
        'Fetching coins'
      );

      try {
        // Get current user session if authenticated
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
          // Not authenticated
        }

        // Build where conditions
        const whereConditions: any[] = [];

        // Visibility filter: public coins, or if user_id specified and matches current user, include their private coins
        if (user_id && currentUserId === user_id) {
          // Own profile - show all coins for this user
          whereConditions.push(eq(schema.coins.userId, user_id));
        } else {
          // Other profile or browse - show only public coins
          whereConditions.push(eq(schema.coins.visibility, 'public'));
          if (user_id) {
            whereConditions.push(eq(schema.coins.userId, user_id));
          }
        }

        // Apply optional filters
        if (country) {
          whereConditions.push(eq(schema.coins.country, country));
        }
        if (year) {
          whereConditions.push(eq(schema.coins.year, parseInt(year, 10)));
        }
        if (trade_status) {
          whereConditions.push(eq(schema.coins.tradeStatus, trade_status as 'not_for_trade' | 'open_to_trade'));
        }

        const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

        // Fetch coins
        const coins = await app.db.query.coins.findMany({
          where: whereClause,
          with: {
            user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
            images: { orderBy: (img) => img.orderIndex },
            likes: { columns: { userId: true } },
            comments: { columns: { id: true } },
          },
          orderBy: (coin) => coin.createdAt,
          limit: limitNum,
          offset: offset,
        });

        // Get total count for pagination
        const allCoins = await app.db.query.coins.findMany({
          where: whereClause,
          columns: { id: true },
        });
        const total = allCoins.length;

        // Generate signed URLs for images in all coins
        const result = await Promise.all(
          coins.map(async (coin) => {
            const imagesWithUrls = await Promise.all(
              coin.images.map(async (img) => {
                try {
                  const { url } = await app.storage.getSignedUrl(img.url);
                  return {
                    url,
                    orderIndex: img.orderIndex,
                  };
                } catch (urlError) {
                  app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                  return {
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
              version: coin.version,
              manufacturer: coin.manufacturer,
              user: { ...coin.user, avatarUrl: userAvatarUrl },
              images: imagesWithUrls,
              likeCount: coin.likes.length,
              commentCount: coin.comments.length,
              tradeStatus: coin.tradeStatus,
              createdAt: coin.createdAt,
            };
          })
        );

        app.logger.info({ count: result.length, total, page: pageNum, limit: limitNum }, 'Coins fetched');
        return {
          coins: result,
          total,
          page: pageNum,
          limit: limitNum,
        };
      } catch (error) {
        app.logger.error({ err: error, page, limit, country, year, trade_status, user_id }, 'Failed to fetch coins');
        throw error;
      }
    }
  );

  /**
   * GET /api/users/:id/coins
   * Get all coins for a specific user
   */
  app.fastify.get('/api/users/:id/coins', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id } = request.params as { id: string };

    app.logger.info({ userId: id }, 'Fetching user coins');

    try {
      // Try to get current user session to check if viewing own profile
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
        // Not authenticated
      }

      const isOwnProfile = currentUserId === id;

      // If viewing own profile, show all coins except temporary trade coins; otherwise show only public non-temporary coins
      const whereClause = isOwnProfile
        ? and(eq(schema.coins.userId, id), eq(schema.coins.isTemporaryTradeCoin, false))
        : and(
            eq(schema.coins.userId, id),
            eq(schema.coins.visibility, 'public'),
            eq(schema.coins.isTemporaryTradeCoin, false)
          );

      const coins = await app.db.query.coins.findMany({
        where: whereClause,
        with: {
          images: { orderBy: (img) => img.orderIndex },
          likes: { columns: { userId: true } },
          comments: { columns: { id: true } },
        },
        orderBy: (coin) => coin.createdAt,
      });

      // Generate signed URLs for images in all coins
      const result = await Promise.all(
        coins.map(async (coin) => {
          const imagesWithUrls = await Promise.all(
            coin.images.map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return {
                  url,
                  orderIndex: img.orderIndex,
                };
              } catch (urlError) {
                app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
                return {
                  url: null,
                  orderIndex: img.orderIndex,
                };
              }
            })
          );

          return {
            id: coin.id,
            title: coin.title,
            country: coin.country,
            year: coin.year,
            agency: coin.agency,
            version: coin.version,
            manufacturer: coin.manufacturer,
            images: imagesWithUrls,
            likeCount: coin.likes.length,
            commentCount: coin.comments.length,
            tradeStatus: coin.tradeStatus,
          };
        })
      );

      app.logger.info({ userId: id, count: result.length }, 'User coins fetched');
      return { coins: result, total: result.length };
    } catch (error) {
      app.logger.error({ err: error, userId: id }, 'Failed to fetch user coins');
      throw error;
    }
  });

  /**
   * PUT /api/coins/:coinId/availability
   * Update whether a coin is available for trading
   * Body: { forTrade: boolean }
   */
  app.fastify.put('/api/coins/:coinId/availability', async (request: FastifyRequest, reply: FastifyReply) => {
    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId }, 'PUT /api/coins/:coinId/availability - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for coin availability update'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for coin availability update');
        return reply.status(401).send({ error: 'Unauthorized', message: 'No active session' });
      }

      // Look up session in database
      const sessionRecord = await app.db.query.session.findFirst({
        where: eq(authSchema.session.token, sessionToken),
      });

      if (!sessionRecord) {
        app.logger.warn({ token: sessionToken.substring(0, 20) }, 'Session token not found in database');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session invalid or expired' });
      }

      // Check if session is expired
      if (new Date(sessionRecord.expiresAt) < new Date()) {
        app.logger.warn({ token: sessionToken.substring(0, 20), expiresAt: sessionRecord.expiresAt }, 'Session token expired');
        return reply.status(401).send({ error: 'Unauthorized', message: 'Session expired' });
      }

      // Get user from session
      const userRecord = await app.db.query.user.findFirst({
        where: eq(authSchema.user.id, sessionRecord.userId),
      });

      if (!userRecord) {
        app.logger.warn({ userId: sessionRecord.userId }, 'User not found for valid session');
        return reply.status(401).send({ error: 'Unauthorized', message: 'User not found' });
      }

      userId = userRecord.id;
      app.logger.info({ userId, coinId }, 'Session validated successfully for coin availability update');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for coin availability update');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ coinId, userId, body: request.body }, 'Updating coin availability');

    try {
      // Validate request body
      const body = UpdateCoinAvailabilitySchema.parse(request.body);

      // Get coin
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Check if user owns the coin
      if (coin.userId !== userId) {
        app.logger.warn({ coinId, userId, coinOwnerId: coin.userId }, 'User does not own this coin');
        return reply.status(403).send({ error: 'Forbidden - you do not own this coin' });
      }

      // Update coin trade status
      const newTradeStatus = body.forTrade ? 'open_to_trade' : 'not_for_trade';
      const [updatedCoin] = await app.db
        .update(schema.coins)
        .set({ tradeStatus: newTradeStatus as any, updatedAt: new Date() })
        .where(eq(schema.coins.id, coinId))
        .returning();

      app.logger.info(
        { coinId, userId, previousStatus: coin.tradeStatus, newStatus: newTradeStatus },
        'Coin availability updated successfully'
      );

      return {
        success: true,
        coin: {
          id: updatedCoin.id,
          title: updatedCoin.title,
          tradeStatus: updatedCoin.tradeStatus,
          updatedAt: updatedCoin.updatedAt,
        },
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, coinId, userId }, 'Failed to update coin availability');
      throw error;
    }
  });
}
