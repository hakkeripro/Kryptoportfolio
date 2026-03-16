import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { hashPassword, normalizeEmail, newId, requireAuth, signToken, changePassword } from '../../_lib/auth';

const auth = new Hono<{ Bindings: Env }>();

const RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });

auth.post('/v1/auth/register', async (c) => {
  const body = RegisterSchema.parse(await readJson(c.req.raw));
  const email = normalizeEmail(body.email);
  const sql = getSql(c.env);

  const existing = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length) return json({ error: 'email_taken' }, { status: 409 });

  const userId = newId('usr');
  const passwordHash = await hashPassword(body.password);
  const createdAtISO = new Date().toISOString();

  await sql`INSERT INTO users (id, email, password_hash, created_at_iso) VALUES (${userId}, ${email}, ${passwordHash}, ${createdAtISO})`;

  const token = await signToken(c.env.JWT_SECRET, userId, email, 'free');
  return json({ user: { id: userId, email, createdAtISO }, token });
});

auth.post('/v1/auth/login', async (c) => {
  const body = RegisterSchema.parse(await readJson(c.req.raw));
  const email = normalizeEmail(body.email);
  const sql = getSql(c.env);

  const rows = await sql<{
    id: string;
    password_hash: string;
    created_at_iso: string;
    plan: string;
    plan_expires_at: string | null;
  }[]>`
    SELECT id, password_hash, created_at_iso, plan, plan_expires_at FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!rows.length) return json({ error: 'invalid_credentials' }, { status: 401 });
  const user = rows[0];

  const { verifyPassword } = await import('../../_lib/auth');
  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) return json({ error: 'invalid_credentials' }, { status: 401 });

  const plan = user.plan ?? 'free';
  const token = await signToken(c.env.JWT_SECRET, user.id, email, plan);
  return json({
    user: { id: user.id, email, createdAtISO: user.created_at_iso },
    token,
    plan,
    planExpiresAt: user.plan_expires_at ?? null,
  });
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

auth.put('/v1/auth/password', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const body = ChangePasswordSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  const rows = await sql<{ password_hash: string }[]>`
    SELECT password_hash FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows.length) return json({ error: 'unauthorized' }, { status: 401 });

  const newHash = await changePassword(body.currentPassword, body.newPassword, rows[0].password_hash);
  if (!newHash) return json({ error: 'wrong_password' }, { status: 401 });

  await sql`UPDATE users SET password_hash = ${newHash} WHERE id = ${userId}`;
  return json({ ok: true });
});

auth.get('/v1/me', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);
  const rows = await sql<{ id: string; email: string; created_at_iso: string }[]>`
    SELECT id,email,created_at_iso FROM users WHERE id = ${userId} LIMIT 1
  `;
  return json({ user: rows[0] ?? null });
});

export { auth };
