import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerInviteCodesRoutes } from './routes/invite-codes.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerCoinsRoutes } from './routes/coins.js';
import { registerLikesRoutes } from './routes/likes.js';
import { registerCommentsRoutes } from './routes/comments.js';
import { seedDatabase } from './db/seed.js';

const schema = { ...appSchema, ...authSchema };

export const app = await createApplication(schema);

export type App = typeof app;

app.withAuth();

// Register all routes AFTER app is created
registerAuthRoutes(app);
registerInviteCodesRoutes(app);
registerProfileRoutes(app);
registerCoinsRoutes(app);
registerLikesRoutes(app);
registerCommentsRoutes(app);

// Seed database with initial data
try {
  await seedDatabase();
} catch (error) {
  app.logger.error({ err: error }, 'Failed to seed database');
}

await app.run();
app.logger.info('CoinHub application running');
