/**
 * Feature 47 — WebAuthn / Passkey endpoints (Hosted / Cloudflare Pages)
 *
 * Routes:
 *   POST /v1/auth/passkey/register-options   — generate challenge for credential creation
 *   POST /v1/auth/passkey/register           — store credential, return JWT
 *   POST /v1/auth/passkey/auth-options       — generate challenge for credential get
 *   POST /v1/auth/passkey/auth               — verify assertion, return JWT + prfSalt + vaultKeyBlob
 *   GET  /v1/auth/passkey/credentials        — list user's passkeys (auth required)
 *   DELETE /v1/auth/passkey/credentials/:id  — remove passkey (auth required)
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { normalizeEmail, newId, requireAuth, signToken } from '../../_lib/auth';

const passkey = new Hono<{ Bindings: Env }>();

// ---------------------------------------------------------------------------
// Helpers: base64url encode/decode
// ---------------------------------------------------------------------------

function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Helpers: Signed challenge tokens (stateless, HMAC-SHA256)
// Challenge token = base64url({ challenge, exp }) + "." + HMAC-SHA256 signature
// ---------------------------------------------------------------------------

async function signChallenge(
  secret: string,
  challengeB64: string,
  exp: number,
): Promise<string> {
  const payload = JSON.stringify({ challenge: challengeB64, exp });
  const payloadB64 = b64urlEncode(new TextEncoder().encode(payload));
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${b64urlEncode(sig)}`;
}

async function verifyChallenge(
  secret: string,
  token: string,
): Promise<{ challengeBytes: Uint8Array } | null> {
  const dot = token.lastIndexOf('.');
  if (dot < 0) return null;
  const payloadB64 = token.slice(0, dot);
  const sigB64 = token.slice(dot + 1);

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    b64urlDecode(sigB64),
    new TextEncoder().encode(payloadB64),
  );
  if (!valid) return null;

  let parsed: { challenge: string; exp: number };
  try {
    parsed = JSON.parse(new TextDecoder().decode(b64urlDecode(payloadB64)));
  } catch {
    return null;
  }
  if (Date.now() > parsed.exp) return null;
  return { challengeBytes: b64urlDecode(parsed.challenge) };
}

// ---------------------------------------------------------------------------
// Minimal CBOR decoder (subset needed for WebAuthn attestationObject / COSE key)
// ---------------------------------------------------------------------------

class CborDecoder {
  private view: DataView;
  private offset: number;

  constructor(buf: ArrayBuffer) {
    this.view = new DataView(buf);
    this.offset = 0;
  }

  decode(): unknown {
    const byte = this.view.getUint8(this.offset++);
    const majorType = (byte >> 5) & 0x7;
    const info = byte & 0x1f;
    const len = this.readLength(info);

    switch (majorType) {
      case 0: return len; // unsigned int
      case 1: return -1 - len; // negative int
      case 2: { // byte string
        const n = Number(len);
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, n);
        this.offset += n;
        return bytes.slice(); // copy
      }
      case 3: { // text string
        const n = Number(len);
        const bytes = new Uint8Array(this.view.buffer, this.view.byteOffset + this.offset, n);
        this.offset += n;
        return new TextDecoder().decode(bytes);
      }
      case 4: { // array
        const n = Number(len);
        const arr: unknown[] = [];
        for (let i = 0; i < n; i++) arr.push(this.decode());
        return arr;
      }
      case 5: { // map
        const n = Number(len);
        const map = new Map<unknown, unknown>();
        for (let i = 0; i < n; i++) {
          const k = this.decode();
          const v = this.decode();
          map.set(k, v);
        }
        return map;
      }
      case 7: { // simple / float
        if (info === 20) return false;
        if (info === 21) return true;
        if (info === 22) return null;
        return undefined;
      }
      default:
        throw new Error(`cbor_unsupported_major_type_${majorType}`);
    }
  }

  private readLength(info: number): bigint {
    if (info <= 23) return BigInt(info);
    if (info === 24) return BigInt(this.view.getUint8(this.offset++));
    if (info === 25) { const v = this.view.getUint16(this.offset); this.offset += 2; return BigInt(v); }
    if (info === 26) { const v = this.view.getUint32(this.offset); this.offset += 4; return BigInt(v); }
    if (info === 27) { const hi = this.view.getUint32(this.offset); const lo = this.view.getUint32(this.offset + 4); this.offset += 8; return (BigInt(hi) << 32n) | BigInt(lo); }
    throw new Error(`cbor_indefinite_or_reserved_${info}`);
  }
}

function cborDecode(buf: ArrayBuffer): unknown {
  return new CborDecoder(buf).decode();
}

// ---------------------------------------------------------------------------
// WebAuthn authData parser
// Returns: { rpIdHash, flags, signCount, credentialId?, coseKey? }
// ---------------------------------------------------------------------------

interface AuthDataInfo {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
  credentialId?: Uint8Array;
  cosePublicKey?: Map<unknown, unknown>;
}

function parseAuthData(authData: Uint8Array): AuthDataInfo {
  let offset = 0;
  const rpIdHash = authData.slice(offset, (offset += 32));
  const flags = authData[offset++]!;
  const signCount =
    (authData[offset]! << 24) |
    (authData[offset + 1]! << 16) |
    (authData[offset + 2]! << 8) |
    authData[offset + 3]!;
  offset += 4;

  const AT_FLAG = 0x40; // attested credential data present
  let credentialId: Uint8Array | undefined;
  let cosePublicKey: Map<unknown, unknown> | undefined;

  if (flags & AT_FLAG) {
    offset += 16; // skip AAGUID
    const credIdLen = (authData[offset]! << 8) | authData[offset + 1]!;
    offset += 2;
    credentialId = authData.slice(offset, (offset += credIdLen));
    const coseBytes = authData.slice(offset).buffer;
    const decoded = cborDecode(coseBytes);
    if (decoded instanceof Map) cosePublicKey = decoded;
  }

  return { rpIdHash, flags, signCount, credentialId, cosePublicKey };
}

// ---------------------------------------------------------------------------
// Extract EC P-256 raw public key (x,y) from COSE map
// COSE keys: 1=kty(2=EC2), 3=alg(-7=ES256), -1=crv(1=P-256), -2=x, -3=y
// ---------------------------------------------------------------------------

function extractP256PublicKey(coseKey: Map<unknown, unknown>): { x: Uint8Array; y: Uint8Array } {
  const x = coseKey.get(-2);
  const y = coseKey.get(-3);
  if (!(x instanceof Uint8Array) || !(y instanceof Uint8Array)) {
    throw new Error('webauthn_invalid_cose_key');
  }
  return { x, y };
}

async function importP256PublicKey(x: Uint8Array, y: Uint8Array): Promise<CryptoKey> {
  // Uncompressed EC point: 0x04 || x || y
  const raw = new Uint8Array(65);
  raw[0] = 0x04;
  raw.set(x, 1);
  raw.set(y, 33);
  return crypto.subtle.importKey(
    'raw',
    raw,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify'],
  );
}

// ---------------------------------------------------------------------------
// Verify ECDSA-SHA256 signature over (authenticatorData || SHA256(clientDataJSON))
// ---------------------------------------------------------------------------

async function verifyAssertion(
  publicKeyB64url: string,
  authenticatorData: Uint8Array,
  clientDataJSON: Uint8Array,
  signatureDer: Uint8Array,
): Promise<boolean> {
  // Reconstruct public key from stored base64url-encoded COSE key
  const coseBytes = b64urlDecode(publicKeyB64url).buffer as ArrayBuffer;
  const coseKey = cborDecode(coseBytes);
  if (!(coseKey instanceof Map)) return false;

  const { x, y } = extractP256PublicKey(coseKey);
  const pubKey = await importP256PublicKey(x, y);

  // Signed data = authenticatorData || SHA256(clientDataJSON)
  const clientDataHash = await crypto.subtle.digest('SHA-256', clientDataJSON);
  const signedData = new Uint8Array(authenticatorData.byteLength + 32);
  signedData.set(authenticatorData, 0);
  signedData.set(new Uint8Array(clientDataHash), authenticatorData.byteLength);

  return crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, pubKey, signatureDer, signedData);
}

// ---------------------------------------------------------------------------
// Helpers: hash & validate
// ---------------------------------------------------------------------------

async function sha256(data: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(data));
}

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const RegisterOptionsSchema = z.object({
  email: z.string().email().optional(),
});

passkey.post('/v1/auth/passkey/register-options', async (c) => {
  const body = RegisterOptionsSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  // If Bearer token provided, look up existing user; otherwise use email for new signup
  let userId: string;
  let email: string;

  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const { requireAuth: _requireAuth } = await import('../../_lib/auth');
      const { userId: uid, email: em } = await _requireAuth(c.env.JWT_SECRET, c.req.raw);
      userId = uid;
      email = em;
    } catch {
      return json({ error: 'unauthorized' }, { status: 401 });
    }
  } else if (body.email) {
    // New user signup with passkey — lookup or will be created on /register
    const normalEmail = normalizeEmail(body.email);
    const rows = await sql<{ id: string; email: string }[]>`
      SELECT id, email FROM users WHERE email = ${normalEmail} LIMIT 1
    `;
    if (rows.length) {
      userId = rows[0].id;
      email = rows[0].email;
    } else {
      // Temporary user ID for the challenge (will create user on /register)
      userId = `new:${normalEmail}`;
      email = normalEmail;
    }
  } else {
    return json({ error: 'email_or_token_required' }, { status: 400 });
  }

  const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
  const challengeB64 = b64urlEncode(challengeBytes);
  const exp = Date.now() + 5 * 60 * 1000; // 5 min
  const challengeToken = await signChallenge(c.env.JWT_SECRET, challengeB64, exp);

  const userIdB64 = b64urlEncode(new TextEncoder().encode(userId));

  return json({
    challengeToken,
    publicKey: {
      challenge: challengeB64,
      rp: { id: 'app.private-ledger.app', name: 'PrivateLedger' },
      user: { id: userIdB64, name: email, displayName: email },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },  // ES256
        { type: 'public-key', alg: -257 }, // RS256 fallback
      ],
      authenticatorSelection: {
        residentKey: 'required',
        requireResidentKey: true,
        userVerification: 'required',
      },
      extensions: { prf: {} },
    },
  });
});

const RegisterSchema = z.object({
  challengeToken: z.string().min(1),
  credentialId: z.string().min(1),
  clientDataJSON: z.string().min(1),
  attestationObject: z.string().min(1),
  prfSalt: z.string().min(1),
  vaultKeyBlob: z.unknown().optional(),
  deviceName: z.string().max(100).optional(),
  email: z.string().email().optional(), // for new user signup
});

passkey.post('/v1/auth/passkey/register', async (c) => {
  const body = RegisterSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  // Verify challenge
  const challengeResult = await verifyChallenge(c.env.JWT_SECRET, body.challengeToken);
  if (!challengeResult) return json({ error: 'invalid_challenge' }, { status: 400 });

  // Decode and verify clientDataJSON
  const clientDataBytes = b64urlDecode(body.clientDataJSON);
  let clientData: { type: string; challenge: string; origin: string };
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  } catch {
    return json({ error: 'invalid_client_data' }, { status: 400 });
  }
  if (clientData.type !== 'webauthn.create') return json({ error: 'wrong_type' }, { status: 400 });

  // Verify challenge matches
  const expectedChallenge = b64urlEncode(challengeResult.challengeBytes);
  if (clientData.challenge !== expectedChallenge) {
    return json({ error: 'challenge_mismatch' }, { status: 400 });
  }

  // Verify origin
  const allowedOrigins = ['https://app.private-ledger.app', 'http://localhost:5173'];
  if (!allowedOrigins.includes(clientData.origin)) {
    return json({ error: 'invalid_origin' }, { status: 400 });
  }

  // Decode attestationObject (CBOR)
  const attObjBytes = b64urlDecode(body.attestationObject);
  const attObj = cborDecode(attObjBytes.buffer as ArrayBuffer);
  if (!(attObj instanceof Map)) return json({ error: 'invalid_attestation_object' }, { status: 400 });

  const authDataRaw = attObj.get('authData');
  if (!(authDataRaw instanceof Uint8Array)) return json({ error: 'missing_auth_data' }, { status: 400 });

  // Parse authData
  const authDataInfo = parseAuthData(authDataRaw);

  // Verify RP ID hash
  const expectedRpIdHash = await sha256('app.private-ledger.app');
  // Also allow localhost for dev
  const localhostRpIdHash = await sha256('localhost');
  const rpIdHashMatch =
    authDataInfo.rpIdHash.every((b, i) => b === new Uint8Array(expectedRpIdHash)[i]) ||
    authDataInfo.rpIdHash.every((b, i) => b === new Uint8Array(localhostRpIdHash)[i]);
  if (!rpIdHashMatch) return json({ error: 'invalid_rp_id' }, { status: 400 });

  // User verification flag must be set
  const UV_FLAG = 0x04;
  if (!(authDataInfo.flags & UV_FLAG)) return json({ error: 'user_verification_required' }, { status: 400 });

  if (!authDataInfo.cosePublicKey) return json({ error: 'missing_cose_key' }, { status: 400 });

  // Store COSE key as base64url
  const coseBytes = b64urlDecode(body.attestationObject); // re-decode fresh
  // We store the full COSE key from authData
  const coseKeyOffset = authDataInfo.credentialId
    ? 55 + authDataInfo.credentialId.byteLength  // 32 (rpIdHash) + 1 (flags) + 4 (signCount) + 16 (AAGUID) + 2 (credIdLen) + credIdLen
    : 0;
  const authDataSlice = authDataRaw.slice(coseKeyOffset);
  const publicKeyB64 = b64urlEncode(authDataSlice);

  // Determine user
  const sql2 = getSql(c.env);
  let userId: string;
  let userEmail: string;

  const authHeader = c.req.header('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const { requireAuth: _ra } = await import('../../_lib/auth');
    const { userId: uid, email: em } = await _ra(c.env.JWT_SECRET, c.req.raw);
    userId = uid;
    userEmail = em;
  } else if (body.email) {
    const normalEmail = normalizeEmail(body.email);
    const existing = await sql2<{ id: string; email: string }[]>`
      SELECT id, email FROM users WHERE email = ${normalEmail} LIMIT 1
    `;
    if (existing.length) {
      userId = existing[0].id;
      userEmail = existing[0].email;
    } else {
      // Create new user (passkey-only, no password)
      userId = newId('usr');
      userEmail = normalEmail;
      const createdAtISO = new Date().toISOString();
      await sql2`
        INSERT INTO users (id, email, password_hash, created_at_iso)
        VALUES (${userId}, ${userEmail}, NULL, ${createdAtISO})
      `;
    }
  } else {
    return json({ error: 'email_or_token_required' }, { status: 400 });
  }

  // Store credential
  const credentialId = body.credentialId;
  const createdAtISO = new Date().toISOString();

  await sql2`
    INSERT INTO webauthn_credentials (id, user_id, public_key, sign_count, prf_salt, vault_key_blob, device_name, created_at_iso)
    VALUES (
      ${credentialId},
      ${userId},
      ${publicKeyB64},
      ${authDataInfo.signCount},
      ${body.prfSalt},
      ${body.vaultKeyBlob ? JSON.stringify(body.vaultKeyBlob) : null},
      ${body.deviceName ?? null},
      ${createdAtISO}
    )
    ON CONFLICT (id) DO UPDATE SET
      sign_count = EXCLUDED.sign_count,
      vault_key_blob = EXCLUDED.vault_key_blob,
      device_name = COALESCE(EXCLUDED.device_name, webauthn_credentials.device_name)
  `;

  const rows = await sql2<{ plan: string; plan_expires_at: string | null }[]>`
    SELECT plan, plan_expires_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  const plan = rows[0]?.plan ?? 'free';
  const token = await signToken(c.env.JWT_SECRET, userId, userEmail, plan);

  return json({
    user: { id: userId, email: userEmail, createdAtISO },
    token,
    plan,
    planExpiresAt: rows[0]?.plan_expires_at ?? null,
    credentialId,
    deviceName: body.deviceName ?? null,
  });
});

const AuthOptionsSchema = z.object({
  email: z.string().email().optional(),
});

passkey.post('/v1/auth/passkey/auth-options', async (c) => {
  const body = AuthOptionsSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  const challengeBytes = crypto.getRandomValues(new Uint8Array(32));
  const challengeB64 = b64urlEncode(challengeBytes);
  const exp = Date.now() + 5 * 60 * 1000;
  const challengeToken = await signChallenge(c.env.JWT_SECRET, challengeB64, exp);

  let allowCredentials: Array<{ type: string; id: string }> = [];
  let prfEval: { first: string } | undefined;

  if (body.email) {
    const normalEmail = normalizeEmail(body.email);
    const creds = await sql<{ id: string; prf_salt: string }[]>`
      SELECT wc.id, wc.prf_salt
      FROM webauthn_credentials wc
      JOIN users u ON u.id = wc.user_id
      WHERE u.email = ${normalEmail}
      LIMIT 10
    `;
    allowCredentials = creds.map((c) => ({ type: 'public-key', id: c.id }));
    // For single-credential flow: include prfSalt so only one gesture is needed
    if (creds.length === 1) {
      prfEval = { first: creds[0]!.prf_salt };
    }
  }

  return json({
    challengeToken,
    publicKey: {
      challenge: challengeB64,
      rpId: 'app.private-ledger.app',
      allowCredentials,
      userVerification: 'required',
      extensions: prfEval ? { prf: { eval: prfEval } } : { prf: {} },
    },
  });
});

const AuthSchema = z.object({
  challengeToken: z.string().min(1),
  credentialId: z.string().min(1),
  authenticatorData: z.string().min(1),
  clientDataJSON: z.string().min(1),
  signature: z.string().min(1),
  userHandle: z.string().nullable().optional(),
});

passkey.post('/v1/auth/passkey/auth', async (c) => {
  const body = AuthSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  // Verify challenge
  const challengeResult = await verifyChallenge(c.env.JWT_SECRET, body.challengeToken);
  if (!challengeResult) return json({ error: 'invalid_challenge' }, { status: 400 });

  // Decode clientDataJSON
  const clientDataBytes = b64urlDecode(body.clientDataJSON);
  let clientData: { type: string; challenge: string; origin: string };
  try {
    clientData = JSON.parse(new TextDecoder().decode(clientDataBytes));
  } catch {
    return json({ error: 'invalid_client_data' }, { status: 400 });
  }
  if (clientData.type !== 'webauthn.get') return json({ error: 'wrong_type' }, { status: 400 });

  const expectedChallenge = b64urlEncode(challengeResult.challengeBytes);
  if (clientData.challenge !== expectedChallenge) return json({ error: 'challenge_mismatch' }, { status: 400 });

  const allowedOrigins = ['https://app.private-ledger.app', 'http://localhost:5173'];
  if (!allowedOrigins.includes(clientData.origin)) return json({ error: 'invalid_origin' }, { status: 400 });

  // Look up credential
  const creds = await sql<{
    id: string;
    user_id: string;
    public_key: string;
    sign_count: number;
    prf_salt: string;
    vault_key_blob: string | null;
  }[]>`
    SELECT id, user_id, public_key, sign_count, prf_salt, vault_key_blob
    FROM webauthn_credentials
    WHERE id = ${body.credentialId}
    LIMIT 1
  `;
  if (!creds.length) return json({ error: 'credential_not_found' }, { status: 401 });
  const cred = creds[0]!;

  // Verify RP ID hash in authenticatorData
  const authDataBytes = b64urlDecode(body.authenticatorData);
  const rpIdHash = authDataBytes.slice(0, 32);
  const expectedRpIdHash = await sha256('app.private-ledger.app');
  const localhostRpIdHash = await sha256('localhost');
  const rpIdHashMatch =
    rpIdHash.every((b, i) => b === new Uint8Array(expectedRpIdHash)[i]) ||
    rpIdHash.every((b, i) => b === new Uint8Array(localhostRpIdHash)[i]);
  if (!rpIdHashMatch) return json({ error: 'invalid_rp_id' }, { status: 400 });

  // Verify user verification flag
  const UV_FLAG = 0x04;
  if (!(authDataBytes[32]! & UV_FLAG)) return json({ error: 'user_verification_required' }, { status: 400 });

  // Verify signature
  const signatureBytes = b64urlDecode(body.signature);
  const valid = await verifyAssertion(
    cred.public_key,
    authDataBytes,
    clientDataBytes,
    signatureBytes,
  );
  if (!valid) return json({ error: 'invalid_signature' }, { status: 401 });

  // Replay protection: sign_count must increase (or stay 0 for sync'd passkeys)
  const authDataSignCount =
    (authDataBytes[33]! << 24) |
    (authDataBytes[34]! << 16) |
    (authDataBytes[35]! << 8) |
    authDataBytes[36]!;

  if (cred.sign_count > 0 && authDataSignCount !== 0 && authDataSignCount <= cred.sign_count) {
    return json({ error: 'sign_count_replay' }, { status: 401 });
  }

  // Update sign count
  await sql`
    UPDATE webauthn_credentials SET sign_count = ${authDataSignCount} WHERE id = ${body.credentialId}
  `;

  // Look up user
  const users = await sql<{
    id: string;
    email: string;
    created_at_iso: string;
    plan: string;
    plan_expires_at: string | null;
  }[]>`
    SELECT id, email, created_at_iso, plan, plan_expires_at FROM users WHERE id = ${cred.user_id} LIMIT 1
  `;
  if (!users.length) return json({ error: 'user_not_found' }, { status: 401 });
  const user = users[0]!;

  const token = await signToken(c.env.JWT_SECRET, user.id, user.email, user.plan ?? 'free');

  return json({
    user: { id: user.id, email: user.email, createdAtISO: user.created_at_iso },
    token,
    plan: user.plan ?? 'free',
    planExpiresAt: user.plan_expires_at ?? null,
    prfSalt: cred.prf_salt,
    vaultKeyBlob: cred.vault_key_blob ? JSON.parse(cred.vault_key_blob) : null,
  });
});

passkey.get('/v1/auth/passkey/credentials', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);

  const creds = await sql<{ id: string; device_name: string | null; created_at_iso: string }[]>`
    SELECT id, device_name, created_at_iso FROM webauthn_credentials WHERE user_id = ${userId} ORDER BY created_at_iso ASC
  `;
  return json({ credentials: creds });
});

passkey.delete('/v1/auth/passkey/credentials/:credentialId', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const credentialId = c.req.param('credentialId');
  const sql = getSql(c.env);

  // Check this credential belongs to the user
  const creds = await sql<{ id: string }[]>`
    SELECT id FROM webauthn_credentials WHERE id = ${credentialId} AND user_id = ${userId} LIMIT 1
  `;
  if (!creds.length) return json({ error: 'not_found' }, { status: 404 });

  // Ensure at least one auth method remains
  const user = await sql<{
    password_hash: string | null;
    google_sub: string | null;
    passkey_count: string;
  }[]>`
    SELECT u.password_hash, u.google_sub,
      (SELECT COUNT(*) FROM webauthn_credentials WHERE user_id = ${userId}) AS passkey_count
    FROM users u WHERE u.id = ${userId} LIMIT 1
  `;
  const row = user[0];
  if (!row) return json({ error: 'unauthorized' }, { status: 401 });

  const remainingPasskeys = Number(row.passkey_count) - 1;
  const hasOtherAuth = row.password_hash !== null || row.google_sub !== null || remainingPasskeys > 0;
  if (!hasOtherAuth) {
    return json({ error: 'cannot_remove_last_auth_method' }, { status: 400 });
  }

  await sql`DELETE FROM webauthn_credentials WHERE id = ${credentialId} AND user_id = ${userId}`;
  return json({ ok: true });
});

export { passkey };
