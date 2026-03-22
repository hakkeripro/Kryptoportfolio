/**
 * Feature 47 — WebAuthn / Passkey mock routes (Local dev / Fastify)
 *
 * This is a simplified mock for E2E testing. It does NOT perform real WebAuthn
 * cryptographic verification — it accepts any well-formed request.
 *
 * Routes mirror the hosted API surface exactly.
 */

import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { newId, normalizeEmail, hashPassword } from '../services/auth.js';
import { signToken, requireAuth, getUserId } from '../services/authHooks.js';

// In-memory challenge store for E2E tests (keyed by challenge token)
const pendingChallenges = new Map<string, { exp: number }>();

function randomHex(n: number): string {
  const arr = new Uint8Array(n);
  crypto.getRandomValues(arr);
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function registerPasskeyRoutes(app: FastifyInstance) {
  // POST /v1/auth/passkey/register-options
  const RegisterOptionsSchema = z.object({
    email: z.string().email().optional(),
  });

  app.post('/v1/auth/passkey/register-options', async (req, reply) => {
    const body = RegisterOptionsSchema.parse(req.body);

    let userId: string;
    let email: string;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        requireAuth(req, reply);
        userId = getUserId(req);
        const u = app.db.getOne<{ email: string }>('SELECT email FROM users WHERE id=?', [userId]);
        email = u?.email ?? '';
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    } else if (body.email) {
      const normalEmail = normalizeEmail(body.email);
      const u = app.db.getOne<{ id: string; email: string }>(
        'SELECT id,email FROM users WHERE email=?',
        [normalEmail],
      );
      userId = u?.id ?? `new:${normalEmail}`;
      email = normalEmail;
    } else {
      return reply.code(400).send({ error: 'email_or_token_required' });
    }

    const challengeToken = randomHex(32);
    pendingChallenges.set(challengeToken, { exp: Date.now() + 5 * 60 * 1000 });

    return reply.send({
      challengeToken,
      publicKey: {
        challenge: b64urlEncode(new TextEncoder().encode(challengeToken)),
        rp: { id: 'localhost', name: 'VaultFolio' },
        user: {
          id: b64urlEncode(new TextEncoder().encode(userId)),
          name: email,
          displayName: email,
        },
        pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
        authenticatorSelection: {
          residentKey: 'required',
          requireResidentKey: true,
          userVerification: 'required',
        },
        extensions: { prf: {} },
      },
    });
  });

  // POST /v1/auth/passkey/register
  const RegisterSchema = z.object({
    challengeToken: z.string().min(1),
    credentialId: z.string().min(1),
    clientDataJSON: z.string().min(1).optional(),
    attestationObject: z.string().min(1).optional(),
    prfSalt: z.string().min(1),
    vaultKeyBlob: z.unknown().optional(),
    deviceName: z.string().max(100).optional(),
    email: z.string().email().optional(),
  });

  app.post('/v1/auth/passkey/register', async (req, reply) => {
    const body = RegisterSchema.parse(req.body);

    // Verify challenge (mock: just check it exists and not expired)
    const entry = pendingChallenges.get(body.challengeToken);
    if (!entry || Date.now() > entry.exp) {
      return reply.code(400).send({ error: 'invalid_challenge' });
    }
    pendingChallenges.delete(body.challengeToken);

    let userId: string;
    let userEmail: string;

    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        requireAuth(req, reply);
        userId = getUserId(req);
        const u = app.db.getOne<{ email: string }>('SELECT email FROM users WHERE id=?', [userId]);
        userEmail = u?.email ?? '';
      } catch {
        return reply.code(401).send({ error: 'unauthorized' });
      }
    } else if (body.email) {
      const normalEmail = normalizeEmail(body.email);
      const existing = app.db.getOne<{ id: string; email: string }>(
        'SELECT id,email FROM users WHERE email=?',
        [normalEmail],
      );
      if (existing) {
        userId = existing.id;
        userEmail = existing.email;
      } else {
        userId = newId('usr');
        userEmail = normalEmail;
        const createdAtISO = new Date().toISOString();
        app.db.exec('INSERT INTO users(id,email,createdAtISO) VALUES (?,?,?)', [
          userId,
          userEmail,
          createdAtISO,
        ]);
      }
    } else {
      return reply.code(400).send({ error: 'email_or_token_required' });
    }

    // Use a mock public key (actual ECDSA key is not verified in local dev)
    const mockPublicKey = b64urlEncode(
      new TextEncoder().encode(`mock-pubkey-${body.credentialId}`),
    );
    const createdAtISO = new Date().toISOString();

    // Insert or update credential
    const existing = app.db.getOne<{ id: string }>(
      'SELECT id FROM webauthn_credentials WHERE id=?',
      [body.credentialId],
    );
    if (existing) {
      app.db.exec('UPDATE webauthn_credentials SET vaultKeyBlob=?,deviceName=? WHERE id=?', [
        body.vaultKeyBlob ? JSON.stringify(body.vaultKeyBlob) : null,
        body.deviceName ?? null,
        body.credentialId,
      ]);
    } else {
      app.db.exec(
        'INSERT INTO webauthn_credentials(id,userId,publicKey,signCount,prfSalt,vaultKeyBlob,deviceName,createdAtISO) VALUES (?,?,?,?,?,?,?,?)',
        [
          body.credentialId,
          userId,
          mockPublicKey,
          0,
          body.prfSalt,
          body.vaultKeyBlob ? JSON.stringify(body.vaultKeyBlob) : null,
          body.deviceName ?? null,
          createdAtISO,
        ],
      );
    }

    const u = app.db.getOne<{ plan: string | null }>('SELECT plan FROM users WHERE id=?', [userId]);
    const plan = u?.plan ?? 'free';
    const token = await signToken(app, userId, userEmail, plan);

    return reply.send({
      user: { id: userId, email: userEmail, createdAtISO },
      token,
      plan,
      planExpiresAt: null,
      credentialId: body.credentialId,
      deviceName: body.deviceName ?? null,
    });
  });

  // POST /v1/auth/passkey/auth-options
  const AuthOptionsSchema = z.object({
    email: z.string().email().optional(),
  });

  app.post('/v1/auth/passkey/auth-options', async (req, reply) => {
    const body = AuthOptionsSchema.parse(req.body);

    const challengeToken = randomHex(32);
    pendingChallenges.set(challengeToken, { exp: Date.now() + 5 * 60 * 1000 });

    let allowCredentials: Array<{ type: string; id: string }> = [];
    let prfEval: { first: string } | undefined;

    if (body.email) {
      const normalEmail = normalizeEmail(body.email);
      const creds = app.db.query<{ id: string; prfSalt: string }>(
        'SELECT wc.id, wc.prfSalt FROM webauthn_credentials wc JOIN users u ON u.id=wc.userId WHERE u.email=? LIMIT 10',
        [normalEmail],
      );
      allowCredentials = creds.map((c) => ({ type: 'public-key', id: c.id }));
      if (creds.length === 1) prfEval = { first: creds[0]!.prfSalt };
    }

    return reply.send({
      challengeToken,
      publicKey: {
        challenge: b64urlEncode(new TextEncoder().encode(challengeToken)),
        rpId: 'localhost',
        allowCredentials,
        userVerification: 'required',
        extensions: prfEval ? { prf: { eval: prfEval } } : { prf: {} },
      },
    });
  });

  // POST /v1/auth/passkey/auth
  const AuthSchema = z.object({
    challengeToken: z.string().min(1),
    credentialId: z.string().min(1),
    authenticatorData: z.string().optional(),
    clientDataJSON: z.string().optional(),
    signature: z.string().optional(),
    userHandle: z.string().optional(),
  });

  app.post('/v1/auth/passkey/auth', async (req, reply) => {
    const body = AuthSchema.parse(req.body);

    // Verify challenge
    const entry = pendingChallenges.get(body.challengeToken);
    if (!entry || Date.now() > entry.exp) {
      return reply.code(400).send({ error: 'invalid_challenge' });
    }
    pendingChallenges.delete(body.challengeToken);

    const cred = app.db.getOne<{
      id: string;
      userId: string;
      prfSalt: string;
      vaultKeyBlob: string | null;
      signCount: number;
    }>('SELECT id,userId,prfSalt,vaultKeyBlob,signCount FROM webauthn_credentials WHERE id=?', [
      body.credentialId,
    ]);

    if (!cred) return reply.code(401).send({ error: 'credential_not_found' });

    // Update sign count (mock: just increment)
    app.db.exec('UPDATE webauthn_credentials SET signCount=signCount+1 WHERE id=?', [
      body.credentialId,
    ]);

    const user = app.db.getOne<{
      id: string;
      email: string;
      createdAtISO: string;
      plan: string | null;
      planExpiresAt: string | null;
    }>('SELECT id,email,createdAtISO,plan,planExpiresAt FROM users WHERE id=?', [cred.userId]);

    if (!user) return reply.code(401).send({ error: 'user_not_found' });

    const plan = user.plan ?? 'free';
    const token = await signToken(app, user.id, user.email, plan);

    return reply.send({
      user: { id: user.id, email: user.email, createdAtISO: user.createdAtISO },
      token,
      plan,
      planExpiresAt: user.planExpiresAt ?? null,
      prfSalt: cred.prfSalt,
      vaultKeyBlob: cred.vaultKeyBlob ? JSON.parse(cred.vaultKeyBlob) : null,
    });
  });

  // GET /v1/auth/passkey/credentials
  app.get('/v1/auth/passkey/credentials', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const creds = app.db.query<{ id: string; deviceName: string | null; createdAtISO: string }>(
      'SELECT id,deviceName,createdAtISO FROM webauthn_credentials WHERE userId=? ORDER BY createdAtISO ASC',
      [userId],
    );
    return reply.send({
      credentials: creds.map((c) => ({
        id: c.id,
        device_name: c.deviceName,
        created_at_iso: c.createdAtISO,
      })),
    });
  });

  // DELETE /v1/auth/passkey/credentials/:credentialId
  app.delete(
    '/v1/auth/passkey/credentials/:credentialId',
    { preHandler: requireAuth },
    async (req, reply) => {
      const userId = getUserId(req);
      const { credentialId } = req.params as { credentialId: string };

      const cred = app.db.getOne<{ id: string }>(
        'SELECT id FROM webauthn_credentials WHERE id=? AND userId=?',
        [credentialId, userId],
      );
      if (!cred) return reply.code(404).send({ error: 'not_found' });

      // Check at least one auth method remains
      const user = app.db.getOne<{ passwordHash: string | null; googleSub: string | null }>(
        'SELECT passwordHash,googleSub FROM users WHERE id=?',
        [userId],
      );
      const passkeyCount = app.db.query<{ id: string }>(
        'SELECT id FROM webauthn_credentials WHERE userId=?',
        [userId],
      ).length;
      const remainingPasskeys = passkeyCount - 1;
      const hasOtherAuth =
        (user?.passwordHash ?? null) !== null ||
        (user?.googleSub ?? null) !== null ||
        remainingPasskeys > 0;
      if (!hasOtherAuth) {
        return reply.code(400).send({ error: 'cannot_remove_last_auth_method' });
      }

      app.db.exec('DELETE FROM webauthn_credentials WHERE id=? AND userId=?', [
        credentialId,
        userId,
      ]);
      return reply.send({ ok: true });
    },
  );
}
