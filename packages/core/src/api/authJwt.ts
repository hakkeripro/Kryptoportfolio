/**
 * Shared JWT signing and verification using jose (works in Node.js + CF Workers).
 */
import { SignJWT, jwtVerify } from 'jose';

async function jwtSecretKey(secret: string) {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

/**
 * Sign a JWT with HS256 containing `sub` (userId), `email`, and `plan` claims.
 * Expires in 30 days.
 */
export async function signToken(
  secret: string,
  userId: string,
  email: string,
  plan: string = 'free',
): Promise<string> {
  const key = await jwtSecretKey(secret);
  return new SignJWT({ email, plan })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(key);
}

export interface AuthPayload {
  userId: string;
  email?: string;
  plan?: string;
}

/**
 * Verify a Bearer JWT from the Authorization header.
 * Throws if the token is missing, invalid, or expired.
 */
export async function verifyToken(
  secret: string,
  authorizationHeader: string | null,
): Promise<AuthPayload> {
  const h = authorizationHeader ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m || !m[1]) throw new Error('unauthorized');
  const token = m[1];
  const key = await jwtSecretKey(secret);
  const { payload } = await jwtVerify(token, key);
  const userId = String(payload.sub ?? '');
  if (!userId) throw new Error('unauthorized');
  return {
    userId,
    email: typeof payload.email === 'string' ? payload.email : undefined,
    plan: typeof payload.plan === 'string' ? payload.plan : 'free',
  };
}

/**
 * Extract auth payload from a standard Request object (Hono, generic fetch).
 */
export async function requireAuth(secret: string, req: Request): Promise<AuthPayload> {
  return verifyToken(secret, req.headers.get('authorization'));
}
