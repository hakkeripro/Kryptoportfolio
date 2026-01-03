import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../services/authHooks.js';
import { newId } from '../services/auth.js';

const WebPushSubSchema = z.object({
  subscription: z.record(z.any())
});

const UnsubSchema = z.object({
  endpoint: z.string().url()
});

const ExpoSchema = z.object({
  token: z.string().min(10)
});

export function registerPushRoutes(app: FastifyInstance) {
  app.get('/v1/push/web/vapidPublicKey', async () => {
    const enabled = !!(app.config.VAPID_PUBLIC_KEY && app.config.VAPID_PRIVATE_KEY);
    return { enabled, publicKey: app.config.VAPID_PUBLIC_KEY ?? null };
  });

  app.post('/v1/push/web/subscribe', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const body = WebPushSubSchema.parse(req.body);

    const sub = body.subscription as any;
    const endpoint = sub?.endpoint;
    if (!endpoint) return reply.code(400).send({ error: 'invalid_subscription' });

    const now = new Date().toISOString();
    const existing = app.db.getOne<{ id: string }>(
      'SELECT id FROM web_push_subscriptions WHERE userId=? AND endpoint=?',
      [userId, endpoint]
    );

    if (existing) {
      app.db.exec('UPDATE web_push_subscriptions SET subscriptionJson=?, updatedAtISO=? WHERE id=?', [
        JSON.stringify(sub),
        now,
        existing.id
      ]);
    } else {
      app.db.exec(
        'INSERT INTO web_push_subscriptions(id,userId,endpoint,subscriptionJson,createdAtISO,updatedAtISO) VALUES (?,?,?,?,?,?)',
        [newId('wps'), userId, endpoint, JSON.stringify(sub), now, now]
      );
    }

    return { ok: true };
  });

  app.post('/v1/push/web/unsubscribe', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const body = UnsubSchema.parse(req.body);
    app.db.exec('DELETE FROM web_push_subscriptions WHERE userId=? AND endpoint=?', [userId, body.endpoint]);
    return { ok: true };
  });

  app.post('/v1/push/expo/register', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const body = ExpoSchema.parse(req.body);
    const now = new Date().toISOString();
    const existing = app.db.getOne<{ id: string }>('SELECT id FROM expo_push_tokens WHERE token=?', [body.token]);
    if (existing) return { ok: true };
    app.db.exec('INSERT INTO expo_push_tokens(id,userId,token,createdAtISO) VALUES (?,?,?,?)', [
      newId('exp'),
      userId,
      body.token,
      now
    ]);
    return { ok: true };
  });
}
