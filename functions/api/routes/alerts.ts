import { Hono } from 'hono';
import {
  EnableServerAlertsSchema,
  MirrorStateBodySchema,
  TriggerLogQuerySchema,
  mapTriggerLogRow,
} from '@kp/core';
import { json, readJson } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { evalAlerts } from '../../_lib/alertEval';

const alerts = new Hono<{ Bindings: Env }>();

alerts.post('/v1/alerts/server/enable', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = EnableServerAlertsSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  const alertsList = body.alerts ?? [];
  const mode = body.mode ?? (alertsList.length ? 'replace' : 'enable_only');

  const existing = await sql<{ id: string; last_triggered_at_iso: string | null }[]>`
    SELECT id, last_triggered_at_iso FROM server_alerts WHERE user_id=${userId}
  `;
  const lastById = new Map(existing.map((r) => [String(r.id), r.last_triggered_at_iso] as const));

  if (mode === 'enable_only') {
    await sql`UPDATE server_alerts SET is_enabled=TRUE, updated_at_iso=${nowISO} WHERE user_id=${userId}`;
  } else if (mode === 'replace') {
    await sql`DELETE FROM server_alerts WHERE user_id=${userId}`;
    for (const a of alertsList) {
      const lastISO = (a as any).lastTriggeredAtISO ?? lastById.get(String(a.id)) ?? null;
      await sql`
        INSERT INTO server_alerts(id, user_id, alert_json, is_enabled, created_at_iso, updated_at_iso, last_triggered_at_iso)
        VALUES (${String(a.id)}, ${userId}, ${JSON.stringify({ ...a, lastTriggeredAtISO: lastISO })}, ${!!a.isEnabled}, ${String(a.createdAtISO)}, ${String(a.updatedAtISO)}, ${lastISO})
        ON CONFLICT (id) DO UPDATE SET
          alert_json = EXCLUDED.alert_json, is_enabled = EXCLUDED.is_enabled,
          updated_at_iso = EXCLUDED.updated_at_iso, last_triggered_at_iso = EXCLUDED.last_triggered_at_iso
        WHERE server_alerts.user_id = EXCLUDED.user_id
      `;
    }
  } else {
    for (const a of alertsList) {
      const lastISO = (a as any).lastTriggeredAtISO ?? lastById.get(String(a.id)) ?? null;
      await sql`
        INSERT INTO server_alerts(id, user_id, alert_json, is_enabled, created_at_iso, updated_at_iso, last_triggered_at_iso)
        VALUES (${String(a.id)}, ${userId}, ${JSON.stringify({ ...a, lastTriggeredAtISO: lastISO })}, ${!!a.isEnabled}, ${String(a.createdAtISO)}, ${String(a.updatedAtISO)}, ${lastISO})
        ON CONFLICT (id) DO UPDATE SET
          alert_json = EXCLUDED.alert_json, is_enabled = EXCLUDED.is_enabled,
          updated_at_iso = EXCLUDED.updated_at_iso, last_triggered_at_iso = EXCLUDED.last_triggered_at_iso
        WHERE server_alerts.user_id = EXCLUDED.user_id
      `;
    }
  }

  await sql`
    INSERT INTO alert_mirror_state(user_id, state_json, updated_at_iso)
    VALUES (${userId}, ${JSON.stringify(body.state)}, ${nowISO})
    ON CONFLICT (user_id)
    DO UPDATE SET state_json = EXCLUDED.state_json, updated_at_iso = EXCLUDED.updated_at_iso
  `;

  const r = await evalAlerts(sql, c.env, userId, body.state, 'enable');
  return json({ ok: true, ...r });
});

alerts.post('/v1/alerts/server/disable', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();
  await sql`UPDATE server_alerts SET is_enabled=FALSE, updated_at_iso=${nowISO} WHERE user_id=${userId}`;
  return json({ ok: true });
});

alerts.post('/v1/alerts/server/state', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = MirrorStateBodySchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  await sql`
    INSERT INTO alert_mirror_state(user_id, state_json, updated_at_iso)
    VALUES (${userId}, ${JSON.stringify(body.state)}, ${nowISO})
    ON CONFLICT (user_id)
    DO UPDATE SET state_json = EXCLUDED.state_json, updated_at_iso = EXCLUDED.updated_at_iso
  `;

  const r = await evalAlerts(sql, c.env, userId, body.state, 'state');
  return json({ ok: true, ...r });
});

alerts.get('/v1/alerts/server/status', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);

  const cnt = await sql<{ total: string; enabled: string }[]>`
    SELECT COUNT(*)::text as total, SUM(CASE WHEN is_enabled THEN 1 ELSE 0 END)::text as enabled
    FROM server_alerts WHERE user_id=${userId}
  `;
  const ms = await sql<{ updated_at_iso: string }[]>`
    SELECT updated_at_iso FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
  `;
  const rs = await sql<
    { last_run_at_iso: string; last_error: string | null; last_evaluated: number; last_triggered: number }[]
  >`
    SELECT last_run_at_iso, last_error, last_evaluated, last_triggered
    FROM alert_runner_state WHERE user_id=${userId} LIMIT 1
  `;

  return json({
    enabled: Number(cnt[0]?.enabled ?? 0),
    total: Number(cnt[0]?.total ?? 0),
    mirrorUpdatedAtISO: ms[0]?.updated_at_iso ?? null,
    runnerLastRunAtISO: rs[0]?.last_run_at_iso ?? null,
    runnerLastError: rs[0]?.last_error ?? null,
    runnerLastEvaluated: rs[0]?.last_evaluated ?? null,
    runnerLastTriggered: rs[0]?.last_triggered ?? null,
  });
});

alerts.get('/v1/alerts/server/log', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const limit = TriggerLogQuerySchema.shape.limit.parse(c.req.query('limit') ?? 50);
  const sql = getSql(c.env);
  const rows = await sql<any[]>`
    SELECT id, alert_id, triggered_at_iso, source, context_json
    FROM alert_trigger_logs WHERE user_id=${userId}
    ORDER BY triggered_at_iso DESC LIMIT ${limit}
  `;
  return json({ triggers: rows.map(mapTriggerLogRow) });
});

export { alerts };
