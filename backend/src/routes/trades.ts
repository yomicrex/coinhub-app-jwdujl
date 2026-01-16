import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

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
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id, body: request.body }, 'Initiating trade');

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

      if (coin.userId === session.user.id) {
        app.logger.warn({ userId: session.user.id, coinId: body.coinId }, 'Cannot trade own coin');
        return reply.status(400).send({ error: 'Cannot initiate trade for your own coin' });
      }

      // Check if trade already exists
      const existingTrade = await app.db.query.trades.findFirst({
        where: and(
          eq(schema.trades.initiatorId, session.user.id),
          eq(schema.trades.coinId, body.coinId),
          or(
            eq(schema.trades.status, 'pending'),
            eq(schema.trades.status, 'accepted'),
            eq(schema.trades.status, 'countered')
          )
        ),
      });

      if (existingTrade) {
        app.logger.warn({ userId: session.user.id, coinId: body.coinId }, 'Trade already exists');
        return reply.status(400).send({ error: 'Trade request already exists for this coin' });
      }

      // Create new trade
      const [newTrade] = await app.db
        .insert(schema.trades)
        .values({
          initiatorId: session.user.id,
          coinOwnerId: coin.userId,
          coinId: body.coinId,
        })
        .returning();

      // Create shipping record
      await app.db.insert(schema.tradeShipping).values({
        tradeId: newTrade.id,
      });

      app.logger.info({ tradeId: newTrade.id, userId: session.user.id, coinId: body.coinId }, 'Trade initiated successfully');

      return {
        trade: {
          id: newTrade.id,
          initiatorId: newTrade.initiatorId,
          coinOwnerId: newTrade.coinOwnerId,
          coinId: newTrade.coinId,
          status: newTrade.status,
          createdAt: newTrade.createdAt,
          updatedAt: newTrade.updatedAt,
        },
        message: 'Trade initiated. You can now send offers to the coin owner.',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to initiate trade');
      throw error;
    }
  });

  /**
   * GET /api/trades
   * Get all trades for the current user (both initiated and owned)
   * Query params: status (filter by status), role (initiator/owner)
   */
  app.fastify.get('/api/trades', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const query = request.query as Record<string, string | undefined>;
    const status = query.status;
    const role = query.role; // 'initiator', 'owner', or undefined (both)

    app.logger.info({ userId: session.user.id, status, role }, 'Fetching trades');

    try {
      const whereConditions: any[] = [];

      if (role === 'initiator') {
        whereConditions.push(eq(schema.trades.initiatorId, session.user.id));
      } else if (role === 'owner') {
        whereConditions.push(eq(schema.trades.coinOwnerId, session.user.id));
      } else {
        whereConditions.push(
          or(
            eq(schema.trades.initiatorId, session.user.id),
            eq(schema.trades.coinOwnerId, session.user.id)
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
          },
          offers: {
            columns: { id: true, status: true, createdAt: true },
          },
          messages: {
            columns: { id: true, createdAt: true },
          },
        },
        orderBy: (t) => t.updatedAt,
      });

      // Generate signed URLs for user avatars
      const tradesWithAvatars = await Promise.all(
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

          return {
            ...trade,
            initiator: { ...trade.initiator, avatarUrl: initiatorAvatarUrl },
            coinOwner: { ...trade.coinOwner, avatarUrl: ownerAvatarUrl },
          };
        })
      );

      app.logger.info({ userId: session.user.id, count: tradesWithAvatars.length }, 'Trades fetched');
      return { trades: tradesWithAvatars };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch trades');
      throw error;
    }
  });

  /**
   * GET /api/trades/:tradeId
   * Get detailed trade information with all offers, messages, and shipping status
   */
  app.fastify.get('/api/trades/:tradeId', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id }, 'Fetching trade detail');

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
          coin: true,
          offers: {
            with: {
              offerer: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
              offeredCoin: { columns: { id: true, title: true, country: true, year: true } },
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
      const hasAccess = trade.initiatorId === session.user.id || trade.coinOwnerId === session.user.id;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized trade access');
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

      app.logger.info({ tradeId, userId: session.user.id }, 'Trade detail fetched');

      return {
        ...trade,
        initiator: { ...trade.initiator, avatarUrl: initiatorAvatarUrl },
        coinOwner: { ...trade.coinOwner, avatarUrl: ownerAvatarUrl },
        offers: offersWithAvatars,
        messages: messagesWithAvatars,
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to fetch trade detail');
      throw error;
    }
  });

  /**
   * POST /api/trades/:tradeId/offers
   * Create or counter a trade offer
   */
  app.fastify.post('/api/trades/:tradeId/offers', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id, body: request.body }, 'Creating trade offer');

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
      const hasAccess = trade.initiatorId === session.user.id || trade.coinOwnerId === session.user.id;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized offer creation');
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

        if (offeredCoin.userId !== session.user.id) {
          app.logger.warn({ coinId: body.offeredCoinId, userId: session.user.id }, 'Cannot offer other user\'s coin');
          return reply.status(403).send({ error: 'Can only offer your own coins' });
        }
      }

      // Create trade offer
      const [newOffer] = await app.db
        .insert(schema.tradeOffers)
        .values({
          tradeId,
          offererId: session.user.id,
          offeredCoinId: body.offeredCoinId || null,
          message: body.message || null,
        })
        .returning();

      // Update trade status to countered if needed
      if (trade.status === 'pending') {
        await app.db
          .update(schema.trades)
          .set({ status: 'countered', updatedAt: new Date() })
          .where(eq(schema.trades.id, tradeId));
      }

      app.logger.info({ offerId: newOffer.id, tradeId, userId: session.user.id }, 'Trade offer created');

      return {
        offerId: newOffer.id,
        status: 'success',
        message: 'Offer created successfully',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to create trade offer');
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

      // Update trade status to accepted
      await app.db
        .update(schema.trades)
        .set({ status: 'accepted', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId));

      app.logger.info({ offerId, tradeId, userId: session.user.id }, 'Trade offer accepted');

      return {
        status: 'success',
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
      await app.db
        .update(schema.tradeOffers)
        .set({ status: 'rejected', updatedAt: new Date() })
        .where(eq(schema.tradeOffers.id, offerId));

      app.logger.info({ offerId, tradeId, userId: session.user.id }, 'Trade offer rejected');

      return {
        status: 'success',
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
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id, body: request.body }, 'Sending trade message');

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
      const hasAccess = trade.initiatorId === session.user.id || trade.coinOwnerId === session.user.id;
      if (!hasAccess) {
        app.logger.warn({ tradeId, userId: session.user.id }, 'Unauthorized message send');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Create message
      const [newMessage] = await app.db
        .insert(schema.tradeMessages)
        .values({
          tradeId,
          senderId: session.user.id,
          content: body.content,
        })
        .returning();

      app.logger.info({ messageId: newMessage.id, tradeId, userId: session.user.id }, 'Trade message sent');

      return {
        messageId: newMessage.id,
        status: 'success',
        message: 'Message sent successfully',
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to send message');
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

      app.logger.info({ tradeId, userId: session.user.id }, 'Shipping initiated');

      return {
        status: 'success',
        message: 'Coins marked as shipped',
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

      if (updatedShipping?.initiatorReceived && updatedShipping.ownerReceived) {
        await app.db
          .update(schema.trades)
          .set({ status: 'completed', updatedAt: new Date() })
          .where(eq(schema.trades.id, tradeId));

        app.logger.info({ tradeId }, 'Trade marked as completed');
      }

      app.logger.info({ tradeId, userId: session.user.id }, 'Coins marked as received');

      return {
        status: 'success',
        message: 'Coins marked as received',
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

      app.logger.info({ reportId: newReport.id, tradeId, reporterId: session.user.id }, 'Trade reported');

      return {
        reportId: newReport.id,
        status: 'success',
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
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { tradeId } = request.params as { tradeId: string };

    app.logger.info({ tradeId, userId: session.user.id }, 'Cancelling trade');

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
        (trade.status === 'pending' || trade.status === 'countered') && trade.initiatorId === session.user.id ||
        trade.status === 'accepted' && (trade.initiatorId === session.user.id || trade.coinOwnerId === session.user.id);

      if (!canCancel) {
        app.logger.warn({ tradeId, userId: session.user.id, status: trade.status }, 'Cannot cancel this trade');
        return reply.status(400).send({ error: 'Cannot cancel this trade in its current status' });
      }

      // Update trade status to cancelled
      await app.db
        .update(schema.trades)
        .set({ status: 'cancelled', updatedAt: new Date() })
        .where(eq(schema.trades.id, tradeId));

      app.logger.info({ tradeId, userId: session.user.id }, 'Trade cancelled');

      return {
        status: 'success',
        message: 'Trade cancelled',
      };
    } catch (error) {
      app.logger.error({ err: error, tradeId, userId: session.user.id }, 'Failed to cancel trade');
      throw error;
    }
  });
}
