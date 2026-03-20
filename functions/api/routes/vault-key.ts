import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';

// Mirrors VaultBlobSchema from @kp/platform-web (inline — Cloudflare Workers env)
const VaultBlobSchema = z.object({
  version: z.number().int().positive(),
  kdf: z.object({ saltBase64: z.string(), iterations: z.number().int().positive() }),
  nonceBase64: z.string(),
  ciphertextBase64: z.string(),
});
import { getSql, type Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';

const vaultKey = new Hono<{ Bindings: Env }>();

const PutVaultKeySchema = z.object({
  blob: VaultBlobSchema,
  salt: z.string().min(1),
});

vaultKey.get('/v1/vault/key', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);
  const rows = await sql<{ vault_key_blob: string | null; vault_key_salt: string | null }[]>`
    SELECT vault_key_blob, vault_key_salt FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!rows.length) return json({ error: 'unauthorized' }, { status: 401 });
  const row = rows[0];
  const blob = row.vault_key_blob ? JSON.parse(row.vault_key_blob) : null;
  return json({ blob, salt: row.vault_key_salt ?? null });
});

vaultKey.put('/v1/vault/key', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const body = PutVaultKeySchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  await sql`
    UPDATE users SET vault_key_blob = ${JSON.stringify(body.blob)}, vault_key_salt = ${body.salt}
    WHERE id = ${userId}
  `;
  return json({ ok: true });
});

vaultKey.delete('/v1/vault/key', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);
  await sql`UPDATE users SET vault_key_blob = NULL, vault_key_salt = NULL WHERE id = ${userId}`;
  return json({ ok: true });
});

export { vaultKey };
