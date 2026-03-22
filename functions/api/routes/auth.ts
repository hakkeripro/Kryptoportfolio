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

// ---------------------------------------------------------------------------
// Feature 47: Password reset
// ---------------------------------------------------------------------------

const PasswordResetRequestSchema = z.object({ email: z.string().email() });

auth.post('/v1/auth/password-reset/request', async (c) => {
  const body = PasswordResetRequestSchema.parse(await readJson(c.req.raw));
  const email = normalizeEmail(body.email);
  const sql = getSql(c.env);

  // Always return { ok: true } — never reveal if email is registered
  const rows = await sql<{ id: string; password_hash: string | null }[]>`
    SELECT id, password_hash FROM users WHERE email = ${email} LIMIT 1
  `;

  if (rows.length && rows[0].password_hash !== null) {
    const userId = rows[0].id;
    const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    const expiresAtISO = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1h

    await sql`
      INSERT INTO password_reset_tokens (id, user_id, expires_at_iso)
      VALUES (${token}, ${userId}, ${expiresAtISO})
    `;

    const resendApiKey = c.env.RESEND_API_KEY;
    if (resendApiKey) {
      const resetUrl = `https://app.private-ledger.app/auth/reset-password?token=${token}`;
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${resendApiKey}`,
        },
        body: JSON.stringify({
          from: 'PrivateLedger <noreply@private-ledger.app>',
          to: email,
          subject: 'Reset your VaultFolio password',
          html: `
<p>Someone requested a password reset for your VaultFolio account.</p>
<p style="color:#d97706;font-weight:bold;">⚠ Warning: Resetting your password will permanently delete all your encrypted portfolio data. This cannot be undone.</p>
<p><a href="${resetUrl}" style="background:#FF8400;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;display:inline-block;">Reset password →</a></p>
<p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
`,
        }),
      });
    }
  }

  return json({ ok: true });
});

const PasswordResetConfirmSchema = z.object({
  token: z.string().min(64).max(64),
  newPassword: z.string().min(8).max(128),
});

auth.post('/v1/auth/password-reset/confirm', async (c) => {
  const body = PasswordResetConfirmSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  const tokens = await sql<{
    id: string;
    user_id: string;
    expires_at_iso: string;
    used_at_iso: string | null;
  }[]>`
    SELECT id, user_id, expires_at_iso, used_at_iso
    FROM password_reset_tokens
    WHERE id = ${body.token}
    LIMIT 1
  `;

  if (!tokens.length || tokens[0].used_at_iso !== null) {
    return json({ error: 'invalid_or_used_token' }, { status: 400 });
  }
  const tokenRow = tokens[0];
  if (new Date(tokenRow.expires_at_iso) < new Date()) {
    return json({ error: 'token_expired' }, { status: 400 });
  }

  const { hashPassword: _hashPw } = await import('../../_lib/auth');
  const newHash = await _hashPw(body.newPassword);
  const now = new Date().toISOString();

  await sql`
    UPDATE users
    SET password_hash = ${newHash}, vault_key_blob = NULL, vault_key_salt = NULL
    WHERE id = ${tokenRow.user_id}
  `;
  await sql`
    UPDATE password_reset_tokens SET used_at_iso = ${now} WHERE id = ${body.token}
  `;

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
