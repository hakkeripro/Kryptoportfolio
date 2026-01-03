import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { hashPassword, normalizeEmail, verifyPassword, newId } from '../services/auth.js';
import { signToken, requireAuth, getUserId } from '../services/authHooks.js';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128)
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
      createdAtISO
    ]);

    const token = await signToken(app, userId, email);
    return reply.send({ user: { id: userId, email, createdAtISO }, token });
  });

  app.post('/v1/auth/login', async (req, reply) => {
    const body = LoginSchema.parse(req.body);
    const email = normalizeEmail(body.email);
    const user = app.db.getOne<{ id: string; passwordHash: string; createdAtISO: string }>(
      'SELECT id,passwordHash,createdAtISO FROM users WHERE email=?',
      [email]
    );
    if (!user) return reply.code(401).send({ error: 'invalid_credentials' });

    const ok = await verifyPassword(body.password, user.passwordHash);
    if (!ok) return reply.code(401).send({ error: 'invalid_credentials' });

    const token = await signToken(app, user.id, email);
    return reply.send({ user: { id: user.id, email, createdAtISO: user.createdAtISO }, token });
  });

  app.get('/v1/me', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const user = app.db.getOne<{ id: string; email: string; createdAtISO: string }>(
      'SELECT id,email,createdAtISO FROM users WHERE id=?',
      [userId]
    );
    return { user };
  });
}
