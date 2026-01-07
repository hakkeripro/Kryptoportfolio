import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, getUserId } from '../services/authHooks.js';
import { AlertSchema } from '@kp/core';
import { MirrorStateSchema } from '@kp/core';
import { evaluateAndTriggerServerAlerts } from '../services/serverAlerts.js';

const EnableModeSchema = z.enum(['enable_only', 'merge', 'replace']);

const EnableSchema = z.object({
  mode: EnableModeSchema.optional(),
  alerts: z.array(AlertSchema).default([]),
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

    const alerts = body.alerts ?? [];
    const mode = body.mode ?? (alerts.length ? 'replace' : 'enable_only');

    const existingAlerts = app.db.query<any>('SELECT id, lastTriggeredAtISO FROM server_alerts WHERE userId=?', [userId]);
    const lastById = new Map(existingAlerts.map((r: any) => [String(r.id), r.lastTriggeredAtISO ?? null] as const));

    if (mode === 'enable_only') {
      // Master toggle: re-enable delivery without modifying the rule set.
      app.db.exec('UPDATE server_alerts SET isEnabled=1, updatedAtISO=? WHERE userId=?', [now, userId]);
    } else if (mode === 'replace') {
      // Replace full set.
      app.db.exec('DELETE FROM server_alerts WHERE userId=?', [userId]);
      for (const a of alerts) {
        const lastISO = (a as any).lastTriggeredAtISO ?? lastById.get(String((a as any).id)) ?? null;
        const alertJson = JSON.stringify({ ...a, lastTriggeredAtISO: lastISO });
        app.db.exec(
          'INSERT INTO server_alerts(id,userId,alertJson,isEnabled,createdAtISO,updatedAtISO,lastTriggeredAtISO) VALUES (?,?,?,?,?,?,?)',
          [String((a as any).id), userId, alertJson, a.isEnabled ? 1 : 0, a.createdAtISO ?? now, a.updatedAtISO ?? now, lastISO]
        );
      }
    } else {
      // merge: upsert provided alerts but keep existing rules not mentioned.
      for (const a of alerts) {
        const id = String((a as any).id);
        const lastISO = (a as any).lastTriggeredAtISO ?? lastById.get(id) ?? null;
        const alertJson = JSON.stringify({ ...a, lastTriggeredAtISO: lastISO });
        const exists = app.db.getOne<any>('SELECT id FROM server_alerts WHERE id=? AND userId=?', [id, userId]);
        if (exists) {
          app.db.exec('UPDATE server_alerts SET alertJson=?, isEnabled=?, updatedAtISO=?, lastTriggeredAtISO=? WHERE id=? AND userId=?', [
            alertJson,
            a.isEnabled ? 1 : 0,
            a.updatedAtISO ?? now,
            lastISO,
            id,
            userId
          ]);
        } else {
          app.db.exec(
            'INSERT INTO server_alerts(id,userId,alertJson,isEnabled,createdAtISO,updatedAtISO,lastTriggeredAtISO) VALUES (?,?,?,?,?,?,?)',
            [id, userId, alertJson, a.isEnabled ? 1 : 0, a.createdAtISO ?? now, a.updatedAtISO ?? now, lastISO]
          );
        }
      }
    }

    // upsert mirror state
    const existingState = app.db.getOne<{ userId: string }>('SELECT userId FROM alert_mirror_state WHERE userId=?', [
      userId
    ]);
    if (existingState) {
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
    const evalRes = await evaluateAndTriggerServerAlerts(app, userId, JSON.stringify(body.state), { logEvaluations: true, source: 'enable' });
    return { ok: true, evaluated: (evalRes as any).evaluated ?? 0, triggered: (evalRes as any).triggered ?? 0 };
  });

  app.post('/v1/alerts/server/disable', { preHandler: requireAuth }, async (req) => {
    const userId = getUserId(req);
    const now = new Date().toISOString();
    app.db.exec('UPDATE server_alerts SET isEnabled=0, updatedAtISO=? WHERE userId=?', [now, userId]);
    return { ok: true };
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

    const evalRes = await evaluateAndTriggerServerAlerts(app, userId, JSON.stringify(body.state), { logEvaluations: true, source: 'state' });
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
