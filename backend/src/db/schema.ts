import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

/**
 * Invite Codes Table
 * Manages invite codes for user registration
 */
export const inviteCodes = pgTable(
  'invite_codes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    code: text('code').notNull().unique(),
    usageLimit: integer('usage_limit'), // null = unlimited
    usageCount: integer('usage_count').default(0).notNull(),
    expiresAt: timestamp('expires_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    isActive: boolean('is_active').default(true).notNull(),
  },
  (table) => [
    index('idx_invite_code').on(table.code),
    index('idx_invite_active').on(table.isActive),
  ]
);

/**
 * Users Table
 * Stores user profiles and metadata
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(), // text to match Better Auth
    email: text('email').notNull().unique(),
    username: text('username').notNull().unique(),
    displayName: text('display_name').notNull(),
    avatarUrl: text('avatar_url'),
    bio: text('bio'),
    location: text('location'),
    collectionPrivacy: text('collection_privacy', {
      enum: ['public', 'private'],
    })
      .default('public')
      .notNull(),
    role: text('role', { enum: ['user', 'moderator', 'admin'] })
      .default('user')
      .notNull(),
    inviteCodeUsed: text('invite_code_used'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_user_email').on(table.email),
    index('idx_user_username').on(table.username),
    index('idx_user_role').on(table.role),
  ]
);

/**
 * Coins Table
 * Stores coin collection items
 */
export const coins = pgTable(
  'coins',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    title: text('title').notNull(),
    country: text('country').notNull(),
    year: integer('year').notNull(),
    unit: text('unit'),
    organization: text('organization'),
    agency: text('agency'),
    deployment: text('deployment'),
    coinNumber: text('coin_number'),
    mintMark: text('mint_mark'),
    condition: text('condition'), // mint, excellent, good, fair, poor
    description: text('description'),
    visibility: text('visibility', {
      enum: ['public', 'private'],
    })
      .default('public')
      .notNull(),
    tradeStatus: text('trade_status', {
      enum: ['not_for_trade', 'open_to_trade'],
    })
      .default('not_for_trade')
      .notNull(),
    likeCount: integer('like_count').default(0).notNull(),
    commentCount: integer('comment_count').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_coin_user').on(table.userId),
    index('idx_coin_visibility').on(table.visibility),
    index('idx_coin_country').on(table.country),
    index('idx_coin_year').on(table.year),
    index('idx_coin_trade_status').on(table.tradeStatus),
  ]
);

/**
 * Coin Images Table
 * Stores images for each coin
 */
export const coinImages = pgTable(
  'coin_images',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    coinId: uuid('coin_id').notNull().references(() => coins.id, {
      onDelete: 'cascade',
    }),
    url: text('url').notNull(),
    orderIndex: integer('order_index').default(0).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [index('idx_coin_images_coin').on(table.coinId)]
);

/**
 * Likes Table
 * Tracks which users liked which coins
 */
export const likes = pgTable(
  'likes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    coinId: uuid('coin_id').notNull().references(() => coins.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_user_coin_like').on(table.userId, table.coinId),
    index('idx_likes_user').on(table.userId),
    index('idx_likes_coin').on(table.coinId),
  ]
);

/**
 * Comments Table
 * Tracks comments on coins with soft delete support
 */
export const comments = pgTable(
  'comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: text('user_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    coinId: uuid('coin_id').notNull().references(() => coins.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    isDeleted: boolean('is_deleted').default(false).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_comments_coin').on(table.coinId),
    index('idx_comments_user').on(table.userId),
    index('idx_comments_deleted').on(table.isDeleted),
  ]
);

/**
 * Follows Table
 * Tracks user-to-user follow relationships
 */
export const follows = pgTable(
  'follows',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    followerId: text('follower_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    followingId: text('following_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex('idx_follower_following').on(table.followerId, table.followingId),
    index('idx_follows_follower').on(table.followerId),
    index('idx_follows_following').on(table.followingId),
  ]
);

