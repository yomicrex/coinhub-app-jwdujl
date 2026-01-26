import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const ActivateSubscriptionSchema = z.object({
  receipt: z.string().min(1).max(500).optional(),
});

// Helper function to get current month in YYYY-MM format
function getCurrentMonth(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper function to get month and year from date
function getMonthYear(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Helper function to count actual coins uploaded by user in current month
async function getActualCoinCountThisMonth(app: App, userId: string): Promise<number> {
  const now = new Date();
  const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);

  const result = await app.db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.coins)
    .where(
      and(
        eq(schema.coins.userId, userId),
        eq(schema.coins.isTemporaryTradeCoin, false),
        sql`${schema.coins.createdAt} >= ${currentMonthStart}`,
        sql`${schema.coins.createdAt} < ${nextMonthStart}`
      )
    );

  return result[0]?.count || 0;
}

// Helper function to get or create monthly stats for current month
async function getOrCreateMonthlyStats(app: App, userId: string) {
  const currentMonth = getCurrentMonth();

  // Try to find existing record
  let stats = await app.db.query.userMonthlyStats.findFirst({
    where: and(
      eq(schema.userMonthlyStats.userId, userId),
      eq(schema.userMonthlyStats.month, currentMonth)
    ),
  });

  // Create if doesn't exist
  if (!stats) {
    const created = await app.db
      .insert(schema.userMonthlyStats)
      .values({
        userId,
        month: currentMonth,
        coinsUploadedCount: 0,
        tradesInitiatedCount: 0,
      })
      .returning();

    stats = created[0];
  }

  return stats;
}

