import { Hono } from 'hono';
import { json } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

const billing = new Hono<{ Bindings: Env }>();

billing.get('/v1/billing/plan', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);
  const rows = await sql<{ plan: string; plan_expires_at: string | null }[]>`
    SELECT plan, plan_expires_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows.length) return json({ error: 'unauthorized' }, { status: 401 });
  const row = rows[0];
  return json({ plan: row.plan ?? 'free', planExpiresAt: row.plan_expires_at ?? null });
});

// Admin-only: manually activate a plan (no Stripe yet — used for testing/manual grants)
billing.post('/v1/billing/activate', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const body = (await c.req.json()) as { plan?: string; planExpiresAt?: string | null };
  const plan = body.plan === 'tax' ? 'tax' : 'free';
  const planExpiresAt = body.planExpiresAt ?? null;
  const sql = getSql(c.env);
  await sql`UPDATE users SET plan = ${plan}, plan_expires_at = ${planExpiresAt} WHERE id = ${userId}`;
  return json({ ok: true, plan, planExpiresAt });
});

export { billing };