/**
 * Trades Table
 * Represents trade requests between users
 */
export const trades = pgTable(
  'trades',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    initiatorId: text('initiator_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    coinOwnerId: text('coin_owner_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    coinId: uuid('coin_id').notNull().references(() => coins.id, {
      onDelete: 'cascade',
    }),
    status: text('status', {
      enum: ['pending', 'accepted', 'rejected', 'countered', 'completed', 'cancelled', 'disputed'],
    }).default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_initiator').on(table.initiatorId),
    index('idx_trade_coin_owner').on(table.coinOwnerId),
    index('idx_trade_coin').on(table.coinId),
    index('idx_trade_status').on(table.status),
  ]
);

/**
 * Trade Offers Table
 * Represents individual coin offers within a trade
 */
export const tradeOffers = pgTable(
  'trade_offers',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeId: uuid('trade_id').notNull().references(() => trades.id, {
      onDelete: 'cascade',
    }),
    offererId: text('offerer_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    offeredCoinId: uuid('offered_coin_id').references(() => coins.id, {
      onDelete: 'set null',
    }),
    isCounterOffer: boolean('is_counter_offer').default(false).notNull(),
    message: text('message'),
    status: text('status', {
      enum: ['pending', 'accepted', 'rejected', 'countered'],
    }).default('pending').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_offer_trade').on(table.tradeId),
    index('idx_trade_offer_offerer').on(table.offererId),
    index('idx_trade_offer_coin').on(table.offeredCoinId),
    index('idx_trade_offer_status').on(table.status),
  ]
);

/**
 * Trade Messages Table
 * Private messages within trade conversations
 */
export const tradeMessages = pgTable(
  'trade_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeId: uuid('trade_id').notNull().references(() => trades.id, {
      onDelete: 'cascade',
    }),
    senderId: text('sender_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    content: text('content').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_message_trade').on(table.tradeId),
    index('idx_trade_message_sender').on(table.senderId),
    index('idx_trade_message_created').on(table.createdAt),
  ]
);

/**
 * Trade Shipping Table
 * Tracks shipping and delivery status for both parties
 */
export const tradeShipping = pgTable(
  'trade_shipping',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeId: uuid('trade_id').notNull().unique().references(() => trades.id, {
      onDelete: 'cascade',
    }),
    initiatorShipped: boolean('initiator_shipped').default(false).notNull(),
    initiatorTrackingNumber: text('initiator_tracking_number'),
    initiatorShippedAt: timestamp('initiator_shipped_at'),
    initiatorReceived: boolean('initiator_received').default(false).notNull(),
    initiatorReceivedAt: timestamp('initiator_received_at'),
    ownerShipped: boolean('owner_shipped').default(false).notNull(),
    ownerTrackingNumber: text('owner_tracking_number'),
    ownerShippedAt: timestamp('owner_shipped_at'),
    ownerReceived: boolean('owner_received').default(false).notNull(),
    ownerReceivedAt: timestamp('owner_received_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_shipping_trade').on(table.tradeId),
  ]
);

/**
 * Trade Reports Table
 * Track trade violations and disputes
 */
export const tradeReports = pgTable(
  'trade_reports',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tradeId: uuid('trade_id').notNull().references(() => trades.id, {
      onDelete: 'cascade',
    }),
    reporterId: text('reporter_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    reportedUserId: text('reported_user_id').notNull().references(() => users.id, {
      onDelete: 'cascade',
    }),
    reason: text('reason').notNull(),
    description: text('description'),
    status: text('status', {
      enum: ['pending', 'in_review', 'resolved', 'dismissed'],
    }).default('pending').notNull(),
    reviewedBy: text('reviewed_by').references(() => users.id, {
      onDelete: 'set null',
    }),
    reviewNotes: text('review_notes'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('idx_trade_report_trade').on(table.tradeId),
    index('idx_trade_report_reporter').on(table.reporterId),
    index('idx_trade_report_reported').on(table.reportedUserId),
    index('idx_trade_report_status').on(table.status),
  ]
);

