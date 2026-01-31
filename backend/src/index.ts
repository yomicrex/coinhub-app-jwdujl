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
    // Development web
    'http://localhost:3000',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:8081',

    // Expo Go mobile app
    'exp://localhost:8081',
    'exp://',
    'exps://',

    // Production backend
    'https://qjj7hh75bj9rj8tez54zsh74jpn3wv24.app.specular.dev',

    // iOS app schemes
    'coinhub://',
    'CoinHub://',
    'com.coinhub.app://',

    // Android app schemes (common patterns)
    'android-app://',

    // Hybrid mobile app origins
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
  // CRITICAL: Native mobile apps (iOS/Android/TestFlight) don't send origin headers
  // We use X-App-Type header to detect mobile apps instead of referer fallback
  // This also handles CSRF token validation for mobile apps
  await app.fastify.register(async (fastifyInstance) => {
    fastifyInstance.addHook('onRequest', async (request, reply) => {
      // Use ONLY origin header - do NOT fall back to referer
      // Treat the string "null" as no origin (browsers send this for file:// and data: URLs)
      let origin = request.headers.origin as string | undefined;
      if (origin === 'null') {
        origin = undefined;
      }

      const appType = request.headers['x-app-type'] as string | undefined;
      const platform = request.headers['x-platform'] as string | undefined;
      const userAgent = request.headers['user-agent'] || 'unknown';
      const isMobileApp = appType === 'standalone' || appType === 'expo-go';

      // Store values on request for preHandler middleware
      (request as any).origin = origin;
      (request as any).appType = appType;
      (request as any).platform = platform;
      (request as any).isMobileApp = isMobileApp;

      // Log for debugging - comprehensive request info
      app.logger.info(
        {
          origin: origin || 'none',
          appType: appType || 'none',
          platform: platform || 'none',
          isMobileApp,
          method: request.method,
          path: request.url,
          hasAuth: !!request.headers.authorization,
          userAgent: userAgent.substring(0, 100), // Truncate long user agents
          timestamp: new Date().toISOString()
        },
        `[CORS] Request received - ${request.method} ${request.url}`
      );

      // CORS handling: Allow requests without origin OR from mobile apps
      if (!origin || isMobileApp) {
        // For mobile apps, use the app type as origin if no origin provided
        const originToUse = origin || (isMobileApp ? appType : '*');

        reply.header('Access-Control-Allow-Origin', originToUse);
        reply.header('Access-Control-Allow-Credentials', 'true');
        reply.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-App-Type, X-Platform');

        // Mark request as from a trusted source for Better Auth CSRF checks
        (request as any).trustedForCSRF = true;

        // Log CORS handling for mobile/no-origin requests
        const reason = !origin ? 'No origin header (mobile or native app)' : `Mobile app (${appType})`;
        app.logger.info(
          {
            origin: origin || 'none',
            appType: appType || 'none',
            method: request.method,
            path: request.url,
            corsOriginSet: originToUse
          },
          `[CORS] ${reason} - allowing request with CORS headers`
        );

        // CRITICAL: For mobile auth endpoints, also mark for CSRF bypass
        if (request.url.startsWith('/api/auth/') && isMobileApp) {
          (request as any).skipCsrfCheck = true;
          (request as any).csrfBypassEnabled = true;

          app.logger.info(
            {
              origin: origin || 'none',
              appType: appType || 'unknown',
              method: request.method,
              path: request.url,
              action: 'Early CSRF bypass for mobile auth'
            },
            '[CSRF] Mobile app auth request - CSRF bypass enabled in onRequest'
          );
        }

        if (request.method === 'OPTIONS') {
          return reply.status(200).send();
        }
        return;
      }

      // If origin header is present, validate it against trusted origins
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
        reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token, X-App-Type, X-Platform');
        // Mark trusted origins for Better Auth CSRF checks
        (request as any).trustedForCSRF = true;
        app.logger.info(
          { origin, method: request.method, path: request.url },
          '[CORS] Request from trusted origin - allowing'
        );
      } else {
        app.logger.warn(
          {
            origin,
            trustedOriginCount: trustedOrigins.length,
            path: request.url,
            method: request.method
          },
          '[CORS] Request from untrusted origin - rejecting'
        );
      }

      if (request.method === 'OPTIONS') {
        return reply.status(200).send();
      }
    });
  });

  // Register CSRF bypass middleware for mobile apps - MORE AGGRESSIVE VERSION
  // Mobile apps use X-App-Type header to identify themselves
  // CRITICAL: Better Auth's CSRF protection must be bypassed for mobile app auth requests
  // This runs in onRequest (second registration) to mark requests BEFORE Better Auth's CSRF check
  await app.fastify.register(async (fastifyInstance) => {
    fastifyInstance.addHook('onRequest', async (request, reply) => {
      // Detect mobile apps using X-App-Type header
      const appType = request.headers['x-app-type'] as string | undefined;
      const isMobileApp = appType === 'standalone' || appType === 'expo-go';
      const hasAuthHeader = !!request.headers.authorization;

      // CRITICAL: For ALL auth endpoints from mobile apps, bypass CSRF
      // This prevents Better Auth from throwing "invalid origin" errors
      if (request.url.startsWith('/api/auth/') && isMobileApp) {
        // Mark this request with MULTIPLE properties to ensure CSRF bypass
        (request as any).skipCsrfCheck = true;
        (request as any).trustedForCSRF = true;
        (request as any).csrfBypassEnabled = true;

        // Also set on reply to ensure headers reflect CSRF bypass
        reply.header('X-CSRF-Bypass', 'true');

        app.logger.info(
          {
            method: request.method,
            path: request.url,
            appType,
            hasAuth: hasAuthHeader,
            reason: 'Mobile app auth request - CSRF completely bypassed',
            origin: (request as any).origin || 'none'
          },
          '[CSRF] Second onRequest - Bypassing CSRF check for mobile auth request (X-App-Type detected)'
        );
      }
    });
  });

  // Additional preHandler hook for backup CSRF bypass
  // Ensures CSRF bypass is applied even if Better Auth checks happen in preHandler
  await app.fastify.register(async (fastifyInstance) => {
    fastifyInstance.addHook('preHandler', async (request, reply) => {
      // Read stored mobile app flag from onRequest
      const appType = request.headers['x-app-type'] as string | undefined;
      const isMobileApp = appType === 'standalone' || appType === 'expo-go';

      // For mobile auth requests, reapply CSRF bypass markers
      if (request.url.startsWith('/api/auth/') && isMobileApp) {
        (request as any).skipCsrfCheck = true;
        (request as any).trustedForCSRF = true;
        (request as any).csrfBypassEnabled = true;

        app.logger.info(
          {
            method: request.method,
            path: request.url,
            appType,
            reason: 'Mobile app auth request - CSRF bypass reapplied in preHandler',
            alreadyMarked: {
              skipCsrfCheck: (request as any).skipCsrfCheck,
              trustedForCSRF: (request as any).trustedForCSRF,
              csrfBypassEnabled: (request as any).csrfBypassEnabled
            }
          },
          '[CSRF] preHandler - Reapplying CSRF bypass for mobile auth request'
        );
      }
    });
  });

  app.logger.info(
    { originCount: trustedOrigins.length },
    'CORS and CSRF bypass configured for mobile apps and trusted origins'
  );
} catch (error) {
  app.logger.error({ err: error }, 'Failed to configure CORS and CSRF handling');
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
