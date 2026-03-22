import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
  newId,
  changePassword,
} from '../services/auth.js';
import { signToken, requireAuth, getUserId } from '../services/authHooks.js';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const LoginSchema = RegisterSchema;

export function registerAuthRoutes(app: FastifyInstance) {
  app.post('/v1/auth/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const existing = app.db.getOne<{ id: string }>('SELECT id FROM users WHERE email=?', [email]);
    if (existing) return reply.code(409).send({ error: 'email_taken' });

    const userId = newId('usr');
    const passwordHash = await hashPassword(body.password);
    const createdAtISO = new Date().toISOString();

    app.db.exec('INSERT INTO users(id,email,passwordHash,createdAtISO) VALUES (?,?,?,?)', [
      userId,
      email,
      passwordHash,
      createdAtISO,
    ]);

    const token = await signToken(app, userId, email, 'free');
    return reply.send({ user: { id: userId, email, createdAtISO }, token });
  });

  app.post('/v1/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = app.db.getOne<{
      id: string;
      passwordHash: string;
      createdAtISO: string;
      plan: string | null;
      planExpiresAt: string | null;
    }>('SELECT id,passwordHash,createdAtISO,plan,planExpiresAt FROM users WHERE email=?', [email]);
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    const plan = user.plan ?? 'free';
    const token = await signToken(app, user.id, email, plan);
    return reply.send({
      user: { id: user.id, email, createdAtISO: user.createdAtISO },
      token,
      plan,
      planExpiresAt: user.planExpiresAt ?? null,
    });
  });

  const ChangePasswordSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(8).max(128),
  });

  app.put('/v1/auth/password', { preHandler: requireAuth }, async (req, reply) => {
    const body = ChangePasswordSchema.parse(req.body);
    const userId = getUserId(req);

    const user = app.db.getOne<{ passwordHash: string }>(
      'SELECT passwordHash FROM users WHERE id=?',
      [userId],
    );
    if (!user) return reply.code(401).send({ error: 'unauthorized' });

    const newHash = await changePassword(body.currentPassword, body.newPassword, user.passwordHash);
    if (!newHash) return reply.code(401).send({ error: 'wrong_password' });

    app.db.exec('UPDATE users SET passwordHash=? WHERE id=?', [newHash, userId]);
    return reply.send({ ok: true });
  });

  // Mock endpoint for E2E tests (no real Google connection)
  // Accepts any code — uses email from 'mock-google-email' header or defaults to mock@google.test
  app.post('/v1/auth/oauth/google', async (req, reply) => {
    const body = req.body as { code?: string; codeVerifier?: string; redirectUri?: string };
    if (!body.code || !body.codeVerifier || !body.redirectUri) {
      return reply.code(400).send({ error: 'missing_params' });
    }
    const mockEmail =
      (req.headers['x-mock-google-email'] as string | undefined) ?? 'mock@google.test';
    const googleSub = `google-sub-${mockEmail.replace(/[^a-z0-9]/g, '-')}`;
    const email = mockEmail.toLowerCase().trim();

    let user = app.db.getOne<{
      id: string;
      createdAtISO: string;
      plan: string | null;
      googleSub: string | null;
    }>('SELECT id,createdAtISO,plan,googleSub FROM users WHERE googleSub=?', [googleSub]);
    if (!user) {
      const existingByEmail = app.db.getOne<{ id: string; googleSub: string | null }>(
        'SELECT id,googleSub FROM users WHERE email=?',
        [email],
      );
      if (existingByEmail && !existingByEmail.googleSub) {
        return reply.code(409).send({ error: 'email_taken_password' });
      }
      const userId = newId('usr');
      const createdAtISO = new Date().toISOString();
      app.db.exec('INSERT INTO users(id,email,googleSub,createdAtISO) VALUES (?,?,?,?)', [
        userId,
        email,
        googleSub,
        createdAtISO,
      ]);
      user = { id: userId, createdAtISO, plan: 'free', googleSub };
    }
    const plan = user.plan ?? 'free';
    const token = await signToken(app, user.id, email, plan);
    return reply.send({
      user: { id: user.id, email, createdAtISO: user.createdAtISO },
      token,
      plan,
      planExpiresAt: null,
    });
  });

  // Feature 47: Password reset (mock — token returned in response for E2E testing)
  const PasswordResetRequestSchema = z.object({ email: z.string().email() });

  app.post('/v1/auth/password-reset/request', async (req, reply) => {
    const body = PasswordResetRequestSchema.parse(req.body);
    const email = normalizeEmail(body.email);

    const user = app.db.getOne<{ id: string; passwordHash: string | null }>(
      'SELECT id,passwordHash FROM users WHERE email=?',
      [email],
    );

    if (user && user.passwordHash !== null) {
      const token = Array.from(crypto.getRandomValues(new Uint8Array(32)))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      const expiresAtISO = new Date(Date.now() + 60 * 60 * 1000).toISOString();
      app.db.exec('INSERT INTO password_reset_tokens(id,userId,expiresAtISO) VALUES (?,?,?)', [
        token,
        user.id,
        expiresAtISO,
      ]);
      // In test/dev mode: return the token directly (no email sent)
      return reply.send({ ok: true, _testToken: token });
    }

    return reply.send({ ok: true });
  });

  const PasswordResetConfirmSchema = z.object({
    token: z.string().min(64).max(64),
    newPassword: z.string().min(8).max(128),
  });

  app.post('/v1/auth/password-reset/confirm', async (req, reply) => {
    const body = PasswordResetConfirmSchema.parse(req.body);

    const tokenRow = app.db.getOne<{
      id: string;
      userId: string;
      expiresAtISO: string;
      usedAtISO: string | null;
    }>('SELECT id,userId,expiresAtISO,usedAtISO FROM password_reset_tokens WHERE id=?', [
      body.token,
    ]);

    if (!tokenRow || tokenRow.usedAtISO !== null) {
      return reply.code(400).send({ error: 'invalid_or_used_token' });
    }
    if (new Date(tokenRow.expiresAtISO) < new Date()) {
      return reply.code(400).send({ error: 'token_expired' });
    }

    const newHash = await hashPassword(body.newPassword);
    const now = new Date().toISOString();

    app.db.exec('UPDATE users SET passwordHash=?,vaultKeyBlob=NULL,vaultKeySalt=NULL WHERE id=?', [
      newHash,
      tokenRow.userId,
    ]);
    app.db.exec('UPDATE password_reset_tokens SET usedAtISO=? WHERE id=?', [now, body.token]);

    return reply.send({ ok: true });
  });

  app.get('/v1/auth/config', async (_req, reply) => {
    return reply.send({ googleClientId: process.env.GOOGLE_CLIENT_ID ?? null });
  });

  app.get('/v1/me', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const user = app.db.getOne<{ id: string; email: string; createdAtISO: string }>(
      'SELECT id,email,createdAtISO FROM users WHERE id=?',
      [userId],
    );
    return { user };
  });
}