// ===== RELATIONS =====

export const usersRelations = relations(users, ({ many }) => ({
  coins: many(coins),
  likes: many(likes),
  comments: many(comments),
  followers: many(follows, { relationName: 'followers' }),
  following: many(follows, { relationName: 'following' }),
  initiatedTrades: many(trades, { relationName: 'initiator' }),
  ownedCoinTrades: many(trades, { relationName: 'coinOwner' }),
  tradeOffers: many(tradeOffers),
  tradeMessages: many(tradeMessages),
  reportedTrades: many(tradeReports, { relationName: 'reporter' }),
  reviewedReports: many(tradeReports, { relationName: 'reviewer' }),
  reportedByUsers: many(tradeReports, { relationName: 'reportedUser' }),
}));

export const coinsRelations = relations(coins, ({ one, many }) => ({
  user: one(users, {
    fields: [coins.userId],
    references: [users.id],
  }),
  images: many(coinImages),
  likes: many(likes),
  comments: many(comments),
}));

export const coinImagesRelations = relations(coinImages, ({ one }) => ({
  coin: one(coins, {
    fields: [coinImages.coinId],
    references: [coins.id],
  }),
}));

export const likesRelations = relations(likes, ({ one }) => ({
  user: one(users, {
    fields: [likes.userId],
    references: [users.id],
  }),
  coin: one(coins, {
    fields: [likes.coinId],
    references: [coins.id],
  }),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  user: one(users, {
    fields: [comments.userId],
    references: [users.id],
  }),
  coin: one(coins, {
    fields: [comments.coinId],
    references: [coins.id],
  }),
}));

export const followsRelations = relations(follows, ({ one }) => ({
  follower: one(users, {
    fields: [follows.followerId],
    references: [users.id],
    relationName: 'followers',
  }),
  following: one(users, {
    fields: [follows.followingId],
    references: [users.id],
    relationName: 'following',
  }),
}));

export const tradesRelations = relations(trades, ({ one, many }) => ({
  initiator: one(users, {
    fields: [trades.initiatorId],
    references: [users.id],
    relationName: 'initiator',
  }),
  coinOwner: one(users, {
    fields: [trades.coinOwnerId],
    references: [users.id],
    relationName: 'coinOwner',
  }),
  coin: one(coins, {
    fields: [trades.coinId],
    references: [coins.id],
  }),
  offers: many(tradeOffers),
  messages: many(tradeMessages),
  shipping: one(tradeShipping),
  reports: many(tradeReports),
}));

export const tradeOffersRelations = relations(tradeOffers, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeOffers.tradeId],
    references: [trades.id],
  }),
  offerer: one(users, {
    fields: [tradeOffers.offererId],
    references: [users.id],
  }),
  offeredCoin: one(coins, {
    fields: [tradeOffers.offeredCoinId],
    references: [coins.id],
  }),
}));

export const tradeMessagesRelations = relations(tradeMessages, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeMessages.tradeId],
    references: [trades.id],
  }),
  sender: one(users, {
    fields: [tradeMessages.senderId],
    references: [users.id],
  }),
}));

export const tradeShippingRelations = relations(tradeShipping, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeShipping.tradeId],
    references: [trades.id],
  }),
}));

export const tradeReportsRelations = relations(tradeReports, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeReports.tradeId],
    references: [trades.id],
  }),
  reporter: one(users, {
    fields: [tradeReports.reporterId],
    references: [users.id],
    relationName: 'reporter',
  }),
  reportedUser: one(users, {
    fields: [tradeReports.reportedUserId],
    references: [users.id],
    relationName: 'reportedUser',
  }),
  reviewer: one(users, {
    fields: [tradeReports.reviewedBy],
    references: [users.id],
    relationName: 'reviewer',
  }),
}));
