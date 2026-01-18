import { app } from '../index.js';
import * as schema from './schema.js';
import * as authSchema from './auth-schema.js';
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

    // Seed test user profiles
    const testAccounts = [
      {
        email: 'yomicrex@gmail.com',
        username: 'Yomicrex',
        displayName: 'Yomicrex',
      },
      {
        email: 'yomicrex@mail.com',
        username: 'JJ1980',
        displayName: 'JJ1980',
      },
      {
        email: 'yomicrex@hotmail.com',
        username: 'JJ1981',
        displayName: 'JJ1981',
      },
    ];

    for (const account of testAccounts) {
      try {
        // Check if user profile already exists
        const existingProfile = await app.db.query.users.findFirst({
          where: eq(schema.users.username, account.username),
        });

        if (!existingProfile) {
          // Check if auth user exists
          const authUser = await app.db.query.user.findFirst({
            where: eq(authSchema.user.email, account.email),
          });

          if (authUser) {
            // Create user profile linked to auth user
            await app.db.insert(schema.users).values({
              id: authUser.id,
              email: account.email,
              username: account.username,
              displayName: account.displayName,
              bio: null,
              location: null,
              avatarUrl: null,
              collectionPrivacy: 'public',
              role: 'user',
              inviteCodeUsed: null,
            });

            app.logger.info(
              { email: account.email, username: account.username, userId: authUser.id },
              'Test user profile created'
            );
          } else {
            app.logger.warn(
              { email: account.email, username: account.username },
              'Auth user not found for test account - skipping profile creation'
            );
          }
        } else {
          app.logger.info(
            { username: account.username },
            'Test user profile already exists'
          );
        }
      } catch (profileError) {
        app.logger.error(
          { err: profileError, username: account.username },
          'Failed to create test user profile'
        );
        // Continue with other accounts
      }
    }

    app.logger.info('Database seed completed successfully');
  } catch (error) {
    app.logger.error({ err: error }, 'Database seed failed');
    throw error;
  }
}
