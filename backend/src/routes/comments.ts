import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const CreateCommentSchema = z.object({
  content: z.string().min(1).max(1000),
});

export function registerCommentsRoutes(app: App) {
  const requireAuth = app.requireAuth();

  /**
   * GET /api/coins/:id/comments
   * Get all comments for a coin
   */
  app.fastify.get('/api/coins/:id/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    const { id: coinId } = request.params as { id: string };

    app.logger.info({ coinId }, 'Fetching coin comments');

    try {
      // Check coin exists
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Get comments
      const comments = await app.db.query.comments.findMany({
        where: eq(schema.comments.coinId, coinId),
        with: {
          user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
        orderBy: (comment) => comment.createdAt,
      });

      const result = comments.map((comment) => ({
        id: comment.id,
        content: comment.isDeleted ? '[Comment deleted]' : comment.content,
        isDeleted: comment.isDeleted,
        user: comment.isDeleted ? null : comment.user,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      }));

      app.logger.info({ coinId, count: result.length }, 'Coin comments fetched');
      return result;
    } catch (error) {
      app.logger.error({ err: error, coinId }, 'Failed to fetch coin comments');
      throw error;
    }
  });

  /**
   * POST /api/coins/:id/comments
   * Create a comment on a coin (requires authentication)
   */
  app.fastify.post('/api/coins/:id/comments', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id: coinId } = request.params as { id: string };

    app.logger.info({ coinId, userId: session.user.id, body: request.body }, 'Creating comment');

    try {
      const body = CreateCommentSchema.parse(request.body);

      // Check coin exists
      const coin = await app.db.query.coins.findFirst({
        where: eq(schema.coins.id, coinId),
      });

      if (!coin) {
        app.logger.warn({ coinId }, 'Coin not found');
        return reply.status(404).send({ error: 'Coin not found' });
      }

      // Create comment
      const [comment] = await app.db
        .insert(schema.comments)
        .values({
          userId: session.user.id,
          coinId,
          content: body.content,
        })
        .returning();

      // Fetch with user info
      const fullComment = await app.db.query.comments.findFirst({
        where: eq(schema.comments.id, comment.id),
        with: {
          user: { columns: { id: true, username: true, displayName: true, avatarUrl: true } },
        },
      });

      // Increment coin comment count
      await app.db
        .update(schema.coins)
        .set({ commentCount: comment.id ? (coin.commentCount || 0) + 1 : coin.commentCount })
        .where(eq(schema.coins.id, coinId));

      app.logger.info({ coinId, userId: session.user.id, commentId: comment.id }, 'Comment created successfully');

      return {
        id: fullComment!.id,
        content: fullComment!.content,
        isDeleted: fullComment!.isDeleted,
        user: fullComment!.user,
        createdAt: fullComment!.createdAt,
        updatedAt: fullComment!.updatedAt,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error, coinId, userId: session.user.id }, 'Failed to create comment');
      throw error;
    }
  });

  /**
   * DELETE /api/comments/:id
   * Delete a comment (soft delete - owner can delete their own comments)
   */
  app.fastify.delete('/api/comments/:id', async (request: FastifyRequest, reply: FastifyReply) => {
    const session = await requireAuth(request, reply);
    if (!session) return;

    const { id: commentId } = request.params as { id: string };

    app.logger.info({ commentId, userId: session.user.id }, 'Deleting comment');

    try {
      // Get comment
      const comment = await app.db.query.comments.findFirst({
        where: eq(schema.comments.id, commentId),
      });

      if (!comment) {
        app.logger.warn({ commentId }, 'Comment not found');
        return reply.status(404).send({ error: 'Comment not found' });
      }

      // Check authorization: only owner can delete their own comments
      const isOwner = comment.userId === session.user.id;

      if (!isOwner) {
        app.logger.warn(
          { commentId, userId: session.user.id, ownerId: comment.userId },
          'Unauthorized comment deletion'
        );
        return reply.status(403).send({ error: 'Unauthorized' });
      }

      // Soft delete comment
      await app.db
        .update(schema.comments)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(eq(schema.comments.id, commentId));

      app.logger.info({ commentId, userId: session.user.id }, 'Comment deleted successfully');
      return { success: true };
    } catch (error) {
      app.logger.error({ err: error, commentId, userId: session.user.id }, 'Failed to delete comment');
      throw error;
    }
  });
}