export function registerSubscriptionRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/subscription/status
   * Get current user's subscription status and usage
   */
  app.fastify.get('/api/subscription/status', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Fetching subscription status');

    try {
      // Get user subscription info
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: {
          subscriptionTier: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!user) {
        app.logger.warn({ userId: session.user.id }, 'User not found for subscription status');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Get or create monthly stats
      const stats = await getOrCreateMonthlyStats(app, session.user.id);

      // Determine actual tier (check if premium subscription has expired)
      let activeTier = user.subscriptionTier;
      if (activeTier === 'premium' && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
        activeTier = 'free';
      }

      // Get actual coin count from database and sync with stats
      const actualCoinCount = await getActualCoinCountThisMonth(app, session.user.id);
      let syncedCoinsUploadedCount = actualCoinCount;

      // If actual count differs from cached count, update the stats
      if (actualCoinCount !== stats.coinsUploadedCount) {
        app.logger.info(
          {
            userId: session.user.id,
            cachedCount: stats.coinsUploadedCount,
            actualCount: actualCoinCount,
          },
          'Syncing coin count from database to stats'
        );

        try {
          await app.db
            .update(schema.userMonthlyStats)
            .set({
              coinsUploadedCount: actualCoinCount,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.userMonthlyStats.userId, session.user.id),
                eq(schema.userMonthlyStats.month, getCurrentMonth())
              )
            );

          app.logger.debug(
            { userId: session.user.id, newCount: actualCoinCount },
            'Coin count synced successfully'
          );
        } catch (syncError) {
          app.logger.warn({ err: syncError, userId: session.user.id }, 'Failed to sync coin count to stats, using actual count from database');
        }
      }

      // Set limits based on tier
      const limits = {
        maxCoins: activeTier === 'free' ? 25 : null,
        maxTrades: activeTier === 'free' ? 1 : null,
      };

      app.logger.info(
        {
          userId: session.user.id,
          tier: activeTier,
          coinsUploaded: syncedCoinsUploadedCount,
          tradesInitiated: stats.tradesInitiatedCount,
        },
        'Subscription status fetched'
      );

      return {
        tier: activeTier,
        coinsUploadedThisMonth: syncedCoinsUploadedCount,
        tradesInitiatedThisMonth: stats.tradesInitiatedCount,
        subscriptionExpiresAt: user.subscriptionExpiresAt?.toISOString() || null,
        limits,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to fetch subscription status');
      return reply.status(500).send({ error: 'Failed to fetch subscription status' });
    }
  });

  /**
   * POST /api/subscription/activate
   * Activate premium subscription for current user
   */
  app.fastify.post('/api/subscription/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Activating premium subscription');

    try {
      const body = ActivateSubscriptionSchema.parse(request.body);

      // TODO: In production, validate receipt with payment provider (Apple, Google, Stripe, etc.)
      // For now, we accept all receipts
      if (body.receipt) {
        app.logger.debug({ userId: session.user.id, receiptLength: body.receipt.length }, 'Receipt provided for validation');
      }

      // Calculate expiration date (30 days from now)
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // Update user subscription
      const updated = await app.db
        .update(schema.users)
        .set({
          subscriptionTier: 'premium',
          subscriptionStartedAt: now,
          subscriptionExpiresAt: expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, session.user.id))
        .returning({
          tier: schema.users.subscriptionTier,
          expiresAt: schema.users.subscriptionExpiresAt,
        });

      app.logger.info(
        { userId: session.user.id, expiresAt },
        'Premium subscription activated successfully'
      );

      return {
        success: true,
        tier: 'premium',
        expiresAt: expiresAt.toISOString(),
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId: session.user.id }, 'Validation failed for subscription activation');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
        });
      }

      app.logger.error({ err: error, userId: session.user.id }, 'Failed to activate premium subscription');
      return reply.status(500).send({ error: 'Failed to activate subscription' });
    }
  });

  /**
   * POST /api/subscription/cancel
   * Cancel premium subscription and revert to free tier
   */
  app.fastify.post('/api/subscription/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Cancelling premium subscription');

    try {
      // Update user subscription to free tier
      // Keep subscriptionExpiresAt for grace period reference
      await app.db
        .update(schema.users)
        .set({
          subscriptionTier: 'free',
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, session.user.id));

      app.logger.info({ userId: session.user.id }, 'Premium subscription cancelled successfully');

      return {
        success: true,
        tier: 'free',
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to cancel premium subscription');
      return reply.status(500).send({ error: 'Failed to cancel subscription' });
    }
  });

  /**
   * GET /api/subscription/can-upload-coin
   * Check if user can upload a coin based on tier and monthly limits
   */
  app.fastify.get('/api/subscription/can-upload-coin', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Checking coin upload limit');

    try {
      // Get user subscription tier
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: {
          subscriptionTier: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!user) {
        app.logger.warn({ userId: session.user.id }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Determine actual tier
      let activeTier = user.subscriptionTier;
      if (activeTier === 'premium' && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
        activeTier = 'free';
      }

      // Premium users can always upload
      if (activeTier === 'premium') {
        app.logger.info({ userId: session.user.id }, 'Premium user can upload coins');
        return {
          canUpload: true,
          coinsUploadedThisMonth: 0,
          limit: null,
        };
      }

      // Check free tier limits with actual coin count from database
      const stats = await getOrCreateMonthlyStats(app, session.user.id);
      const actualCoinCount = await getActualCoinCountThisMonth(app, session.user.id);
      const limit = 25;
      const canUpload = actualCoinCount < limit;

      // If actual count differs from cached count, update the stats
      if (actualCoinCount !== stats.coinsUploadedCount) {
        app.logger.info(
          {
            userId: session.user.id,
            cachedCount: stats.coinsUploadedCount,
            actualCount: actualCoinCount,
          },
          'Syncing coin count from database to stats'
        );

        try {
          await app.db
            .update(schema.userMonthlyStats)
            .set({
              coinsUploadedCount: actualCoinCount,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(schema.userMonthlyStats.userId, session.user.id),
                eq(schema.userMonthlyStats.month, getCurrentMonth())
              )
            );
        } catch (syncError) {
          app.logger.warn({ err: syncError, userId: session.user.id }, 'Failed to sync coin count to stats, using actual count from database');
        }
      }

      if (!canUpload) {
        app.logger.warn(
          { userId: session.user.id, uploaded: actualCoinCount, limit },
          'User exceeded monthly coin upload limit'
        );
      } else {
        app.logger.info(
          { userId: session.user.id, uploaded: actualCoinCount, limit },
          'User can upload coin'
        );
      }

      return {
        canUpload,
        coinsUploadedThisMonth: actualCoinCount,
        limit,
        ...(canUpload ? {} : { reason: `You have reached the monthly limit of ${limit} coins for free users` }),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to check coin upload limit');
      return reply.status(500).send({ error: 'Failed to check upload limit' });
    }
  });

  /**
   * GET /api/subscription/can-initiate-trade
   * Check if user can initiate a trade based on tier and monthly limits
   */
  app.fastify.get('/api/subscription/can-initiate-trade', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Checking trade initiation limit');

    try {
      // Get user subscription tier
      const user = await app.db.query.users.findFirst({
        where: eq(schema.users.id, session.user.id),
        columns: {
          subscriptionTier: true,
          subscriptionExpiresAt: true,
        },
      });

      if (!user) {
        app.logger.warn({ userId: session.user.id }, 'User not found');
        return reply.status(404).send({ error: 'User not found' });
      }

      // Determine actual tier
      let activeTier = user.subscriptionTier;
      if (activeTier === 'premium' && user.subscriptionExpiresAt && new Date(user.subscriptionExpiresAt) < new Date()) {
        activeTier = 'free';
      }

      // Premium users can always initiate trades
      if (activeTier === 'premium') {
        app.logger.info({ userId: session.user.id }, 'Premium user can initiate trades');
        return {
          canInitiate: true,
          tradesInitiatedThisMonth: 0,
          limit: null,
        };
      }

      // Check free tier limits
      const stats = await getOrCreateMonthlyStats(app, session.user.id);
      const limit = 1;
      const canInitiate = stats.tradesInitiatedCount < limit;

      if (!canInitiate) {
        app.logger.warn(
          { userId: session.user.id, initiated: stats.tradesInitiatedCount, limit },
          'User exceeded monthly trade initiation limit'
        );
      } else {
        app.logger.info(
          { userId: session.user.id, initiated: stats.tradesInitiatedCount, limit },
          'User can initiate trade'
        );
      }

      return {
        canInitiate,
        tradesInitiatedThisMonth: stats.tradesInitiatedCount,
        limit,
        ...(canInitiate ? {} : { reason: `You have reached the monthly limit of ${limit} trades for free users` }),
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to check trade initiation limit');
      return reply.status(500).send({ error: 'Failed to check initiation limit' });
    }
  });

  /**
   * POST /api/subscription/track-coin-upload
   * Increment monthly coin upload count
   */
  app.fastify.post('/api/subscription/track-coin-upload', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Tracking coin upload');

    try {
      const stats = await getOrCreateMonthlyStats(app, session.user.id);

      // Increment counter
      const updated = await app.db
        .update(schema.userMonthlyStats)
        .set({
          coinsUploadedCount: stats.coinsUploadedCount + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.userMonthlyStats.userId, session.user.id),
            eq(schema.userMonthlyStats.month, getCurrentMonth())
          )
        )
        .returning({ count: schema.userMonthlyStats.coinsUploadedCount });

      app.logger.info(
        { userId: session.user.id, newCount: updated[0].count },
        'Coin upload tracked successfully'
      );

      return {
        success: true,
        coinsUploadedThisMonth: updated[0].count,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to track coin upload');
      return reply.status(500).send({ error: 'Failed to track coin upload' });
    }
  });

  /**
   * POST /api/subscription/track-trade-initiation
   * Increment monthly trade initiation count
   */
  app.fastify.post('/api/subscription/track-trade-initiation', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Tracking trade initiation');

    try {
      const stats = await getOrCreateMonthlyStats(app, session.user.id);

      // Increment counter
      const updated = await app.db
        .update(schema.userMonthlyStats)
        .set({
          tradesInitiatedCount: stats.tradesInitiatedCount + 1,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(schema.userMonthlyStats.userId, session.user.id),
            eq(schema.userMonthlyStats.month, getCurrentMonth())
          )
        )
        .returning({ count: schema.userMonthlyStats.tradesInitiatedCount });

      app.logger.info(
        { userId: session.user.id, newCount: updated[0].count },
        'Trade initiation tracked successfully'
      );

      return {
        success: true,
        tradesInitiatedThisMonth: updated[0].count,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to track trade initiation');
      return reply.status(500).send({ error: 'Failed to track trade initiation' });
    }
  });
}
