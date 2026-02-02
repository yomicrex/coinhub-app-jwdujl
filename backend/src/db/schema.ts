import {
  pgTable,
  text,
  timestamp,
  uuid,
  integer,
  boolean,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - CoinHub user profiles
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull(),
  username: text('username').notNull().unique(),
  displayName: text('display_name').notNull(),
  avatarUrl: text('avatar_url'),
  bio: text('bio'),
  location: text('location'),
  collectionPrivacy: text('collection_privacy').notNull().default('public'),
  role: text('role').notNull().default('user'),
  subscriptionTier: text('subscription_tier').notNull().default('free'),
  subscriptionStartedAt: timestamp('subscription_started_at'),
  subscriptionExpiresAt: timestamp('subscription_expires_at'),
  inviteCodeUsed: text('invite_code_used'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  emailIdx: index('idx_user_email').on(table.email),
  usernameIdx: index('idx_user_username').on(table.username),
  roleIdx: index('idx_user_role').on(table.role),
  subscriptionTierIdx: index('idx_user_subscription_tier').on(table.subscriptionTier),
}));

// Coins table
export const coins = pgTable('coins', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  country: text('country').notNull(),
  year: integer('year').notNull(),
  unit: text('unit'),
  organization: text('organization'),
  agency: text('agency'),
  deployment: text('deployment'),
  coinNumber: text('coin_number'),
  mintMark: text('mint_mark'),
  condition: text('condition'),
  description: text('description'),
  version: text('version'),
  manufacturer: text('manufacturer'),
  visibility: text('visibility').notNull().default('public'),
  tradeStatus: text('trade_status').notNull().default('not_for_trade'),
  isTemporaryTradeCoin: boolean('is_temporary_trade_coin').notNull().default(false),
  isArchived: boolean('is_archived').notNull().default(false),
  likeCount: integer('like_count').notNull().default(0),
  commentCount: integer('comment_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userIdx: index('idx_coin_user').on(table.userId),
  visibilityIdx: index('idx_coin_visibility').on(table.visibility),
  countryIdx: index('idx_coin_country').on(table.country),
  yearIdx: index('idx_coin_year').on(table.year),
  tradeStatusIdx: index('idx_coin_trade_status').on(table.tradeStatus),
}));

// Coin images table
export const coinImages = pgTable('coin_images', {
  id: uuid('id').primaryKey().defaultRandom(),
  coinId: uuid('coin_id').notNull().references(() => coins.id, { onDelete: 'cascade' }),
  url: text('url').notNull(),
  orderIndex: integer('order_index').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  coinIdx: index('idx_coin_images_coin').on(table.coinId),
}));

// Invite codes table
export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  usageLimit: integer('usage_limit'),
  usageCount: integer('usage_count').notNull().default(0),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  isActive: boolean('is_active').notNull().default(true),
}, (table) => ({
  codeIdx: index('idx_invite_code').on(table.code),
  activeIdx: index('idx_invite_active').on(table.isActive),
}));

// Likes table
export const likes = pgTable('likes', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  coinId: uuid('coin_id').notNull().references(() => coins.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userCoinIdx: uniqueIndex('idx_user_coin_like').on(table.userId, table.coinId),
  userIdx: index('idx_likes_user').on(table.userId),
  coinIdx: index('idx_likes_coin').on(table.coinId),
}));

// Comments table
export const comments = pgTable('comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  coinId: uuid('coin_id').notNull().references(() => coins.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  isDeleted: boolean('is_deleted').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  coinIdx: index('idx_comments_coin').on(table.coinId),
  userIdx: index('idx_comments_user').on(table.userId),
  deletedIdx: index('idx_comments_deleted').on(table.isDeleted),
}));

// Follows table
export const follows = pgTable('follows', {
  id: uuid('id').primaryKey().defaultRandom(),
  followerId: text('follower_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  followingId: text('following_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  followerFollowingIdx: uniqueIndex('idx_follower_following').on(table.followerId, table.followingId),
  followerIdx: index('idx_follows_follower').on(table.followerId),
  followingIdx: index('idx_follows_following').on(table.followingId),
}));

