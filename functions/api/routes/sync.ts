import { Hono } from 'hono';
import { json, readJson } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { DeviceSchema, EnvelopeSchema, EnvelopeQuerySchema, mapEnvelopeRow } from '@kp/core';

const sync = new Hono<{ Bindings: Env }>();

sync.post('/v1/devices/register', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = DeviceSchema.parse(await readJson(c.req.raw));
  const now = new Date().toISOString();
  const sql = getSql(c.env);

  const existing = await sql<{ id: string }[]>`SELECT id FROM devices WHERE id = ${body.deviceId} LIMIT 1`;
  if (existing.length) {
    await sql`UPDATE devices SET last_seen_at_iso=${now}, name=${body.name ?? null} WHERE id=${body.deviceId}`;
  } else {
    await sql`INSERT INTO devices(id, user_id, name, created_at_iso, last_seen_at_iso)
              VALUES (${body.deviceId}, ${userId}, ${body.name ?? null}, ${now}, ${now})`;
  }
  return json({ ok: true });
});

sync.post('/v1/sync/envelopes', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = EnvelopeSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  const existing = await sql<{ cursor: string }[]>`
    SELECT cursor FROM sync_envelopes WHERE id=${body.id} AND user_id=${userId} LIMIT 1
  `;
  if (existing.length) return json({ ok: true, cursor: Number(existing[0].cursor) });

  const inserted = await sql<{ cursor: string }[]>`
    INSERT INTO sync_envelopes(
      id, user_id, device_id, created_at_iso, version,
      kdf_salt_base64, kdf_iterations, ciphertext_base64, nonce_base64, checksum
    ) VALUES (
      ${body.id}, ${userId}, ${body.deviceId}, ${body.createdAtISO}, ${body.version},
      ${body.kdf.saltBase64}, ${body.kdf.iterations}, ${body.ciphertextBase64}, ${body.nonceBase64}, ${body.checksum ?? null}
    )
    RETURNING cursor
  `;

  return json({ ok: true, cursor: Number(inserted[0]?.cursor ?? 0) });
});

sync.get('/v1/sync/envelopes', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const q = EnvelopeQuerySchema.parse((c.req.query() as any) ?? {});

  const sql = getSql(c.env);
  const rows = await sql<any[]>`
    SELECT id, device_id, cursor, created_at_iso, version, kdf_salt_base64, kdf_iterations,
           ciphertext_base64, nonce_base64, checksum
    FROM sync_envelopes
    WHERE user_id=${userId} AND cursor > ${q.afterCursor}
    ORDER BY cursor ASC
    LIMIT ${q.limit}
  `;

  return json({ envelopes: rows.map(mapEnvelopeRow) });
});

export { sync };
