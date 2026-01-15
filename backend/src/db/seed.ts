import { app } from '../index.js';
import * as schema from './schema.js';
import { eq } from 'drizzle-orm';

export async function seedDatabase() {
  app.logger.info('Starting database seed');

  try {
    // Check if seed data already exists
    const existingCode = await app.db.query.inviteCodes.findFirst({
      where: eq(schema.inviteCodes.code, 'BETA2026'),
    });

    if (!existingCode) {
      // Create initial invite code
      const [inviteCode] = await app.db
        .insert(schema.inviteCodes)
        .values({
          code: 'BETA2026',
          usageLimit: null, // Unlimited usage
          usageCount: 0,
          expiresAt: null,
        })
        .returning();

      app.logger.info({ code: inviteCode.code }, 'Initial invite code created');
    } else {
      app.logger.info('Initial invite code already exists');
    }

    app.logger.info('Database seed completed successfully');
  } catch (error) {
    app.logger.error({ err: error }, 'Database seed failed');
    throw error;
  }
}