// Trades table
export const trades = pgTable('trades', {
  id: uuid('id').primaryKey().defaultRandom(),
  initiatorId: text('initiator_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  coinOwnerId: text('coin_owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  coinId: uuid('coin_id').notNull().references(() => coins.id, { onDelete: 'cascade' }),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  initiatorIdx: index('idx_trade_initiator').on(table.initiatorId),
  coinOwnerIdx: index('idx_trade_coin_owner').on(table.coinOwnerId),
  coinIdx: index('idx_trade_coin').on(table.coinId),
  statusIdx: index('idx_trade_status').on(table.status),
}));

// Trade offers table
export const tradeOffers = pgTable('trade_offers', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  offererId: text('offerer_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  offeredCoinId: uuid('offered_coin_id').references(() => coins.id, { onDelete: 'set null' }),
  isCounterOffer: boolean('is_counter_offer').notNull().default(false),
  message: text('message'),
  status: text('status').notNull().default('pending'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index('idx_trade_offer_trade').on(table.tradeId),
  offererIdx: index('idx_trade_offer_offerer').on(table.offererId),
  coinIdx: index('idx_trade_offer_coin').on(table.offeredCoinId),
  statusIdx: index('idx_trade_offer_status').on(table.status),
}));

// Trade messages table
export const tradeMessages = pgTable('trade_messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  senderId: text('sender_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index('idx_trade_message_trade').on(table.tradeId),
  senderIdx: index('idx_trade_message_sender').on(table.senderId),
  createdIdx: index('idx_trade_message_created').on(table.createdAt),
}));

// Trade ratings table
export const tradeRatings = pgTable('trade_ratings', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  raterId: text('rater_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  ratedUserId: text('rated_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  rating: integer('rating').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  uniqueIdx: uniqueIndex('idx_trade_rating_unique').on(table.tradeId, table.raterId),
  tradeIdx: index('idx_trade_rating_trade').on(table.tradeId),
  raterIdx: index('idx_trade_rating_rater').on(table.raterId),
  ratedIdx: index('idx_trade_rating_rated').on(table.ratedUserId),
}));

// Trade shipping table
export const tradeShipping = pgTable('trade_shipping', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().unique().references(() => trades.id, { onDelete: 'cascade' }),
  initiatorShipped: boolean('initiator_shipped').notNull().default(false),
  initiatorTrackingNumber: text('initiator_tracking_number'),
  initiatorShippedAt: timestamp('initiator_shipped_at'),
  initiatorReceived: boolean('initiator_received').notNull().default(false),
  initiatorReceivedAt: timestamp('initiator_received_at'),
  ownerShipped: boolean('owner_shipped').notNull().default(false),
  ownerTrackingNumber: text('owner_tracking_number'),
  ownerShippedAt: timestamp('owner_shipped_at'),
  ownerReceived: boolean('owner_received').notNull().default(false),
  ownerReceivedAt: timestamp('owner_received_at'),
  initiatorAddress: text('initiator_address'),
  ownerAddress: text('owner_address'),
  addressesExchanged: boolean('addresses_exchanged').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index('idx_trade_shipping_trade').on(table.tradeId),
}));

// Trade reports table
export const tradeReports = pgTable('trade_reports', {
  id: uuid('id').primaryKey().defaultRandom(),
  tradeId: uuid('trade_id').notNull().references(() => trades.id, { onDelete: 'cascade' }),
  reporterId: text('reporter_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reportedUserId: text('reported_user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  reason: text('reason').notNull(),
  description: text('description'),
  status: text('status').notNull().default('pending'),
  reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
  reviewNotes: text('review_notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  tradeIdx: index('idx_trade_report_trade').on(table.tradeId),
  reporterIdx: index('idx_trade_report_reporter').on(table.reporterId),
  reportedIdx: index('idx_trade_report_reported').on(table.reportedUserId),
  statusIdx: index('idx_trade_report_status').on(table.status),
}));

// User monthly stats table
export const userMonthlyStats = pgTable('user_monthly_stats', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  month: text('month').notNull(),
  coinsUploadedCount: integer('coins_uploaded_count').notNull().default(0),
  tradesInitiatedCount: integer('trades_initiated_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  userMonthIdx: uniqueIndex('idx_user_id_month').on(table.userId, table.month),
  userIdx: index('idx_user_id').on(table.userId),
  monthIdx: index('idx_month').on(table.month),
}));

