import type { FastifyInstance } from 'fastify';
import { requireAuth, getUserId } from '../services/authHooks.js';

export function registerBillingRoutes(app: FastifyInstance) {
  app.get('/v1/billing/plan', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const user = app.db.getOne<{ plan: string | null; planExpiresAt: string | null }>(
      'SELECT plan, planExpiresAt FROM users WHERE id=?',
      [userId],
    );
    if (!user) return reply.code(401).send({ error: 'unauthorized' });
    return reply.send({ plan: user.plan ?? 'free', planExpiresAt: user.planExpiresAt ?? null });
  });

  const ActivateSchema = {
    type: 'object',
    properties: {
      plan: { type: 'string', enum: ['free', 'tax'] },
      planExpiresAt: { type: ['string', 'null'] },
    },
  };

  app.post(
    '/v1/billing/activate',
    { preHandler: requireAuth, schema: { body: ActivateSchema } },
    async (req, reply) => {
      const userId = getUserId(req);
      const body = req.body as { plan?: string; planExpiresAt?: string | null };
      const plan = body.plan === 'tax' ? 'tax' : 'free';
      const planExpiresAt = body.planExpiresAt ?? null;
      app.db.exec('UPDATE users SET plan=?, planExpiresAt=? WHERE id=?', [
        plan,
        planExpiresAt,
        userId,
      ]);
      return reply.send({ ok: true, plan, planExpiresAt });
    },
  );
}
