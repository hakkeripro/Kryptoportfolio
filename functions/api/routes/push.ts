import { Hono } from 'hono';
import { json, readJson } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { newId, requireAuth } from '../../_lib/auth';
import { isWebPushConfigured, sendWebPushToUser, type PushMessage } from '../../_lib/pushSender';
import { WebPushSubscribeSchema, WebPushUnsubscribeSchema } from '@kp/core';

const push = new Hono<{ Bindings: Env }>();

push.get('/v1/push/web/vapidPublicKey', async (c) => {
  const enabled = isWebPushConfigured(c.env);
  return json({ enabled, publicKey: enabled ? c.env.VAPID_PUBLIC_KEY : null });
});

push.post('/v1/push/web/subscribe', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = WebPushSubscribeSchema.parse(await readJson(c.req.raw));

  const sub = body.subscription as any;
  const endpoint = String(sub?.endpoint ?? '');
  if (!endpoint) return json({ error: 'invalid_subscription' }, { status: 400 });

  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM web_push_subscriptions WHERE user_id=${userId} AND endpoint=${endpoint} LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE web_push_subscriptions
      SET subscription_json=${JSON.stringify(sub)}, updated_at_iso=${nowISO}, is_active=TRUE
      WHERE id=${existing[0].id} AND user_id=${userId}
    `;
  } else {
    await sql`
      INSERT INTO web_push_subscriptions(id,user_id,endpoint,subscription_json,created_at_iso,updated_at_iso,is_active)
      VALUES (${newId('wps')}, ${userId}, ${endpoint}, ${JSON.stringify(sub)}, ${nowISO}, ${nowISO}, TRUE)
    `;
  }

  return json({ ok: true });
});

push.post('/v1/push/web/unsubscribe', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = WebPushUnsubscribeSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  await sql`DELETE FROM web_push_subscriptions WHERE user_id=${userId} AND endpoint=${body.endpoint}`;
  return json({ ok: true });
});

push.post('/v1/push/web/test', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);

  if (!isWebPushConfigured(c.env)) {
    return json({ ok: false, error: 'push_not_configured' }, { status: 400 });
  }

  const payload = {
    title: 'Kryptoportfolio',
    body: 'Test notification',
    url: '/alerts',
    data: { kind: 'TEST' },
  };

  const msg: PushMessage = { data: JSON.stringify(payload), options: { ttl: 60 } };
  const r = await sendWebPushToUser(sql, c.env, userId, msg);
  return json(r);
});

export { push };
