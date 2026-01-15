import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

// Allowed image formats
const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

const UpdateImageOrderSchema = z.object({
  images: z.array(
    z.object({
      id: z.string(),
      orderIndex: z.number().int().min(0),
    }),
  ),
});

/**
 * Coin Image Upload Routes
 *
 * Allows users to upload front and back photos of coins.
 * Supports jpg, jpeg, png, webp formats up to 10MB.
 */
export function registerCoinImagesRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * POST /api/coins/:coinId/images
   * Upload a coin image
   * Returns: { id, url, orderIndex, createdAt }
   */
  app.fastify.post('/api/coins/:coinId/images', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Starting coin image upload');

    try {
      // Check coin ownership
      let coin;
      try {
        coin = await app.db.query.coins.findFirst({
          where: eq(schema.coins.id, coinId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId }, 'Database error checking coin');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized image upload');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get file
      const data = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });

      if (!data) {
        app.logger.warn({ coinId, userId: session.user.id }, 'No file provided');
        return reply.status(400).send({ error: 'No file provided' });
      }

      // Validate file format
      const fileExtension = data.filename.split('.').pop()?.toLowerCase();
      if (!fileExtension || !ALLOWED_EXTENSIONS.includes(fileExtension)) {
        app.logger.warn({ coinId, filename: data.filename, ext: fileExtension }, 'Invalid file format');
        return reply.status(400).send({
          error: 'Invalid file format',
          message: 'Supported formats: jpg, jpeg, png, webp',
        });
      }

      let buffer: Buffer;
      try {
        buffer = await data.toBuffer();
      } catch (err) {
        app.logger.warn({ coinId, fileName: data.filename, err }, 'File too large or read error');
        return reply.status(413).send({ error: 'File too large (max 10MB)' });
      }

      // Upload to storage
      let storageKey: string;
      try {
        const timestamp = Date.now();
        const cleanFilename = data.filename.replace(/[^a-zA-Z0-9.-]/g, '_');
        const key = `coins/${coinId}/${timestamp}-${cleanFilename}`;
        storageKey = await app.storage.upload(key, buffer);
        app.logger.debug({ coinId, storageKey }, 'File uploaded to storage');
      } catch (storageError) {
        app.logger.error({ err: storageError, coinId }, 'Storage upload failed');
        return reply.status(503).send({ error: 'Storage error', message: 'Failed to upload image' });
      }

      // Get next order index
      let lastImages;
      try {
        lastImages = await app.db.query.coinImages.findMany({
          where: eq(schema.coinImages.coinId, coinId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId }, 'Database error fetching images');
        return reply.status(503).send({ error: 'Database error' });
      }

      const nextOrder = lastImages.length;

      // Save to database with storage key
      let image;
      try {
        const [newImage] = await app.db
          .insert(schema.coinImages)
          .values({
            coinId,
            url: storageKey, // Store the storage key
            orderIndex: nextOrder,
          })
          .returning();
        image = newImage;
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId, storageKey }, 'Database error saving image record');
        // Try to delete the uploaded file
        try {
          await app.storage.delete(storageKey);
        } catch (deleteError) {
          app.logger.error({ err: deleteError, storageKey }, 'Failed to cleanup uploaded file');
        }
        return reply.status(503).send({ error: 'Database error', message: 'Failed to save image' });
      }

      // Generate signed URL for the response
      let signedUrl;
      try {
        const { url } = await app.storage.getSignedUrl(storageKey);
        signedUrl = url;
      } catch (urlError) {
        app.logger.warn({ err: urlError, storageKey }, 'Failed to generate signed URL');
        signedUrl = null;
      }

      app.logger.info({ coinId, imageId: image.id, orderIndex: image.orderIndex }, 'Coin image uploaded successfully');
      return {
        id: image.id,
        url: signedUrl,
        storageKey: image.url, // Internal reference
        orderIndex: image.orderIndex,
        createdAt: image.createdAt,
      };
    } catch (error) {
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Unexpected error during image upload');
      return reply.status(500).send({ error: 'Upload failed', message: 'An unexpected error occurred' });
    }
  });

  /**
   * GET /api/coins/:coinId/images
   * Get all images for a coin with signed URLs
   */
  app.fastify.get('/api/coins/:coinId/images', async (request: FastifyRequest, reply: FastifyReply) => {
    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId }, 'Fetching coin images');

    try {
      const images = await app.db.query.coinImages.findMany({
        where: eq(schema.coinImages.coinId, coinId),
      });

      // Generate signed URLs for each image
      const imagesWithUrls = await Promise.all(
        images.map(async (img) => {
          try {
            const { url } = await app.storage.getSignedUrl(img.url);
            return {
              id: img.id,
              url: url,
              orderIndex: img.orderIndex,
              createdAt: img.createdAt,
            };
          } catch (urlError) {
            app.logger.warn({ err: urlError, imageId: img.id }, 'Failed to generate signed URL');
            return {
              id: img.id,
              url: null, // Fallback if URL generation fails
              orderIndex: img.orderIndex,
              createdAt: img.createdAt,
            };
          }
        })
      );

      app.logger.info({ coinId, count: imagesWithUrls.length }, 'Coin images fetched');
      return imagesWithUrls;
    } catch (error) {
      app.logger.error({ err: error, coinId }, 'Failed to fetch coin images');
      return reply.status(503).send({ error: 'Database error', message: 'Failed to fetch images' });
    }
  });

  /**
   * DELETE /api/coins/:coinId/images/:imageId
   * Delete a coin image from database and storage
   */
  app.fastify.delete('/api/coins/:coinId/images/:imageId', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId, imageId } = request.params as { coinId: string; imageId: string };

    app.logger.info({ coinId, imageId, userId: session.user.id }, 'Deleting coin image');

    try {
      // Check coin ownership
      let coin;
      try {
        coin = await app.db.query.coins.findFirst({
          where: eq(schema.coins.id, coinId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId }, 'Database error checking coin');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized image deletion');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Get image
      let image;
      try {
        image = await app.db.query.coinImages.findFirst({
          where: and(eq(schema.coinImages.id, imageId), eq(schema.coinImages.coinId, coinId)),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, imageId }, 'Database error fetching image');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!image) {
        app.logger.warn({ coinId, imageId }, 'Image not found');
        return reply.status(404).send({ error: 'Image not found' });
      }

      // Delete from storage
      try {
        await app.storage.delete(image.url);
        app.logger.debug({ storageKey: image.url }, 'File deleted from storage');
      } catch (storageError) {
        app.logger.warn({ err: storageError, storageKey: image.url }, 'Failed to delete file from storage');
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database
      try {
        await app.db.delete(schema.coinImages).where(eq(schema.coinImages.id, imageId));
      } catch (dbError) {
        app.logger.error({ err: dbError, imageId }, 'Database error deleting image');
        return reply.status(503).send({ error: 'Database error' });
      }

      app.logger.info({ coinId, imageId }, 'Coin image deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, coinId, imageId, userId: session.user.id }, 'Unexpected error during image deletion');
      return reply.status(500).send({ error: 'Deletion failed' });
    }
  });

  /**
   * POST /api/coins/:coinId/images/reorder
   * Reorder coin images
   */
  app.fastify.post('/api/coins/:coinId/images/reorder', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { coinId } = request.params as { coinId: string };

    app.logger.info({ coinId, userId: session.user.id }, 'Reordering coin images');

    try {
      const body = UpdateImageOrderSchema.parse(request.body);

      // Check coin ownership
      let coin;
      try {
        coin = await app.db.query.coins.findFirst({
          where: eq(schema.coins.id, coinId),
        });
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId }, 'Database error checking coin');
        return reply.status(503).send({ error: 'Database error' });
      }

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      if (coin.userId !== session.user.id) {
        app.logger.warn({ coinId, userId: session.user.id, ownerId: coin.userId }, 'Unauthorized reorder');
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Update all image orders
      try {
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
      } catch (dbError) {
        app.logger.error({ err: dbError, coinId }, 'Database error reordering images');
        return reply.status(503).send({ error: 'Database error', message: 'Failed to reorder images' });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Unexpected error during reorder');
      return reply.status(500).send({ error: 'Reorder failed' });
    }
  });
}