// Subscription receipts table
export const subscriptionReceipts = pgTable('subscription_receipts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  platform: text('platform').notNull(),
  productId: text('product_id').notNull(),
  transactionId: text('transaction_id').notNull().unique(),
  originalTransactionId: text('original_transaction_id'),
  purchaseDate: timestamp('purchase_date').notNull(),
  expiresDate: timestamp('expires_date').notNull(),
  receipt: text('receipt').notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => ({
  transactionIdIdx: uniqueIndex('idx_receipt_transaction_id').on(table.transactionId),
  userIdIdx: index('idx_receipt_user_id').on(table.userId),
  platformIdx: index('idx_receipt_platform').on(table.platform),
  isActiveIdx: index('idx_receipt_is_active').on(table.isActive),
  expiresDateIdx: index('idx_receipt_expires_date').on(table.expiresDate),
}));

// Password reset tokens table
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  used: boolean('used').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_password_reset_user_id').on(table.userId),
  tokenIdx: index('idx_password_reset_token').on(table.token),
  usedIdx: index('idx_password_reset_used').on(table.used),
  expiresAtIdx: index('idx_password_reset_expires_at').on(table.expiresAt),
}));

// Relations
export const usersRelations = relations(users, ({ many, one }) => ({
  coins: many(coins),
  likes: many(likes),
  comments: many(comments),
  follower: many(follows, { relationName: 'follower' }),
  following: many(follows, { relationName: 'following' }),
  initiatedTrades: many(trades, { relationName: 'initiator' }),
  ownedTrades: many(trades, { relationName: 'coinOwner' }),
  tradeOffers: many(tradeOffers),
  tradeMessages: many(tradeMessages),
  ratedByTradeRatings: many(tradeRatings, { relationName: 'ratedUser' }),
  ratingTradeRatings: many(tradeRatings, { relationName: 'rater' }),
  subscriptionReceipts: many(subscriptionReceipts),
  userMonthlyStats: many(userMonthlyStats),
  reportedTradeReports: many(tradeReports, { relationName: 'reportedUser' }),
  reporterTradeReports: many(tradeReports, { relationName: 'reporter' }),
  reviewedByTradeReports: many(tradeReports, { relationName: 'reviewedBy' }),
}));

export const coinsRelations = relations(coins, ({ one, many }) => ({
  user: one(users, {
    fields: [coins.userId],
    references: [users.id],
  }),
  images: many(coinImages),
  likes: many(likes),
  comments: many(comments),
  trades: many(trades),
  offeredInTradeOffers: many(tradeOffers, { relationName: 'offeredCoin' }),
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
    relationName: 'follower',
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
  ratings: many(tradeRatings),
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
    relationName: 'offeredCoin',
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

export const tradeRatingsRelations = relations(tradeRatings, ({ one }) => ({
  trade: one(trades, {
    fields: [tradeRatings.tradeId],
    references: [trades.id],
  }),
  rater: one(users, {
    fields: [tradeRatings.raterId],
    references: [users.id],
    relationName: 'rater',
  }),
  ratedUser: one(users, {
    fields: [tradeRatings.ratedUserId],
    references: [users.id],
    relationName: 'ratedUser',
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
  reviewedByUser: one(users, {
    fields: [tradeReports.reviewedBy],
    references: [users.id],
    relationName: 'reviewedBy',
  }),
}));

export const userMonthlyStatsRelations = relations(userMonthlyStats, ({ one }) => ({
  user: one(users, {
    fields: [userMonthlyStats.userId],
    references: [users.id],
  }),
}));

export const subscriptionReceiptsRelations = relations(subscriptionReceipts, ({ one }) => ({
  user: one(users, {
    fields: [subscriptionReceipts.userId],
    references: [users.id],
  }),
}));

export const inviteCodesRelations = relations(inviteCodes, ({ many }) => ({
  // No direct relation to users in the schema, but could be referenced
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));
