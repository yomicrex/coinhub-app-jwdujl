import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, ne } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';
import { extractSessionToken } from '../utils/auth-utils.js';

/**
 * Trade Management Routes
 *
 * Handles trade initiation, offers, messaging, shipping, and reporting
 */

const InitiateTradeSchema = z.object({
  coinId: z.string().uuid('Invalid coin ID'),
});

const CreateTradeOfferSchema = z.object({
  offeredCoinId: z.string().uuid('Invalid coin ID').optional().nullable(),
  message: z.string().max(1000).optional(),
});

const CounterOfferSchema = z.object({
  offeredCoinId: z.string().uuid('Invalid coin ID').optional().nullable(),
  message: z.string().max(1000).optional(),
});

const TradeMessageSchema = z.object({
  content: z.string().min(1).max(5000),
});

const ShippingUpdateSchema = z.object({
  shipped: z.boolean(),
  trackingNumber: z.string().max(100).optional().nullable(),
});

const TradeReportSchema = z.object({
  reason: z.string().min(1).max(100),
  description: z.string().max(1000),
});

export function registerTradesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/trades/initiate
   * Initiate a trade request for a coin marked as available for trade
   * Creates a new trade and opens private messaging with coin owner
   */
  app.fastify.post('/api/trades/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ body: request.body }, 'POST /api/trades/initiate - session extraction attempt');

    let userId: string | null = null;
    let userEmail: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trade initiation');
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
      userEmail = userRecord.email;
      app.logger.info({ userId, userEmail }, 'Session validated successfully for trade initiation');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trade initiation');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ userId, body: request.body }, 'Initiating trade');

    try {
      const body = InitiateTradeSchema.parse(request.body);

      // Fetch coin to verify it exists and is available for trade
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, body.coinId),
        with: { user: true },
      });

      if (!coin) {
        app.logger.warn({ coinId: body.coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.tradeStatus !== 'open_to_trade') {
        app.logger.warn({ coinId: body.coinId, tradeStatus: coin.tradeStatus }, 'Coin not available for trade');
        return reply.status(400).send({ error: 'Coin is not available for trade' });
      }

      if (coin.userId === userId) {
        app.logger.warn({ userId, coinId: body.coinId }, 'Cannot trade own coin');
        return reply.status(400).send({ error: 'Cannot initiate trade for your own coin' });
      }

      // Check if there's an active trade (only pending or accepted trades are considered active)
      // Allows new trades if previous trades are cancelled, completed, or disputed
      const existingActiveTrade = await app.db.query.trades.findFirst({
        where: and(
          eq(schema.trades.initiatorId, userId),
          eq(schema.trades.coinId, body.coinId),
          or(
            eq(schema.trades.status, 'pending'),
            eq(schema.trades.status, 'accepted')
          )
        ),
      });

      if (existingActiveTrade) {
        app.logger.warn({ userId, coinId: body.coinId, existingTradeId: existingActiveTrade.id }, 'Active trade already exists for this coin');
        return reply.status(409).send({
          error: 'You already have an active trade request for this coin',
          existingTradeId: existingActiveTrade.id,
          message: 'You can continue with the existing trade request'
        });
      }

      // Create new trade
      const [newTrade] = await app.db
        .insert(schema.trades)
        .values({
          initiatorId: userId,
          coinOwnerId: coin.userId,
          coinId: body.coinId,
        })
        .returning();

      // Create shipping record
      await app.db.insert(schema.tradeShipping).values({
        tradeId: newTrade.id,
      });

      app.logger.info({ tradeId: newTrade.id, userId, coinId: body.coinId }, 'Trade initiated successfully');

      return {
        trade: {
          id: newTrade.id,
          status: newTrade.status,
          coinId: newTrade.coinId,
          initiatorId: newTrade.initiatorId,
          coinOwnerId: newTrade.coinOwnerId,
          createdAt: newTrade.createdAt,
        },
        message: 'Trade initiated successfully',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId }, 'Failed to initiate trade');
      throw error;
    }
  });

  /**
   * GET /api/trades
   * Get all trades for the current user (both initiated and owned)
   * Query params: status (filter by status), role (initiator/owner)
   */
  app.fastify.get('/api/trades', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({}, 'GET /api/trades - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for trades list'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trades list');
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
      app.logger.info({ userId }, 'Session validated successfully for trades list');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trades list');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    const query = request.query as Record<string, string | undefined>;
    const status = query.status;
    const role = query.role; // 'initiator', 'owner', or undefined (both)

    app.logger.info({ userId, status, role }, 'Fetching trades');

    try {
      const whereConditions: any[] = [];

      if (role === 'initiator') {
        whereConditions.push(eq(schema.trades.initiatorId, userId));
      } else if (role === 'owner') {
        whereConditions.push(eq(schema.trades.coinOwnerId, userId));
      } else {
        whereConditions.push(
          or(
            eq(schema.trades.initiatorId, userId),
            eq(schema.trades.coinOwnerId, userId)
          )
        );
      }

      if (status) {
        whereConditions.push(eq(schema.trades.status, status as any));
      }

      const whereClause = whereConditions.length > 0 ? and(...whereConditions) : undefined;

      const trades = await app.db.query.trades.findMany({
        where: whereClause,
        with: {
          initiator: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          coinOwner: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          coin: {
            columns: { id: true, title: true, country: true, year: true },
            with: { images: true },
          },
          messages: {
            columns: { id: true, content: true, createdAt: true },
            orderBy: (m) => m.createdAt,
            limit: 1,
          },
        },
        orderBy: (t) => t.updatedAt,
      });

      // Generate signed URLs for user avatars and coin images
      const tradesWithSignedUrls = await Promise.all(
        trades.map(async (trade) => {
          let initiatorAvatarUrl = trade.initiator.avatarUrl;
          if (initiatorAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(initiatorAvatarUrl);
              initiatorAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: trade.initiator.id }, 'Failed to generate avatar signed URL');
              initiatorAvatarUrl = null;
            }
          }

          let ownerAvatarUrl = trade.coinOwner.avatarUrl;
          if (ownerAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(ownerAvatarUrl);
              ownerAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: trade.coinOwner.id }, 'Failed to generate avatar signed URL');
              ownerAvatarUrl = null;
            }
          }

          // Generate signed URLs for coin images
          const coinImagesWithUrls = await Promise.all(
            (trade.coin.images || []).map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return { ...img, url };
              } catch (urlError) {
                app.logger.warn({ err: urlError }, 'Failed to generate coin image signed URL');
                return img;
              }
            })
          );

          // Get the last message (most recent)
          const lastMessage = trade.messages && trade.messages.length > 0 ? trade.messages[trade.messages.length - 1] : null;

          return {
            id: trade.id,
            coin: {
              id: trade.coin.id,
              title: trade.coin.title,
              country: trade.coin.country,
              year: trade.coin.year,
              images: coinImagesWithUrls,
            },
            requester: {
              id: trade.initiator.id,
              username: trade.initiator.username,
              displayName: trade.initiator.displayName,
              avatarUrl: initiatorAvatarUrl,
            },
            owner: {
              id: trade.coinOwner.id,
              username: trade.coinOwner.username,
              displayName: trade.coinOwner.displayName,
              avatarUrl: ownerAvatarUrl,
            },
            status: trade.status,
            lastMessage: lastMessage ? { id: lastMessage.id, content: lastMessage.content, createdAt: lastMessage.createdAt } : null,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt,
          };
        })
      );

      app.logger.info({ userId, count: tradesWithSignedUrls.length }, 'Trades fetched');
      return { trades: tradesWithSignedUrls };
    } catch (error) {
      app.logger.error({ err: error, userId }, 'Failed to fetch trades');
      throw error;
    }
  });

  /**
   * GET /api/trades/:tradeId
   * Get detailed trade information with all offers, messages, and shipping status
   */
  app.fastify.get('/api/trades/:tradeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId }, 'GET /api/trades/:tradeId - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for trade detail'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trade detail');
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
      app.logger.info({ userId, tradeId }, 'Session validated successfully for trade detail');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trade detail');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ tradeId, userId }, 'Fetching trade detail');

    try {
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
        with: {
          initiator: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          coinOwner: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          coin: {
            with: { images: true },
          },
          offers: {
            with: {
              offerer: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
              offeredCoin: {
                columns: { id: true, title: true, country: true, year: true },
                with: { images: true },
              },
            },
            orderBy: (o) => o.createdAt,
          },
          messages: {
            with: {
              sender: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
            },
            orderBy: (m) => m.createdAt,
          },
          shipping: true,
        },
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check access control
      const hasAccess = trade.initiatorId === userId || trade.coinOwnerId === userId;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId }, 'Unauthorized trade access');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Generate signed URLs for avatars
      let initiatorAvatarUrl = trade.initiator.avatarUrl;
      if (initiatorAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(initiatorAvatarUrl);
          initiatorAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: trade.initiator.id }, 'Failed to generate avatar signed URL');
          initiatorAvatarUrl = null;
        }
      }

      let ownerAvatarUrl = trade.coinOwner.avatarUrl;
      if (ownerAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(ownerAvatarUrl);
          ownerAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError, userId: trade.coinOwner.id }, 'Failed to generate avatar signed URL');
          ownerAvatarUrl = null;
        }
      }

      const offersWithAvatars = await Promise.all(
        trade.offers.map(async (offer) => {
          let offererAvatarUrl = offer.offerer.avatarUrl;
          if (offererAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(offererAvatarUrl);
              offererAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: offer.offerer.id }, 'Failed to generate avatar signed URL');
              offererAvatarUrl = null;
            }
          }
          return {
            ...offer,
            offerer: { ...offer.offerer, avatarUrl: offererAvatarUrl },
          };
        })
      );

      const messagesWithAvatars = await Promise.all(
        trade.messages.map(async (msg) => {
          let senderAvatarUrl = msg.sender.avatarUrl;
          if (senderAvatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(senderAvatarUrl);
              senderAvatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: msg.sender.id }, 'Failed to generate avatar signed URL');
              senderAvatarUrl = null;
            }
          }
          return {
            ...msg,
            sender: { ...msg.sender, avatarUrl: senderAvatarUrl },
          };
        })
      );

      // Generate signed URLs for coin images
      const coinImagesWithUrls = await Promise.all(
        (trade.coin.images || []).map(async (img) => {
          try {
            const { url } = await app.storage.getSignedUrl(img.url);
            return { ...img, url };
          } catch (urlError) {
            app.logger.warn({ err: urlError }, 'Failed to generate coin image signed URL');
            return img;
          }
        })
      );

      // Generate signed URLs for offered coin images
      const offersWithImagesAndAvatars = await Promise.all(
        offersWithAvatars.map(async (offer) => {
          const offeredCoinImagesWithUrls = await Promise.all(
            (offer.offeredCoin?.images || []).map(async (img) => {
              try {
                const { url } = await app.storage.getSignedUrl(img.url);
                return { ...img, url };
              } catch (urlError) {
                app.logger.warn({ err: urlError }, 'Failed to generate offered coin image signed URL');
                return img;
              }
            })
          );

          return {
            ...offer,
            offeredCoin: offer.offeredCoin ? { ...offer.offeredCoin, images: offeredCoinImagesWithUrls } : null,
          };
        })
      );

      app.logger.info({ tradeId, userId }, 'Trade detail fetched');

      return {
        ...trade,
        coin: { ...trade.coin, images: coinImagesWithUrls },
        initiator: { ...trade.initiator, avatarUrl: initiatorAvatarUrl },
        coinOwner: { ...trade.coinOwner, avatarUrl: ownerAvatarUrl },
        offers: offersWithImagesAndAvatars,
        messages: messagesWithAvatars,
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId }, 'Failed to fetch trade detail');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/offers/upload
   * Upload a temporary coin as a trade offer (with images)
   * Creates a temporary trade coin and immediately creates an offer for it
   *
   * Accepts multipart form data with:
   * - images[] (1-5 images, required)
   * - title, country, year (required)
   * - unit, organization, agency, deployment, coinNumber, mintMark, condition, description, version, manufacturer (optional)
   * - message (optional - message to include with offer)
   *
   * Returns: { success: true, offer: { id, coin: {...}, message, status, createdAt } }
   */
  app.fastify.post('/api/trades/:tradeId/offers/upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId }, 'POST /api/trades/:tradeId/offers/upload - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for offer upload'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for offer upload');
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
      app.logger.info({ userId, tradeId }, 'Session validated successfully for offer upload');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for offer upload');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ tradeId, userId }, 'Processing offer upload');

    try {
      // Verify trade exists and user is a participant
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      const isParticipant = trade.initiatorId === userId || trade.coinOwnerId === userId;
      if (!isParticipant) {
        app.logger.warn({ tradeId, userId }, 'User is not a participant in this trade');
        return reply.status(403).send({ error: 'Unauthorized - not a trade participant' });
      }

      // Parse multipart form data
      const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } });

      if (!data) {
        app.logger.warn({ tradeId, userId }, 'No form data provided');
        return reply.status(400).send({ error: 'Form data required' });
      }

      // Parse fields from form data
      const fields: Record<string, string> = {};
      const images: Buffer[] = [];
      const imageFilenames: string[] = [];

      // Read all form fields and files
      let fileCount = 0;
      for await (const part of request.parts()) {
        if (part.type === 'field') {
          fields[part.fieldname] = part.value as string;
        } else if (part.type === 'file') {
          fileCount++;
          if (fileCount > 5) {
            app.logger.warn({ tradeId, userId }, 'Too many images provided (max 5)');
            return reply.status(400).send({ error: 'Maximum 5 images allowed' });
          }
          const buffer = await part.toBuffer();
          const ext = part.filename.split('.').pop()?.toLowerCase();
          if (!ext || !['jpg', 'jpeg', 'png', 'webp'].includes(ext)) {
            app.logger.warn({ tradeId, filename: part.filename }, 'Invalid image format');
            return reply.status(400).send({ error: 'Invalid image format. Allowed: jpg, jpeg, png, webp' });
          }
          images.push(buffer);
          imageFilenames.push(part.filename);
        }
      }

      if (images.length === 0) {
        app.logger.warn({ tradeId, userId }, 'No images provided');
        return reply.status(400).send({ error: 'At least 1 image required' });
      }

      // Validate required fields
      const CreateUploadOfferSchema = z.object({
        title: z.string().min(1).max(255),
        country: z.string().min(1).max(100),
        year: z.coerce.number().int().min(1800).max(new Date().getFullYear()),
        unit: z.string().max(100).optional(),
        organization: z.string().max(100).optional(),
        agency: z.string().max(100).optional(),
        deployment: z.string().max(100).optional(),
        coinNumber: z.string().max(100).optional(),
        mintMark: z.string().max(50).optional(),
        condition: z.string().max(100).optional(),
        description: z.string().max(2000).optional(),
        version: z.string().max(100).optional(),
        manufacturer: z.string().max(100).optional(),
        message: z.string().max(1000).optional(),
      });

      const validationResult = CreateUploadOfferSchema.safeParse(fields);
      if (!validationResult.success) {
        app.logger.warn({ tradeId, userId, errors: validationResult.error.issues }, 'Validation failed');
        return reply.status(400).send({ error: 'Validation failed', details: validationResult.error.issues });
      }

      const coinData = validationResult.data;

      // Create temporary trade coin
      const [newCoin] = await app.db
        .insert(schema.coins)
        .values({
          userId,
          title: coinData.title,
          country: coinData.country,
          year: coinData.year,
          unit: coinData.unit,
          organization: coinData.organization,
          agency: coinData.agency,
          deployment: coinData.deployment,
          coinNumber: coinData.coinNumber,
          mintMark: coinData.mintMark,
          condition: coinData.condition,
          description: coinData.description,
          version: coinData.version,
          manufacturer: coinData.manufacturer,
          visibility: 'private',
          tradeStatus: 'not_for_trade',
          isTemporaryTradeCoin: true,
        })
        .returning();

      app.logger.info({ tradeId, userId, coinId: newCoin.id }, 'Temporary trade coin created');

      // Upload images
      try {
        for (let i = 0; i < images.length; i++) {
          const timestamp = Date.now();
          const cleanFilename = imageFilenames[i].replace(/[^a-zA-Z0-9.-]/g, '_');
          const key = `coins/${newCoin.id}/${timestamp}-${i}-${cleanFilename}`;
          const storageKey = await app.storage.upload(key, images[i]);

          // Save image record
          await app.db.insert(schema.coinImages).values({
            coinId: newCoin.id,
            url: storageKey,
            orderIndex: i,
          });
        }
        app.logger.info({ coinId: newCoin.id, imageCount: images.length }, 'Images uploaded successfully');
      } catch (imageError) {
        app.logger.error({ err: imageError, coinId: newCoin.id }, 'Error uploading images');
        // Delete the coin since image upload failed
        await app.db.delete(schema.coins).where(eq(schema.coins.id, newCoin.id));
        return reply.status(503).send({ error: 'Failed to upload images' });
      }

      // Create trade offer
      const [newOffer] = await app.db
        .insert(schema.tradeOffers)
        .values({
          tradeId,
          offererId: userId,
          offeredCoinId: newCoin.id,
          message: coinData.message,
          status: 'pending',
        })
        .returning();

      app.logger.info({ tradeId, offerId: newOffer.id, coinId: newCoin.id, userId }, 'Trade offer created with uploaded coin');

      // Get coin with images for response
      const coinWithImages = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, newCoin.id),
        with: {
          images: { orderBy: (img) => img.orderIndex },
        },
      });

      // Generate signed URLs for images
      const imagesWithUrls = await Promise.all(
        (coinWithImages?.images || []).map(async (img) => {
          try {
            const { url } = await app.storage.getSignedUrl(img.url);
            return { id: img.id, url, orderIndex: img.orderIndex };
          } catch (urlError) {
            app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
            return { id: img.id, url: null, orderIndex: img.orderIndex };
          }
        })
      );

      return {
        success: true,
        offer: {
          id: newOffer.id,
          coin: {
            id: newCoin.id,
            title: newCoin.title,
            country: newCoin.country,
            year: newCoin.year,
            agency: newCoin.agency,
            version: newCoin.version,
            manufacturer: newCoin.manufacturer,
            images: imagesWithUrls,
          },
          message: newOffer.message,
          status: newOffer.status,
          createdAt: newOffer.createdAt,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId }, 'Failed to upload offer');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/offers
   * Create or counter a trade offer
   */
  app.fastify.post('/api/trades/:tradeId/offers', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId }, 'POST /api/trades/:tradeId/offers - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for trade offer'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trade offer');
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
      app.logger.info({ userId, tradeId }, 'Session validated successfully for trade offer');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trade offer');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ tradeId, userId, body: request.body }, 'Creating trade offer');

    try {
      const body = CreateTradeOfferSchema.parse(request.body);

      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check access control
      const hasAccess = trade.initiatorId === userId || trade.coinOwnerId === userId;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId }, 'Unauthorized offer creation');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Validate offered coin if provided
      if (body.offeredCoinId) {
        const offeredCoin = await app.db.query.coins.findFirst({
          where: eq(schema.coins.id, body.offeredCoinId),
        });

        if (!offeredCoin) {
          app.logger.warn({ coinId: body.offeredCoinId }, 'Offered coin not found');
          return reply.status(404).send({ error: 'Offered coin not found' });
        }

        if (offeredCoin.userId !== userId) {
          app.logger.warn({ coinId: body.offeredCoinId, userId }, 'Cannot offer other user\'s coin');
          return reply.status(403).send({ error: 'Can only offer your own coins' });
        }
      }

      // Create trade offer
      const [newOffer] = await app.db
        .insert(schema.tradeOffers)
        .values({
          tradeId,
          offererId: userId,
          offeredCoinId: body.offeredCoinId || null,
          message: body.message || null,
          isCounterOffer: trade.status !== 'pending',
        })
        .returning();

      // Update trade status to countered if needed
      if (trade.status === 'pending') {
        await app.db
          .update(schema.trades)
          .set({ status: 'countered', updatedAt: new Date() })
          .where(eq(schema.trades.id, tradeId));
      }

      // Fetch full offer with related data
      const offerWithDetails = await app.db.query.tradeOffers.findFirst({
        where: eq(schema.tradeOffers.id, newOffer.id),
        with: {
          offerer: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          offeredCoin: {
            columns: { id: true, title: true, country: true, year: true },
            with: { images: true },
          },
        },
      });

      // Generate signed URL for offerer avatar
      let offererAvatarUrl = offerWithDetails?.offerer.avatarUrl;
      if (offererAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(offererAvatarUrl);
          offererAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError }, 'Failed to generate offerer avatar signed URL');
          offererAvatarUrl = null;
        }
      }

      // Generate signed URLs for coin images
      const coinImagesWithUrls = await Promise.all(
        (offerWithDetails?.offeredCoin?.images || []).map(async (img) => {
          try {
            const { url } = await app.storage.getSignedUrl(img.url);
            return { ...img, url };
          } catch (urlError) {
            app.logger.warn({ err: urlError }, 'Failed to generate image signed URL');
            return img;
          }
        })
      );

      app.logger.info({ offerId: newOffer.id, tradeId, userId }, 'Trade offer created');

      return {
        id: newOffer.id,
        coin: offerWithDetails?.offeredCoin ? {
          id: offerWithDetails.offeredCoin.id,
          title: offerWithDetails.offeredCoin.title,
          country: offerWithDetails.offeredCoin.country,
          year: offerWithDetails.offeredCoin.year,
          images: coinImagesWithUrls,
        } : null,
        offeredBy: {
          id: offerWithDetails?.offerer.id,
          username: offerWithDetails?.offerer.username,
          displayName: offerWithDetails?.offerer.displayName,
          avatarUrl: offererAvatarUrl,
        },
        message: newOffer.message,
        isCounterOffer: newOffer.isCounterOffer,
        status: newOffer.status,
        createdAt: newOffer.createdAt,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId }, 'Failed to create trade offer');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/offers/:offerId/accept
   * Accept a trade offer
   */
  app.fastify.post('/api/trades/:tradeId/offers/:offerId/accept', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId, offerId } = request.params as { tradeId: string; offerId: string };

    app.logger.info({ tradeId, offerId, userId: session.user.id }, 'Accepting trade offer');

    try {
      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Only coin owner can accept offers
      if (trade.coinOwnerId !== session.user.id) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized offer acceptance');
        return reply.status(403).send({ error: 'Only coin owner can accept offers' });
      }

      // Get offer
      const offer = await app.db.query.tradeOffers.findFirst({
        where: eq(schema.tradeOffers.id, offerId),
      });

      if (!offer) {
        app.logger.warn({ offerId }, 'Offer not found');
        return reply.status(404).send({ error: 'Offer not found' });
      }

      // Update offer status
      await app.db
        .update(schema.tradeOffers)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(schema.tradeOffers.id, offerId));

      // Auto-reject all other pending offers for this trade to prevent confusion
      await app.db
        .update(schema.tradeOffers)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(
          and(
            eq(schema.tradeOffers.tradeId, tradeId),
            ne(schema.tradeOffers.id, offerId),
            eq(schema.tradeOffers.status, 'pending')
          )
        );

      // Update trade status to accepted
      await app.db
        .update(schema.trades)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId));

      // Fetch updated trade with full details
      const updatedTrade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
        with: {
          coin: {
            columns: { id: true, title: true, country: true, year: true },
          },
          initiator: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
          coinOwner: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      // Generate signed URLs for avatars
      let initiatorAvatarUrl = updatedTrade?.initiator.avatarUrl;
      if (initiatorAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(initiatorAvatarUrl);
          initiatorAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError }, 'Failed to generate avatar signed URL');
          initiatorAvatarUrl = null;
        }
      }

      let ownerAvatarUrl = updatedTrade?.coinOwner.avatarUrl;
      if (ownerAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(ownerAvatarUrl);
          ownerAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError }, 'Failed to generate avatar signed URL');
          ownerAvatarUrl = null;
        }
      }

      app.logger.info({ offerId, tradeId, userId: session.user.id }, 'Trade offer accepted');

      return {
        id: updatedTrade?.id,
        coin: {
          id: updatedTrade?.coin.id,
          title: updatedTrade?.coin.title,
          country: updatedTrade?.coin.country,
          year: updatedTrade?.coin.year,
        },
        requester: {
          id: updatedTrade?.initiator.id,
          username: updatedTrade?.initiator.username,
          displayName: updatedTrade?.initiator.displayName,
          avatarUrl: initiatorAvatarUrl,
        },
        owner: {
          id: updatedTrade?.coinOwner.id,
          username: updatedTrade?.coinOwner.username,
          displayName: updatedTrade?.coinOwner.displayName,
          avatarUrl: ownerAvatarUrl,
        },
        status: updatedTrade?.status,
        message: 'Offer accepted. Prepare your coin for shipping.',
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, offerId, userId: session.user.id }, 'Failed to accept offer');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/offers/:offerId/reject
   * Reject a trade offer
   */
  app.fastify.post('/api/trades/:tradeId/offers/:offerId/reject', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId, offerId } = request.params as { tradeId: string; offerId: string };

    app.logger.info({ tradeId, offerId, userId: session.user.id }, 'Rejecting trade offer');

    try {
      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Only coin owner can reject offers
      if (trade.coinOwnerId !== session.user.id) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized offer rejection');
        return reply.status(403).send({ error: 'Only coin owner can reject offers' });
      }

      // Get offer
      const offer = await app.db.query.tradeOffers.findFirst({
        where: eq(schema.tradeOffers.id, offerId),
      });

      if (!offer) {
        app.logger.warn({ offerId }, 'Offer not found');
        return reply.status(404).send({ error: 'Offer not found' });
      }

      // Update offer status
      const updatedOffer = await app.db
        .update(schema.tradeOffers)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(schema.tradeOffers.id, offerId))
        .returning();

      app.logger.info({ offerId, tradeId, userId: session.user.id }, 'Trade offer rejected');

      return {
        id: updatedOffer[0]?.id,
        status: updatedOffer[0]?.status || 'rejected',
        message: 'Offer rejected.',
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, offerId, userId: session.user.id }, 'Failed to reject offer');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/messages
   * Send a message in a trade conversation
   */
  app.fastify.post('/api/trades/:tradeId/messages', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId }, 'POST /api/trades/:tradeId/messages - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for trade message'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trade message');
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
      app.logger.info({ userId, tradeId }, 'Session validated successfully for trade message');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trade message');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ tradeId, userId, body: request.body }, 'Sending trade message');

    try {
      const body = TradeMessageSchema.parse(request.body);

      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check access control
      const hasAccess = trade.initiatorId === userId || trade.coinOwnerId === userId;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId }, 'Unauthorized message send');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Create message
      const [newMessage] = await app.db
        .insert(schema.tradeMessages)
        .values({
          tradeId,
          senderId: userId,
          content: body.content,
        })
        .returning();

      // Fetch full message with sender info
      const messageWithSender = await app.db.query.tradeMessages.findFirst({
        where: eq(schema.tradeMessages.id, newMessage.id),
        with: {
          sender: {
            columns: { id: true, username: true, displayName: true, avatarUrl: true },
          },
        },
      });

      // Generate signed URL for sender avatar
      let senderAvatarUrl = messageWithSender?.sender.avatarUrl;
      if (senderAvatarUrl) {
        try {
          const { url } = await app.storage.getSignedUrl(senderAvatarUrl);
          senderAvatarUrl = url;
        } catch (urlError) {
          app.logger.warn({ err: urlError }, 'Failed to generate sender avatar signed URL');
          senderAvatarUrl = null;
        }
      }

      app.logger.info({ messageId: newMessage.id, tradeId, userId }, 'Trade message sent');

      return {
        id: newMessage.id,
        sender: {
          id: messageWithSender?.sender.id,
          username: messageWithSender?.sender.username,
          displayName: messageWithSender?.sender.displayName,
          avatarUrl: senderAvatarUrl,
        },
        content: newMessage.content,
        createdAt: newMessage.createdAt,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId }, 'Failed to send message');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/shipping/initiate
   * Mark coins as shipped with tracking number
   */
  app.fastify.post('/api/trades/:tradeId/shipping/initiate', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id, body: request.body }, 'Initiating shipping');

    try {
      const body = ShippingUpdateSchema.parse(request.body);

      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
        with: { shipping: true },
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      if (trade.status !== 'accepted') {
        app.logger.warn({ tradeId, status: trade.status }, 'Trade not accepted yet');
        return reply.status(400).send({ error: 'Trade must be accepted before shipping' });
      }

      // Check access and determine if initiator or owner is shipping
      const isInitiator = trade.initiatorId === session.user.id;
      const isOwner = trade.coinOwnerId === session.user.id;

      if (!isInitiator && !isOwner) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized shipping update');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Update shipping record
      const updates: any = {};
      if (isInitiator) {
        updates.initiatorShipped = true;
        updates.initiatorShippedAt = new Date();
        if (body.trackingNumber) {
          updates.initiatorTrackingNumber = body.trackingNumber;
        }
      } else {
        updates.ownerShipped = true;
        updates.ownerShippedAt = new Date();
        if (body.trackingNumber) {
          updates.ownerTrackingNumber = body.trackingNumber;
        }
      }

      await app.db
        .update(schema.tradeShipping)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.tradeShipping.tradeId, tradeId));

      // Fetch updated shipping record
      const updatedShipping = await app.db.query.tradeShipping.findFirst({
        where: eq(schema.tradeShipping.tradeId, tradeId),
      });

      app.logger.info({ tradeId, userId: session.user.id }, 'Shipping initiated');

      // Return shipping info based on who made the update
      const shippingInfo = isInitiator ? {
        initiatorShipped: updatedShipping?.initiatorShipped || false,
        initiatorTrackingNumber: updatedShipping?.initiatorTrackingNumber || null,
        initiatorShippedAt: updatedShipping?.initiatorShippedAt || null,
      } : {
        ownerShipped: updatedShipping?.ownerShipped || false,
        ownerTrackingNumber: updatedShipping?.ownerTrackingNumber || null,
        ownerShippedAt: updatedShipping?.ownerShippedAt || null,
      };

      return {
        ...shippingInfo,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to initiate shipping');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/shipping/received
   * Mark coins as received
   */
  app.fastify.post('/api/trades/:tradeId/shipping/received', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id }, 'Marking coins as received');

    try {
      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
        with: { shipping: true },
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check access and determine if initiator or owner received coins
      const isInitiator = trade.initiatorId === session.user.id;
      const isOwner = trade.coinOwnerId === session.user.id;

      if (!isInitiator && !isOwner) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized received update');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Update shipping record
      const updates: any = {};
      if (isInitiator) {
        updates.initiatorReceived = true;
        updates.initiatorReceivedAt = new Date();
      } else {
        updates.ownerReceived = true;
        updates.ownerReceivedAt = new Date();
      }

      await app.db
        .update(schema.tradeShipping)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(schema.tradeShipping.tradeId, tradeId));

      // Check if both have received, if so mark trade as completed
      const updatedShipping = await app.db.query.tradeShipping.findFirst({
        where: eq(schema.tradeShipping.tradeId, tradeId),
      });

      let tradeCompleted = false;
      if (updatedShipping?.initiatorReceived && updatedShipping.ownerReceived) {
        await app.db
          .update(schema.trades)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(schema.trades.id, tradeId));

        tradeCompleted = true;
        app.logger.info({ tradeId }, 'Trade marked as completed');
      }

      app.logger.info({ tradeId, userId: session.user.id }, 'Coins marked as received');

      // Return shipping info based on who marked as received
      const receivedInfo = isInitiator ? {
        initiatorReceived: updatedShipping?.initiatorReceived || false,
        initiatorReceivedAt: updatedShipping?.initiatorReceivedAt || null,
      } : {
        ownerReceived: updatedShipping?.ownerReceived || false,
        ownerReceivedAt: updatedShipping?.ownerReceivedAt || null,
      };

      return {
        ...receivedInfo,
        tradeCompleted,
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to mark as received');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/report
   * Report a trade violation or dispute
   */
  app.fastify.post('/api/trades/:tradeId/report', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id, body: request.body }, 'Reporting trade violation');

    try {
      const body = TradeReportSchema.parse(request.body);

      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Check access - must be part of the trade
      const hasAccess = trade.initiatorId === session.user.id || trade.coinOwnerId === session.user.id;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized report');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Determine who is being reported
      const reportedUserId = trade.initiatorId === session.user.id ? trade.coinOwnerId : trade.initiatorId;

      // Create report
      const [newReport] = await app.db
        .insert(schema.tradeReports)
        .values({
          tradeId,
          reporterId: session.user.id,
          reportedUserId,
          reason: body.reason,
          description: body.description || null,
        })
        .returning();

      // Update trade status to disputed
      await app.db
        .update(schema.trades)
        .set({ status: 'disputed', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId));

      // Fetch updated trade status
      const updatedTrade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      app.logger.info({ reportId: newReport.id, tradeId, reporterId: session.user.id }, 'Trade reported');

      return {
        id: newReport.id,
        reportId: newReport.id,
        status: newReport.status,
        tradeStatus: updatedTrade?.status,
        message: 'Trade violation reported. Our support team will review this shortly.',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to report trade');
      throw error;
    }
  });

  /**
   * GET /api/trades/:tradeId/reports
   * Get all reports for a trade (admin/moderator only)
   */
  app.fastify.get('/api/trades/:tradeId/reports', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id }, 'Fetching trade reports');

    try {
      // Check if user is admin/moderator
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
      });

      if (user?.role !== 'admin' && user?.role !== 'moderator') {
        app.logger.warn({ userId: session.user.id }, 'Unauthorized reports access');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      const reports = await app.db.query.tradeReports.findMany({
        where: eq(schema.tradeReports.tradeId, tradeId),
        with: {
          reporter: { columns: { id: true, username: true, displayName: true } },
          reportedUser: { columns: { id: true, username: true, displayName: true } },
          reviewer: { columns: { id: true, username: true, displayName: true } },
        },
        orderBy: (r) => r.createdAt,
      });

      app.logger.info({ tradeId, count: reports.length }, 'Trade reports fetched');
      return { reports };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to fetch reports');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/cancel
   * Cancel a trade (before completion)
   */
  app.fastify.post('/api/trades/:tradeId/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId }, 'POST /api/trades/:tradeId/cancel - session extraction attempt');

    let userId: string | null = null;

    try {
      // Extract session token from either Authorization header or cookies
      const sessionToken = extractSessionToken(request);
      app.logger.debug(
        { tokenPresent: !!sessionToken, hasAuthHeader: !!request.headers.authorization, hasCookie: !!request.headers.cookie },
        'Session token extraction result for trade cancellation'
      );

      if (!sessionToken) {
        app.logger.warn({}, 'No session token found in request for trade cancellation');
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
      app.logger.info({ userId, tradeId }, 'Session validated successfully for trade cancellation');
    } catch (error) {
      app.logger.error({ err: error }, 'Error validating session for trade cancellation');
      return reply.status(500).send({ error: 'Internal server error', message: 'Session validation failed' });
    }

    app.logger.info({ tradeId, userId }, 'Cancelling trade');

    try {
      // Get trade
      const trade = await app.db.query.trades.findFirst({
        where: eq(schema.trades.id, tradeId),
      });

      if (!trade) {
        app.logger.warn({ tradeId }, 'Trade not found');
        return reply.status(404).send({ error: 'Trade not found' });
      }

      // Only initiator can cancel pending/countered trades; either party for accepted
      const canCancel =
        (trade.status === 'pending' || trade.status === 'countered') && trade.initiatorId === userId ||
        trade.status === 'accepted' && (trade.initiatorId === userId || trade.coinOwnerId === userId);

      if (!canCancel) {
        app.logger.warn({ tradeId, userId, status: trade.status }, 'Cannot cancel this trade');
        return reply.status(400).send({ error: 'Cannot cancel this trade in its current status' });
      }

      // Update trade status to cancelled
      const updatedTrade = await app.db
        .update(schema.trades)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId))
        .returning();

      app.logger.info({ tradeId, userId }, 'Trade cancelled');

      return {
        id: updatedTrade[0]?.id,
        status: updatedTrade[0]?.status || 'cancelled',
        message: 'Trade cancelled',
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId }, 'Failed to cancel trade');
      throw error;
    }
  });
}
