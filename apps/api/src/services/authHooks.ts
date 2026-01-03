import type { FastifyInstance, FastifyRequest } from 'fastify';

export async function requireAuth(request: FastifyRequest, reply: any) {
  try {
    await request.jwtVerify();
  } catch {
    reply.code(401).send({ error: 'unauthorized' });
  }
}

export function getUserId(request: FastifyRequest) {
  const u = request.user as any;
  return u.sub as string;
}

export async function signToken(app: FastifyInstance, userId: string, email: string) {
  return app.jwt.sign({ sub: userId, email }, { expiresIn: '30d' });
}
