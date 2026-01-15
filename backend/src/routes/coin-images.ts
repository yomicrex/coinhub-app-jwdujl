import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const UpdateImageOrderSchema = z.object({
  images: z.array(
    z.object({
      id: z.string(),
      orderIndex: z.number().int().min(0),
    }),
  ),
});

export function registerCoinImagesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  // Upload coin image
  app.fastify.post('/api/coins/:coinId/images', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Uploading coin image');

    try {
      // Check coin ownership
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized image upload');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get file
      const data = await request.file({ limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB limit

      if (!data) {
        app.logger.warn({ coinId, userId: session.user.id }, 'No file provided');
        return reply.status(400).send({ error: 'No file provided' });
      }

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        app.logger.warn({ coinId, fileName: data.filename }, 'File too large');
        return reply.status(413).send({ error: 'File too large' });
      }

      // Get next order index
      const lastImages = await app.db.query.coinImages.findMany({
        where: eq(schema.coinImages.coinId, coinId),
      });
      const nextOrder = lastImages.length;

      // Save to database with URL
      const [image] = await app.db
        .insert(schema.coinImages)
        .values({
          coinId,
          url: data.filename,
          orderIndex: nextOrder,
        })
        .returning();

      app.logger.info({ coinId, imageId: image.id }, 'Coin image uploaded successfully');
      return image;
    } catch (error) {
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Failed to upload coin image');
      throw error;
    }
  });

  // Get coin images
  app.fastify.get('/api/coins/:coinId/images', async (request: FastifyRequest) => {
    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId }, 'Fetching coin images');

    try {
      const images = await app.db.query.coinImages.findMany({
        where: eq(schema.coinImages.coinId, coinId),
      });

      // Return images with URLs
      const imagesWithUrls = images.map((img) => ({
        id: img.id,
        url: img.url,
        orderIndex: img.orderIndex,
        createdAt: img.createdAt,
      }));

      app.logger.info({ coinId, count: imagesWithUrls.length }, 'Coin images fetched');
      return imagesWithUrls;
    } catch (error) {
      app.logger.error({ err: error, coinId }, 'Failed to fetch coin images');
      throw error;
    }
  });

  // Delete coin image
  app.fastify.delete('/api/coins/:coinId/images/:imageId', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId, imageId } = request.params as { coinId: string; imageId: string };

    app.logger.info({ coinId, imageId, userId: session.user.id }, 'Deleting coin image');

    try {
      // Check coin ownership
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized image deletion');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get image
      const image = await app.db.query.coinImages.findFirst({
        where: and(eq(schema.coinImages.id, imageId), eq(schema.coinImages.coinId, coinId)),
      });

      if (!image) {
        app.logger.warn({ coinId, imageId }, 'Image not found');
        return reply.status(404).send({ error: 'Image not found' });
      }

      // Delete from database
      await app.db.delete(schema.coinImages).where(eq(schema.coinImages.id, imageId));

      app.logger.info({ coinId, imageId }, 'Coin image deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, coinId, imageId, userId: session.user.id }, 'Failed to delete coin image');
      throw error;
    }
  });

  // Reorder coin images
  app.fastify.post('/api/coins/:coinId/images/reorder', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Reordering coin images');

    const body = UpdateImageOrderSchema.parse(request.body);

    try {
      // Check coin ownership
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized reorder');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Update all image orders
      const updated = await Promise.all(
        body.images.map(({ id, orderIndex }) =>
          app.db
            .update(schema.coinImages)
            .set({ orderIndex })
            .where(eq(schema.coinImages.id, id))
            .returning(),
        ),
      );

      app.logger.info({ coinId, count: updated.length }, 'Coin images reordered successfully');
      return { success: true, count: updated.length };
    } catch (error) {
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Failed to reorder images');
      throw error;
    }
  });
}
