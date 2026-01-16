import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and, or, ilike, between } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';

export function registerSearchRoutes(app: App) {
  // Search coins with multiple filters
  app.fastify.get('/api/search/coins', async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      q,
      country,
      year_from,
      year_to,
      unit,
      organization,
      condition,
      openToTrade,
      limit = 20,
      offset = 0,
    } = request.query as {
      q?: string;
      country?: string;
      year_from?: string;
      year_to?: string;
      unit?: string;
      organization?: string;
      condition?: string;
      openToTrade?: string;
      limit?: number;
      offset?: number;
    };

    app.logger.info(
      { q, country, year_from, year_to, unit, organization, condition, openToTrade, limit, offset },
      'Searching coins',
    );

    try {
      const conditions: any[] = [eq(schema.coins.visibility, 'public')];

      // Text search on title and description
      if (q) {
        conditions.push(or(ilike(schema.coins.title, `%${q}%`), ilike(schema.coins.description, `%${q}%`)));
      }

      if (country) {
        conditions.push(ilike(schema.coins.country, `%${country}%`));
      }

      if (year_from || year_to) {
        const from = year_from ? parseInt(year_from) : 1800;
        const to = year_to ? parseInt(year_to) : new Date().getFullYear();
        conditions.push(between(schema.coins.year, from, to));
      }

      if (unit) {
        conditions.push(ilike(schema.coins.unit, `%${unit}%`));
      }

      if (organization) {
        conditions.push(ilike(schema.coins.organization, `%${organization}%`));
      }

      if (condition) {
        conditions.push(eq(schema.coins.condition, condition as any));
      }

      if (openToTrade === 'true') {
        conditions.push(eq(schema.coins.tradeStatus, 'open_to_trade'));
      }

      const coins = await app.db.query.coins.findMany({
        where: and(...conditions),
        with: {
          user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
          images: {
            limit: 1,
          },
          likes: { columns: { userId: true } },
        },
        limit,
        offset,
      });

      // Format response
      const results = coins.map((coin) => ({
        id: coin.id,
        title: coin.title,
        year: coin.year,
        country: coin.country,
        unit: coin.unit,
        organization: coin.organization,
        condition: coin.condition,
        imageUrl: coin.images[0]?.url || null,
        user: coin.user,
        likeCount: coin.likes.length,
        openToTrade: coin.tradeStatus === 'open_to_trade',
        createdAt: coin.createdAt,
      }));

      app.logger.info({ count: results.length, limit, offset }, 'Coin search completed');
      return results;
    } catch (error) {
      app.logger.error({ err: error, q, country }, 'Failed to search coins');
      throw error;
    }
  });

  // Search users by username or display name
  app.fastify.get('/api/search/users', async (request: FastifyRequest, reply: FastifyReply) => {
    const { q, limit = 20, offset = 0 } = request.query as { q?: string; limit?: number; offset?: number };

    app.logger.info({ q, limit, offset }, 'Searching users');

    try {
      if (!q || q.length < 2) {
        app.logger.warn({ q }, 'Search query too short');
        return reply.status(400).send({ error: 'Search query must be at least 2 characters' });
      }

      const users = await app.db.query.users.findMany({
        where: or(ilike(schema.users.username, `%${q}%`), ilike(schema.users.displayName, `%${q}%`)),
        limit,
        offset,
      });

      // Generate signed URLs for user avatars
      const usersWithAvatars = await Promise.all(
        users.map(async (user) => {
          let avatarUrl = user.avatarUrl;
          if (avatarUrl) {
            try {
              const { url } = await app.storage.getSignedUrl(avatarUrl);
              avatarUrl = url;
            } catch (urlError) {
              app.logger.warn({ err: urlError, userId: user.id }, 'Failed to generate avatar signed URL');
              avatarUrl = null;
            }
          }
          return { ...user, avatarUrl };
        })
      );

      app.logger.info({ q, count: usersWithAvatars.length }, 'User search completed');
      return usersWithAvatars;
    } catch (error) {
      app.logger.error({ err: error, q }, 'Failed to search users');
      throw error;
    }
  });

  // Advanced search with facets
  app.fastify.get('/api/search/advanced', async (request: FastifyRequest, reply: FastifyReply) => {
    const {
      q,
      country,
      year_from,
      year_to,
      unit,
      organization,
      condition,
      openToTrade,
      limit = 20,
      offset = 0,
    } = request.query as {
      q?: string;
      country?: string;
      year_from?: string;
      year_to?: string;
      unit?: string;
      organization?: string;
      condition?: string;
      openToTrade?: string;
      limit?: number;
      offset?: number;
    };

    app.logger.info({ q, country, limit, offset }, 'Running advanced search');

    try {
      const conditions: any[] = [eq(schema.coins.visibility, 'public')];

      // Text search
      if (q) {
        conditions.push(or(ilike(schema.coins.title, `%${q}%`), ilike(schema.coins.description, `%${q}%`)));
      }

      if (country) {
        conditions.push(ilike(schema.coins.country, `%${country}%`));
      }

      if (year_from || year_to) {
        const from = year_from ? parseInt(year_from) : 1800;
        const to = year_to ? parseInt(year_to) : new Date().getFullYear();
        conditions.push(between(schema.coins.year, from, to));
      }

      if (unit) {
        conditions.push(ilike(schema.coins.unit, `%${unit}%`));
      }

      if (organization) {
        conditions.push(ilike(schema.coins.organization, `%${organization}%`));
      }

      if (condition) {
        conditions.push(eq(schema.coins.condition, condition as any));
      }

      if (openToTrade === 'true') {
        conditions.push(eq(schema.coins.tradeStatus, 'open_to_trade'));
      }

      // Get results
      const coins = await app.db.query.coins.findMany({
        where: and(...conditions),
        with: {
          user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
          images: {
            limit: 1,
          },
        },
        limit,
        offset,
      });

      // Get aggregated facets for filtering
      const allCoins = await app.db.query.coins.findMany({
        where: and(...conditions.slice(0, 1)), // Just public coins
      });

      const countries = [...new Set(allCoins.map((c) => c.country))];
      const units = [...new Set(allCoins.map((c) => c.unit).filter(Boolean))];
      const organizations = [...new Set(allCoins.map((c) => c.organization).filter(Boolean))];
      const conditions_list = [...new Set(allCoins.map((c) => c.condition).filter(Boolean))];

      // Format results
      const results = coins.map((coin) => ({
        id: coin.id,
        title: coin.title,
        year: coin.year,
        country: coin.country,
        unit: coin.unit,
        organization: coin.organization,
        condition: coin.condition,
        imageUrl: coin.images[0]?.url || null,
        owner: {
          id: coin.user?.id || '',
          username: coin.user?.username || '',
          displayName: coin.user?.displayName || '',
          avatarUrl: coin.user?.avatarUrl || null,
        },
        likeCount: coin.likeCount,
        openToTrade: coin.tradeStatus === 'open_to_trade',
        createdAt: coin.createdAt,
      }));

      app.logger.info({ count: results.length, facets: { countries: countries.length } }, 'Advanced search completed');
      return {
        results,
        facets: {
          countries,
          units,
          organizations,
          conditions: conditions_list,
        },
      };
    } catch (error) {
      app.logger.error({ err: error, q }, 'Failed to run advanced search');
      throw error;
    }
  });
}
