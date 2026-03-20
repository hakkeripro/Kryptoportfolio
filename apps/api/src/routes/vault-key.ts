import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../services/authHooks.js';

// Mirrors VaultBlobSchema from @kp/platform-web (inline to avoid browser-only import)
const VaultBlobSchema = z.object({
  version: z.number().int().positive(),
  kdf: z.object({ saltBase64: z.string(), iterations: z.number().int().positive() }),
  nonceBase64: z.string(),
  ciphertextBase64: z.string(),
});

const PutVaultKeySchema = z.object({
  blob: VaultBlobSchema,
  salt: z.string().min(1),
});

export function registerVaultKeyRoutes(app: FastifyInstance) {
  app.get('/v1/vault/key', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const row = app.db.getOne<{ vaultKeyBlob: string | null; vaultKeySalt: string | null }>(
      'SELECT vaultKeyBlob, vaultKeySalt FROM users WHERE id=?',
      [userId],
    );
    if (!row) return reply.code(401).send({ error: 'unauthorized' });
    const blob = row.vaultKeyBlob ? JSON.parse(row.vaultKeyBlob) : null;
    return reply.send({ blob, salt: row.vaultKeySalt ?? null });
  });

  app.put('/v1/vault/key', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const body = PutVaultKeySchema.parse(req.body);
    app.db.exec('UPDATE users SET vaultKeyBlob=?, vaultKeySalt=? WHERE id=?', [
      JSON.stringify(body.blob),
      body.salt,
      userId,
    ]);
    return reply.send({ ok: true });
  });

  app.delete('/v1/vault/key', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    app.db.exec('UPDATE users SET vaultKeyBlob=NULL, vaultKeySalt=NULL WHERE id=?', [userId]);
    return reply.send({ ok: true });
  });
}
