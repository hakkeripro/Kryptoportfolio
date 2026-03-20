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

const OAuthGoogleSchema = z.object({
  code: z.string().min(1),
  codeVerifier: z.string().min(1),
  redirectUri: z.string().url(),
});

auth.post('/v1/auth/oauth/google', async (c) => {
  const body = OAuthGoogleSchema.parse(await readJson(c.req.raw));
  const clientId = c.env.GOOGLE_CLIENT_ID;
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return json({ error: 'oauth_not_configured' }, { status: 501 });

  // Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: body.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: body.redirectUri,
      code_verifier: body.codeVerifier,
    }),
  });
  if (!tokenRes.ok) return json({ error: 'oauth_token_exchange_failed' }, { status: 400 });
  const tokenData = (await tokenRes.json()) as { access_token?: string };
  const accessToken = tokenData.access_token;
  if (!accessToken) return json({ error: 'oauth_no_access_token' }, { status: 400 });

  // Fetch user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!userRes.ok) return json({ error: 'oauth_userinfo_failed' }, { status: 400 });
  const userInfo = (await userRes.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
  };
  if (!userInfo.sub || !userInfo.email || !userInfo.email_verified) {
    return json({ error: 'oauth_unverified_email' }, { status: 400 });
  }

  const sql = getSql(c.env);
  const googleSub = userInfo.sub;
  const email = normalizeEmail(userInfo.email);

  // Check if already registered with this google_sub
  const byGoogleSub = await sql<{ id: string; plan: string; plan_expires_at: string | null; created_at_iso: string }[]>`
    SELECT id, plan, plan_expires_at, created_at_iso FROM users WHERE google_sub = ${googleSub} LIMIT 1
  `;
  if (byGoogleSub.length) {
    const u = byGoogleSub[0];
    const plan = u.plan ?? 'free';
    const token = await signToken(c.env.JWT_SECRET, u.id, email, plan);
    return json({ user: { id: u.id, email, createdAtISO: u.created_at_iso }, token, plan, planExpiresAt: u.plan_expires_at ?? null });
  }

  // Check if email is taken by a password user
  const byEmail = await sql<{ id: string; google_sub: string | null }[]>`
    SELECT id, google_sub FROM users WHERE email = ${email} LIMIT 1
  `;
  if (byEmail.length && !byEmail[0].google_sub) {
    return json({ error: 'email_taken_password' }, { status: 409 });
  }

  // Create new OAuth user
  const userId = newId('usr');
  const createdAtISO = new Date().toISOString();
  await sql`
    INSERT INTO users (id, email, google_sub, created_at_iso, plan)
    VALUES (${userId}, ${email}, ${googleSub}, ${createdAtISO}, 'free')
  `;
  const token = await signToken(c.env.JWT_SECRET, userId, email, 'free');
  return json({ user: { id: userId, email, createdAtISO }, token, plan: 'free', planExpiresAt: null });
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
