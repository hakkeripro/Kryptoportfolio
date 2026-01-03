import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../services/authHooks.js';
import { newId } from '../services/auth.js';

const DeviceSchema = z.object({
  deviceId: z.string().min(4),
  name: z.string().optional()
});

const EnvelopeSchema = z.object({
  id: z.string().min(8),
  deviceId: z.string().min(4),
  createdAtISO: z.string().datetime(),
  version: z.coerce.number().int().positive().default(1),
  kdf: z.object({
    saltBase64: z.string().min(8),
    iterations: z.coerce.number().int().positive()
  }),
  ciphertextBase64: z.string().min(8),
  nonceBase64: z.string().min(8),
  checksum: z.string().optional()
});

export function registerSyncRoutes(app: FastifyInstance) {
  app.post('/v1/devices/register', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const body = DeviceSchema.parse(req.body);
    const now = new Date().toISOString();
    const existing = app.db.getOne<{ id: string }>('SELECT id FROM devices WHERE id=?', [body.deviceId]);
    if (existing) {
      app.db.exec('UPDATE devices SET lastSeenAtISO=?, name=? WHERE id=?', [now, body.name ?? null, body.deviceId]);
    } else {
      app.db.exec('INSERT INTO devices(id,userId,name,createdAtISO,lastSeenAtISO) VALUES (?,?,?,?,?)', [
        body.deviceId,
        userId,
        body.name ?? null,
        now,
        now
      ]);
    }
    return reply.send({ ok: true });
  });

  app.post('/v1/sync/envelopes', { preHandler: requireAuth }, async (req, reply) => {
    const userId = getUserId(req);
    const body = EnvelopeSchema.parse(req.body);

    const existing = app.db.getOne<{ cursor: number }>('SELECT cursor FROM sync_envelopes WHERE id=? AND userId=?', [
      body.id,
      userId
    ]);
    if (existing) return reply.send({ ok: true, cursor: existing.cursor });

    // cursor = max(cursor)+1
    const last = app.db.getOne<{ cursor: number }>('SELECT MAX(cursor) as cursor FROM sync_envelopes WHERE userId=?', [
      userId
    ]);
    const cursor = Number((last as any)?.cursor ?? 0) + 1;

    app.db.exec(
      'INSERT INTO sync_envelopes(id,userId,deviceId,cursor,createdAtISO,version,kdfSaltBase64,kdfIterations,ciphertextBase64,nonceBase64,checksum) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
      [
        body.id,
        userId,
        body.deviceId,
        cursor,
        body.createdAtISO,
        body.version,
        body.kdf.saltBase64,
        body.kdf.iterations,
        body.ciphertextBase64,
        body.nonceBase64,
        body.checksum ?? null
      ]
    );

    return reply.send({ ok: true, cursor });
  });

  app.get('/v1/sync/envelopes', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const q = z
      .object({
        afterCursor: z.coerce.number().int().nonnegative().default(0),
        limit: z.coerce.number().int().min(1).max(500).default(200)
      })
      .parse(req.query);

    const rows = app.db.query<any>(
      'SELECT id,deviceId,cursor,createdAtISO,version,kdfSaltBase64,kdfIterations,ciphertextBase64,nonceBase64,checksum FROM sync_envelopes WHERE userId=? AND cursor>? ORDER BY cursor ASC LIMIT ?',
      [userId, q.afterCursor, q.limit]
    );

    return {
      envelopes: rows.map((r) => ({
        id: r.id,
        deviceId: r.deviceId,
        cursor: Number(r.cursor),
        createdAtISO: r.createdAtISO,
        version: Number(r.version ?? 1),
        kdf: { saltBase64: String(r.kdfSaltBase64 ?? ''), iterations: Number(r.kdfIterations ?? 0) },
        ciphertextBase64: r.ciphertextBase64,
        nonceBase64: r.nonceBase64,
        checksum: r.checksum ?? undefined
      }))
    };
  });

  // test-only clear endpoint
  app.post('/__test/reset', async (req, reply) => {
    if (!app.config.TEST_MODE) return reply.code(404).send({ error: 'not_found' });
    const tables = [
      'users',
      'devices',
      'sync_envelopes',
      'web_push_subscriptions',
      'expo_push_tokens',
      'server_alerts',
      'alert_mirror_state',
      'alert_trigger_logs'
    ];
    for (const t of tables) app.db.exec(`DELETE FROM ${t}`);
    await app.db.persist();
    return { ok: true };
  });
}
