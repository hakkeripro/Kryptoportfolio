/**
 * Shared authentication crypto: PBKDF2 password hashing + email normalization.
 * Works in both Node.js (18+) and Cloudflare Workers (WebCrypto).
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function newId(prefix?: string): string {
  const id = crypto.randomUUID();
  return prefix ? `${prefix}_${id}` : id;
}

// ---------- Base64 helpers (no Buffer dependency for CF Workers) ----------

function b64Encode(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function b64Decode(s: string): Uint8Array {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

// ---------- PBKDF2-SHA256 ----------

const DEFAULT_ITERATIONS = 100_000;
const MAX_ITERATIONS = 100_000;

async function pbkdf2Sha256(
  password: string,
  salt: Uint8Array,
  iterations: number,
  length = 32,
): Promise<Uint8Array> {
  const enc = new TextEncoder().encode(password);
  const key = await crypto.subtle.importKey(
    'raw',
    enc.buffer as ArrayBuffer,
    { name: 'PBKDF2' },
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt.buffer as ArrayBuffer, iterations },
    key,
    length * 8,
  );
  return new Uint8Array(bits);
}

/**
 * Hash a password using PBKDF2-SHA256.
 * Stored format: `pbkdf2_sha256$<iterations>$<saltBase64>$<hashBase64>`
 */
export async function hashPassword(
  password: string,
  iterations = DEFAULT_ITERATIONS,
): Promise<string> {
  const iters = Math.min(iterations, MAX_ITERATIONS);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2Sha256(password, salt, iters);
  return `pbkdf2_sha256$${iters}$${b64Encode(salt)}$${b64Encode(hash)}`;
}

/**
 * Verify a password against a stored PBKDF2-SHA256 hash.
 * Uses constant-time comparison to prevent timing attacks.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2_sha256') return false;

  const iterations = Number(parts[1]);
  if (!Number.isFinite(iterations) || iterations <= 0) return false;
  if (iterations > MAX_ITERATIONS) {
    throw new Error(
      `pbkdf2_iterations_unsupported:${iterations}:max:${MAX_ITERATIONS} (recreate user or reset password)`,
    );
  }

  const saltStr = parts[2];
  const expectedStr = parts[3];
  if (!saltStr || !expectedStr) return false;

  const salt = b64Decode(saltStr);
  const expected = b64Decode(expectedStr);
  const got = await pbkdf2Sha256(password, salt, iterations);

  if (got.length !== expected.length) return false;
  let ok = 0;
  for (let i = 0; i < got.length; i++) ok |= (got[i] ?? 0) ^ (expected[i] ?? 0);
  return ok === 0;
}

/**
 * Change password: verify current password, hash new one.
 * Returns the new hash on success, or null if current password is wrong.
 */
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  storedHash: string,
): Promise<string | null> {
  const valid = await verifyPassword(currentPassword, storedHash);
  if (!valid) return null;
  return hashPassword(newPassword);
}
