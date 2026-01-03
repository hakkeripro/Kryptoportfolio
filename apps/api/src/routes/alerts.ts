import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../services/authHooks.js';
import { newId } from '../services/auth.js';
import { AlertSchema } from '@kp/core';
import { MirrorStateSchema } from '@kp/core';
import { evaluateAndTriggerServerAlerts } from '../services/serverAlerts.js';

const EnableSchema = z.object({
  alerts: z.array(AlertSchema),
  state: MirrorStateSchema
});

const StateSchema = z.object({
  state: MirrorStateSchema
});

export function registerAlertRoutes(app: FastifyInstance) {
  app.post('/v1/alerts/server/enable', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const body = EnableSchema.parse(req.body);
    const now = new Date().toISOString();

    // replace all alerts for the user (explicit opt-in scope)
    app.db.exec('DELETE FROM server_alerts WHERE userId=?', [userId]);
    for (const a of body.alerts) {
      app.db.exec(
        'INSERT INTO server_alerts(id,userId,alertJson,isEnabled,createdAtISO,updatedAtISO,lastTriggeredAtISO) VALUES (?,?,?,?,?,?,?)',
        [newId('al'), userId, JSON.stringify(a), a.isEnabled ? 1 : 0, now, now, a.lastTriggeredAtISO ?? null]
      );
    }

    // upsert mirror state
    const existing = app.db.getOne<{ userId: string }>('SELECT userId FROM alert_mirror_state WHERE userId=?', [
      userId
    ]);
    if (existing) {
      app.db.exec('UPDATE alert_mirror_state SET stateJson=?, updatedAtISO=? WHERE userId=?', [
        JSON.stringify(body.state),
        now,
        userId
      ]);
    } else {
      app.db.exec('INSERT INTO alert_mirror_state(userId,stateJson,updatedAtISO) VALUES (?,?,?)', [
        userId,
        JSON.stringify(body.state),
        now
      ]);
    }

    // Evaluate immediately so hosted deployments work without a background interval runner.
    const evalRes = await evaluateAndTriggerServerAlerts(app, userId, JSON.stringify(body.state));
    return { ok: true, evaluated: (evalRes as any).evaluated ?? 0, triggered: (evalRes as any).triggered ?? 0 };
  });

  app.post('/v1/alerts/server/state', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const body = StateSchema.parse(req.body);
    const now = new Date().toISOString();

    const existing = app.db.getOne<{ userId: string }>('SELECT userId FROM alert_mirror_state WHERE userId=?', [
      userId
    ]);
    if (existing) {
      app.db.exec('UPDATE alert_mirror_state SET stateJson=?, updatedAtISO=? WHERE userId=?', [
        JSON.stringify(body.state),
        now,
        userId
      ]);
    } else {
      app.db.exec('INSERT INTO alert_mirror_state(userId,stateJson,updatedAtISO) VALUES (?,?,?)', [
        userId,
        JSON.stringify(body.state),
        now
      ]);
    }

    const evalRes = await evaluateAndTriggerServerAlerts(app, userId, JSON.stringify(body.state));
    return { ok: true, evaluated: (evalRes as any).evaluated ?? 0, triggered: (evalRes as any).triggered ?? 0 };
  });

  app.get('/v1/alerts/server/status', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const enabled = app.db.query<any>('SELECT id FROM server_alerts WHERE userId=? AND isEnabled=1', [userId]).length;
    const total = app.db.query<any>('SELECT id FROM server_alerts WHERE userId=?', [userId]).length;
    const stateRow = app.db.getOne<any>('SELECT updatedAtISO FROM alert_mirror_state WHERE userId=?', [userId]);
    return { ok: true, enabledCount: enabled, totalCount: total, mirrorUpdatedAtISO: stateRow?.updatedAtISO ?? null };
  });

  app.get('/v1/alerts/server/log', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const q = z
      .object({ limit: z.coerce.number().int().min(1).max(200).default(50) })
      .parse(req.query);

    const rows = app.db.query<any>(
      'SELECT id,alertId,triggeredAtISO,source,contextJson FROM alert_trigger_logs WHERE userId=? ORDER BY triggeredAtISO DESC LIMIT ?',
      [userId, q.limit]
    );
    return { logs: rows.map((r) => ({ ...r, context: JSON.parse(r.contextJson) })) };
  });
}
