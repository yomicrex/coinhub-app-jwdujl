import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, sql, or } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import * as authSchema from '../db/auth-schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const ActivateSubscriptionSchema = z.object({
  receipt: z.string().min(1),
  platform: z.enum(['ios', 'android']),
  productId: z.string().min(1),
});

const RestoreSubscriptionSchema = z.object({
  receipt: z.string().min(1),
  platform: z.enum(['ios', 'android']),
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

  // Convert dates to ISO strings for database query
  const currentMonthStartStr = currentMonthStart.toISOString();
  const nextMonthStartStr = nextMonthStart.toISOString();

  const result = await app.db
    .select({ count: sql<number>`COUNT(*)` })
    .from(schema.coins)
    .where(
      and(
        eq(schema.coins.userId, userId),
        eq(schema.coins.isTemporaryTradeCoin, false),
        sql`${schema.coins.createdAt} >= ${currentMonthStartStr}`,
        sql`${schema.coins.createdAt} < ${nextMonthStartStr}`
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

// Helper function to validate Apple App Store receipt
async function validateAppleReceipt(
  receipt: string,
  productId: string,
  isDevelopment: boolean = true
): Promise<{ transactionId: string; expiresDate: Date; originalTransactionId?: string } | null> {
  try {
    // For demo-receipt, skip validation
    if (receipt === 'demo-receipt') {
      return {
        transactionId: `demo-${Date.now()}`,
        expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Apple receipt validation endpoint
    const validationUrl = isDevelopment
      ? 'https://sandbox.itunes.apple.com/verifyReceipt'
      : 'https://buy.itunes.apple.com/verifyReceipt';

    const response = await fetch(validationUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        'receipt-data': receipt,
        password: process.env.APPLE_APP_STORE_SHARED_SECRET || '',
      }),
    });

    const data = (await response.json()) as any;

    // Status 0 = valid, 21007 = sandbox receipt used in production (retry with sandbox)
    if (data.status === 0 || data.status === 21007) {
      const latestReceipt = data.latest_receipt_info?.[0];
      if (latestReceipt && latestReceipt.product_id === productId) {
        return {
          transactionId: latestReceipt.transaction_id,
          expiresDate: new Date(parseInt(latestReceipt.expires_date_ms)),
          originalTransactionId: latestReceipt.original_transaction_id,
        };
      }
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to validate Google Play receipt
async function validateGoogleReceipt(
  receipt: string,
  productId: string
): Promise<{ transactionId: string; expiresDate: Date; originalTransactionId?: string } | null> {
  try {
    // For demo-receipt, skip validation
    if (receipt === 'demo-receipt') {
      return {
        transactionId: `demo-${Date.now()}`,
        expiresDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      };
    }

    // Parse receipt JSON
    const receiptData = JSON.parse(receipt);

    // Validate with Google Play Billing API
    // This requires OAuth token from Google Cloud
    const accessToken = process.env.GOOGLE_PLAY_BILLING_TOKEN || '';

    const response = await fetch(
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/com.coinhub/purchases/subscriptions/${productId}/tokens/${receiptData.purchaseToken}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;

    // Validate purchase state (0 = purchased)
    if (data.paymentState === 0) {
      return {
        transactionId: receiptData.purchaseToken,
        expiresDate: new Date(parseInt(data.expiryTimeMillis)),
        originalTransactionId: data.orderId,
      };
    }

    return null;
  } catch (error) {
    return null;
  }
}

// Helper function to archive coins when user downgrades from premium
async function archiveCoinsOverLimit(app: App, userId: string, maxCoins: number = 25) {
  try {
    // Get all non-archived coins for user, ordered by createdAt DESC
    const userCoins = await app.db.query.coins.findMany({
      where: and(
        eq(schema.coins.userId, userId),
        eq(schema.coins.isArchived, false)
      ),
      orderBy: (coins, { desc }) => [desc(coins.createdAt)],
    });

    // Archive coins beyond the limit (keeping the most recent)
    const coinsToArchive = userCoins.slice(maxCoins);

    if (coinsToArchive.length > 0) {
      await app.db
        .update(schema.coins)
        .set({
          isArchived: true,
          updatedAt: new Date(),
        })
        .where(
          sql`${schema.coins.id} IN (${sql.join(
            coinsToArchive.map((c) => c.id),
            sql`, `
          )})`
        );

      return coinsToArchive.length;
    }

    return 0;
  } catch (error) {
    return 0;
  }
}

// Helper function to restore archived coins when user upgrades to premium
async function restoreArchivedCoins(app: App, userId: string) {
  try {
    const restored = await app.db
      .update(schema.coins)
      .set({
        isArchived: false,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.coins.userId, userId),
          eq(schema.coins.isArchived, true)
        )
      )
      .returning({ id: schema.coins.id });

    return restored.length;
  } catch (error) {
    return 0;
  }
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
   * Activate premium subscription with receipt validation
   */
  app.fastify.post('/api/subscription/activate', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info(
      { userId: session.user.id, body: request.body },
      'Attempting to activate premium subscription'
    );

    try {
      const body = ActivateSubscriptionSchema.parse(request.body);

      // Validate receipt based on platform
      let validationResult: { transactionId: string; expiresDate: Date; originalTransactionId?: string } | null =
        null;

      if (body.platform === 'ios') {
        app.logger.debug({ userId: session.user.id }, 'Validating iOS receipt');
        validationResult = await validateAppleReceipt(body.receipt, body.productId);
      } else if (body.platform === 'android') {
        app.logger.debug({ userId: session.user.id }, 'Validating Android receipt');
        validationResult = await validateGoogleReceipt(body.receipt, body.productId);
      }

      if (!validationResult) {
        app.logger.warn(
          { userId: session.user.id, platform: body.platform },
          'Receipt validation failed'
        );
        return reply.status(400).send({
          error: 'Invalid receipt or validation failed',
        });
      }

      // Check for duplicate transaction
      const existingReceipt = await app.db.query.subscriptionReceipts.findFirst({
        where: eq(schema.subscriptionReceipts.transactionId, validationResult.transactionId),
      });

      if (existingReceipt && existingReceipt.userId !== session.user.id) {
        app.logger.warn(
          { userId: session.user.id, transactionId: validationResult.transactionId },
          'Transaction already used by another user'
        );
        return reply.status(400).send({
          error: 'This purchase has already been used',
        });
      }

      // Store receipt
      const now = new Date();
      await app.db
        .insert(schema.subscriptionReceipts)
        .values({
          userId: session.user.id,
          platform: body.platform,
          productId: body.productId,
          transactionId: validationResult.transactionId,
          originalTransactionId: validationResult.originalTransactionId,
          purchaseDate: now,
          expiresDate: validationResult.expiresDate,
          receipt: body.receipt, // In production, encrypt this
          isActive: true,
        })
        .onConflictDoUpdate({
          target: schema.subscriptionReceipts.transactionId,
          set: {
            isActive: true,
            expiresDate: validationResult.expiresDate,
            updatedAt: new Date(),
          },
        });

      // Update user subscription
      const updated = await app.db
        .update(schema.users)
        .set({
          subscriptionTier: 'premium',
          subscriptionStartedAt: now,
          subscriptionExpiresAt: validationResult.expiresDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, session.user.id))
        .returning({
          tier: schema.users.subscriptionTier,
          expiresAt: schema.users.subscriptionExpiresAt,
        });

      // Restore archived coins when upgrading to premium
      const restored = await restoreArchivedCoins(app, session.user.id);

      app.logger.info(
        {
          userId: session.user.id,
          platform: body.platform,
          expiresAt: validationResult.expiresDate,
          coinsRestored: restored,
        },
        'Premium subscription activated successfully with receipt validation'
      );

      return {
        success: true,
        tier: 'premium',
        expiresAt: validationResult.expiresDate.toISOString(),
        coinsRestored: restored,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn(
          { error: error.issues, userId: session.user.id },
          'Validation failed for subscription activation'
        );
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

      // Archive coins beyond free tier limit (25 coins max)
      const archived = await archiveCoinsOverLimit(app, session.user.id, 25);

      app.logger.info(
        { userId: session.user.id, coinsArchived: archived },
        'Premium subscription cancelled successfully'
      );

      return {
        success: true,
        tier: 'free',
        coinsArchived: archived,
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

  /**
   * POST /api/subscription/restore
   * Restore subscription from previously purchased receipt
   */
  app.fastify.post('/api/subscription/restore', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Attempting to restore subscription');

    try {
      const body = RestoreSubscriptionSchema.parse(request.body);

      // Find valid active receipts for this user
      const activeReceipts = await app.db.query.subscriptionReceipts.findMany({
        where: and(
          eq(schema.subscriptionReceipts.userId, session.user.id),
          eq(schema.subscriptionReceipts.isActive, true),
          sql`${schema.subscriptionReceipts.expiresDate} > NOW()`
        ),
      });

      if (activeReceipts.length === 0) {
        app.logger.warn({ userId: session.user.id }, 'No active valid receipts found to restore');
        return reply.status(400).send({
          error: 'No active subscription found to restore',
        });
      }

      // Use the latest expiring receipt
      const latestReceipt = activeReceipts.sort(
        (a, b) => b.expiresDate.getTime() - a.expiresDate.getTime()
      )[0];

      // Update user subscription
      await app.db
        .update(schema.users)
        .set({
          subscriptionTier: 'premium',
          subscriptionStartedAt: new Date(),
          subscriptionExpiresAt: latestReceipt.expiresDate,
          updatedAt: new Date(),
        })
        .where(eq(schema.users.id, session.user.id));

      // Restore archived coins
      const restored = await restoreArchivedCoins(app, session.user.id);

      app.logger.info(
        {
          userId: session.user.id,
          expiresAt: latestReceipt.expiresDate,
          coinsRestored: restored,
        },
        'Subscription restored successfully'
      );

      return {
        success: true,
        tier: 'premium',
        expiresAt: latestReceipt.expiresDate.toISOString(),
        coinsRestored: restored,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues, userId: session.user.id }, 'Validation failed for restore');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.issues,
        });
      }

      app.logger.error({ err: error, userId: session.user.id }, 'Failed to restore subscription');
      return reply.status(500).send({ error: 'Failed to restore subscription' });
    }
  });

  /**
   * GET /api/subscription/verify
   * Verify if current subscription is valid
   */
  app.fastify.get('/api/subscription/verify', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    app.logger.info({ userId: session.user.id }, 'Verifying subscription status');

    try {
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

      // Check if subscription is still valid
      let isValid = false;
      if (
        user.subscriptionTier === 'premium' &&
        user.subscriptionExpiresAt &&
        new Date(user.subscriptionExpiresAt) > new Date()
      ) {
        isValid = true;
      }

      // Also check for active receipts
      const activeReceipts = await app.db
        .select({ count: sql<number>`COUNT(*)` })
        .from(schema.subscriptionReceipts)
        .where(
          and(
            eq(schema.subscriptionReceipts.userId, session.user.id),
            eq(schema.subscriptionReceipts.isActive, true),
            sql`${schema.subscriptionReceipts.expiresDate} > NOW()`
          )
        );

      const hasValidReceipt = (activeReceipts[0]?.count || 0) > 0;

      app.logger.info(
        {
          userId: session.user.id,
          isValid,
          tier: user.subscriptionTier,
          hasValidReceipt,
        },
        'Subscription verification completed'
      );

      return {
        isValid,
        tier: user.subscriptionTier,
        expiresAt: user.subscriptionExpiresAt?.toISOString() || null,
        hasValidReceipt,
      };
    } catch (error) {
      app.logger.error({ err: error, userId: session.user.id }, 'Failed to verify subscription');
      return reply.status(500).send({ error: 'Failed to verify subscription' });
    }
  });
}
