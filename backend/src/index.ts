import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInviteCodesRoutes } from './routes/invite-codes.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerCoinsRoutes } from './routes/coins.js';
import { registerCoinImagesRoutes } from './routes/coin-images.js';
import { registerLikesRoutes } from './routes/likes.js';
import { registerCommentsRoutes } from './routes/comments.js';
import { registerFeedRoutes } from './routes/feed.js';
import { registerFollowRoutes } from './routes/follows.js';
import { registerTradesRoutes } from './routes/trades.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerSubscriptionRoutes } from './routes/subscription.js';
import { createEmailService } from './services/email.js';
import { seedDatabase } from './db/seed.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

export type App = typeof app;

// Initialize email service
try {
  app.logger.info('Initializing email service');
  (app as any).email = createEmailService(app.logger);

  if (process.env.RESEND_API_KEY) {
    app.logger.info('Email service initialized successfully with API key');
  } else {
    app.logger.warn('Email service initialized but RESEND_API_KEY is not set - password reset emails will fail at runtime');
  }
} catch (error) {
  app.logger.error({ err: error }, 'Failed to initialize email service');
  throw error;
}

// Initialize authentication system
// Better Auth automatically enables email/password provider
try {
  app.logger.info('Initializing authentication system');
  app.withAuth();
  app.logger.info('Authentication initialized successfully');
} catch (error) {
  app.logger.error({ err: error }, 'Failed to initialize authentication');
  throw error;
}

// Configure CORS for Better Auth to accept requests from mobile apps and development
// This must be registered as a plugin BEFORE app.run()
try {
  const trustedOrigins: (string | RegExp)[] = [
    // Development
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',

    // Expo Go mobile app
    'exp://',
    'exps://',

    // Production backend
    'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev',

    // Mobile app origins
    'capacitor://',
    'ionic://',

    // Allow any origin containing 'localhost' or '127.0.0.1'
    /localhost/,
    /127\.0\.0\.1/,
  ];

  // Add custom origins from environment variable if provided
  if (process.env.TRUSTED_ORIGINS) {
    const customOrigins = process.env.TRUSTED_ORIGINS.split(',').map((o) => o.trim());
    trustedOrigins.push(...customOrigins);
    app.logger.info({ customOrigins }, 'Added custom trusted origins from environment');
  }

  // Register CORS middleware for Better Auth endpoints
  await app.fastify.register(async (fastifyInstance) => {
    fastifyInstance.addHook('onRequest', async (request, reply) => {
      const origin = request.headers.origin || request.headers.referer;

      if (!origin) {
        return; // No origin header, skip CORS check
      }

      // Check if origin is trusted
      const isTrusted = trustedOrigins.some((trustedOrigin) => {
        if (trustedOrigin instanceof RegExp) {
          return trustedOrigin.test(origin);
        }
        return origin.startsWith(trustedOrigin);
      });

      if (isTrusted) {
        reply.header('Access-Control-Allow-Origin', origin);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      }

      if (request.method === 'OPTIONS') {
        return reply.status(200).send();
      }
    });
  });

  app.logger.info(
    { originCount: trustedOrigins.length },
    'CORS configured for trusted origins'
  );
} catch (error) {
  app.logger.error({ err: error }, 'Failed to configure CORS');
  throw error;
}

// Initialize storage system for file uploads
try {
  app.logger.info('Initializing storage system');
  app.withStorage();
  app.logger.info('Storage system initialized successfully');
} catch (error) {
  app.logger.error({ err: error }, 'Failed to initialize storage');
  throw error;
}

// Register all routes AFTER app is created
try {
  app.logger.info('Registering authentication routes');
  registerAuthRoutes(app);
  app.logger.info('Authentication routes registered');

  app.logger.info('Registering CoinHub routes');
  registerInviteCodesRoutes(app);
  registerProfileRoutes(app);
  registerCoinsRoutes(app);
  registerCoinImagesRoutes(app);
  registerLikesRoutes(app);
  registerCommentsRoutes(app);
  registerFeedRoutes(app);
  registerFollowRoutes(app);
  registerTradesRoutes(app);
  registerSearchRoutes(app);
  registerSubscriptionRoutes(app);
  app.logger.info('All CoinHub routes registered');
} catch (error) {
  app.logger.error({ err: error }, 'Failed to register routes');
  throw error;
}

// Seed database with initial data
try {
  app.logger.info('Starting database seed');
  await seedDatabase();
  app.logger.info('Database seeded successfully');
} catch (error) {
  app.logger.error({ err: error }, 'Failed to seed database');
  // Don't throw - seeding failures shouldn't prevent app startup
}

try {
  await app.run();
  app.logger.info('CoinHub application running');
} catch (error) {
  app.logger.error({ err: error }, 'Failed to start application');
  process.exit(1);
}
