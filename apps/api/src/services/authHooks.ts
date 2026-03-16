/**
 * Fastify-specific auth hooks. JWT signing/verification delegates to @kp/core (jose).
 */
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { signToken as coreSignToken, verifyToken } from '@kp/core';

export async function signToken(
  app: FastifyInstance,
  userId: string,
  email: string,
  plan: string = 'free',
) {
  return coreSignToken(app.config.JWT_SECRET, userId, email, plan);
}

export async function requireAuth(request: FastifyRequest, reply: any) {
  try {
    const header = request.headers.authorization ?? null;
    await verifyToken((request.server as any).config.JWT_SECRET, header);
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

export function getUserId(request: FastifyRequest): string {
  // After requireAuth, parse JWT payload without crypto verification (already verified).
  const h = request.headers.authorization ?? '';
  const m = h.match(/^Bearer\s+(.+)$/i);
  if (!m?.[1]) throw new Error('unauthorized');
  const parts = m[1].split('.');
  if (!parts[1]) throw new Error('unauthorized');
  const padded = parts[1].replace(/-/g, '+').replace(/_/g, '/');
  const payload = JSON.parse(Buffer.from(padded, 'base64').toString());
  return String(payload.sub ?? '');
}
