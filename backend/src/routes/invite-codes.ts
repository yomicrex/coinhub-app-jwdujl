import type { FastifyRequest, FastifyReply } from 'fastify';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema.js';
import type { App } from '../index.js';
import { z } from 'zod';

const ValidateInviteCodeSchema = z.object({
  code: z.string().min(1),
});

export function registerInviteCodesRoutes(app: App) {
  /**
   * POST /api/invite-codes/validate
   * Validate an invite code
   */
  app.fastify.post('/api/invite-codes/validate', async (request: FastifyRequest, reply: FastifyReply) => {
    app.logger.info({ body: request.body }, 'Validating invite code');

    try {
      const body = ValidateInviteCodeSchema.parse(request.body);

      const inviteCode = await app.db.query.inviteCodes.findFirst({
        where: eq(schema.inviteCodes.code, body.code),
      });

      if (!inviteCode) {
        app.logger.warn({ code: body.code }, 'Invalid invite code');
        return reply.status(400).send({ error: 'Invalid invite code' });
      }

      // Check expiration
      if (inviteCode.expiresAt && new Date() > new Date(inviteCode.expiresAt)) {
        app.logger.warn({ code: body.code }, 'Invite code has expired');
        return reply.status(400).send({ error: 'Invite code has expired' });
      }

      // Check usage limit
      if (inviteCode.usageLimit && inviteCode.usageCount >= inviteCode.usageLimit) {
        app.logger.warn({ code: body.code, usageCount: inviteCode.usageCount }, 'Invite code usage limit reached');
        return reply.status(400).send({ error: 'Invite code usage limit reached' });
      }

      app.logger.info({ code: body.code }, 'Invite code validated successfully');
      return {
        valid: true,
        code: inviteCode.code,
        usageCount: inviteCode.usageCount,
        usageLimit: inviteCode.usageLimit,
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        app.logger.warn({ error: error.issues }, 'Validation error');
        return reply.status(400).send({ error: 'Validation failed', details: error.issues });
      }
      app.logger.error({ err: error }, 'Failed to validate invite code');
      throw error;
    }
  });

  /**
   * POST /api/invite-codes/use
   * Use an invite code during signup
   */
  app.fastify.post('/api/invite-codes/use', async (request: FastifyRequest, reply: FastifyReply) => {
    const { code } = request.body as { code: string };

    app.logger.info({ code }, 'Using invite code');

    try {
      const inviteCode = await app.db.query.inviteCodes.findFirst({
        where: eq(schema.inviteCodes.code, code),
      });

      if (!inviteCode) {
        app.logger.warn({ code }, 'Invalid invite code');
        return reply.status(400).send({ error: 'Invalid invite code' });
      }

      if (inviteCode.expiresAt && new Date() > new Date(inviteCode.expiresAt)) {
        app.logger.warn({ code }, 'Invite code has expired');
        return reply.status(400).send({ error: 'Invite code has expired' });
      }

      if (inviteCode.usageLimit && inviteCode.usageCount >= inviteCode.usageLimit) {
        app.logger.warn({ code, usageCount: inviteCode.usageCount }, 'Invite code usage limit reached');
        return reply.status(400).send({ error: 'Invite code usage limit reached' });
      }

      // Increment usage
      const updated = await app.db
        .update(schema.inviteCodes)
        .set({ usageCount: inviteCode.usageCount + 1 })
        .where(eq(schema.inviteCodes.id, inviteCode.id))
        .returning();

      app.logger.info({ code, usageCount: updated[0].usageCount }, 'Invite code used successfully');
      return { success: true, usageCount: updated[0].usageCount };
    } catch (error) {
      app.logger.error({ err: error, code: request.body }, 'Failed to use invite code');
      throw error;
    }
  });
}
