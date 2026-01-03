import { SignJWT, jwtVerify } from 'jose';

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function newId(prefix?: string) {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pbkdf2Sha256(password: string, salt: Uint8Array, iterations: number, length = 32) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations },
    key,
    length * 8
  );
  return new Uint8Array(bits);
}
const MAX_PBKDF2_ITERATIONS = 100_000;

// Stored format: pbkdf2_sha256$<iterations>$<saltBase64>$<hashBase64>
export async function hashPassword(password: string, iterations = MAX_PBKDF2_ITERATIONS) {
  const iters = Math.min(iterations, MAX_PBKDF2_ITERATIONS);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Sha256(password, salt, iters);
  return `pbkdf2_sha256$${iters}$${b64(salt.buffer)}$${b64(hash.buffer)}`;
}

export async function verifyPassword(password: string, stored: string) {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;

  // If DB contains legacy hashes with >100k iterations, we can't verify them with Cloudflare WebCrypto PBKDF2.
  if (iterations > MAX_PBKDF2_ITERATIONS) {
    throw new Error(
      `pbkdf2_iterations_unsupported:${iterations}:max:${MAX_PBKDF2_ITERATIONS} (recreate user or reset password)`
    );
  }

  const salt = unb64(parts[2]);
  const expected = unb64(parts[3]);
  const got = await pbkdf2Sha256(password, salt, iterations);

  if (got.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < got.length; i++) ok |= got[i] ^ expected[i];
  return ok === 0;
}


async function jwtSecretKey(secret: string) {
  return crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify'
  ]);
}

export async function signToken(secret: string, userId: string, email: string) {
  const key = await jwtSecretKey(secret);
  return new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);
}

export async function requireAuth(secret: string, req: Request): Promise<{ userId: string; email?: string }> {
  const h = req.headers.get('authorization') ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new Error('unauthorized');
  const token = m[1];
  const key = await jwtSecretKey(secret);
  const { payload } = await jwtVerify(token, key);
  const userId = String(payload.sub ?? '');
  if (!userId) throw new Error('unauthorized');
  return { userId, email: typeof payload.email === 'string' ? payload.email : undefined };
}

export { b64url };
