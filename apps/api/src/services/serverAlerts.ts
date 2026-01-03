import type { FastifyInstance } from 'fastify';
import webpush from 'web-push';
import { fetch } from 'undici';
import { AlertSchema, evaluateServerAlert, MirrorStateSchema } from '@kp/core';
import { newId } from './auth.js';

function isPushConfigured(app: FastifyInstance) {
  return !!(app.config.VAPID_PUBLIC_KEY && app.config.VAPID_PRIVATE_KEY);
}

async function sendWebPush(app: FastifyInstance, userId: string, payload: any) {
  if (app.config.testMode) return;
  if (!isPushConfigured(app)) return;

  webpush.setVapidDetails(
    app.config.VAPID_SUBJECT ?? 'mailto:admin@example.com',
    app.config.VAPID_PUBLIC_KEY!,
    app.config.VAPID_PRIVATE_KEY!
  );

  const subs = app.db.query<any>('SELECT endpoint, subscriptionJson FROM web_push_subscriptions WHERE userId=?', [
    userId
  ]);

  for (const s of subs) {
    try {
      await webpush.sendNotification(JSON.parse(s.subscriptionJson), JSON.stringify(payload));
    } catch (e) {
      // Keep log but do not throw; subscription may be expired.
      app.log.warn({ err: e }, 'web push failed');
    }
  }
}

async function sendExpoPush(app: FastifyInstance, userId: string, payload: any) {
  if (app.config.testMode) return;
  const tokens = app.db.query<any>('SELECT token FROM expo_push_tokens WHERE userId=?', [userId]);
  if (!tokens.length) return;

  const messages = tokens.map((t) => ({
    to: t.token,
    title: payload.title ?? 'Kryptoportfolio',
    body: payload.body ?? payload.message ?? 'Alert',
    data: payload.data ?? {}
  }));

  try {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(messages)
    });
  } catch (e) {
    app.log.warn({ err: e }, 'expo push failed');
  }
}

/**
 * Evaluate enabled server alerts for a user, write trigger logs, and deliver push (if configured).
 * This is called both from the interval runner and from request handlers so the hosted MVP can work
 * without a background job.
 */
export async function evaluateAndTriggerServerAlerts(app: FastifyInstance, userId: string, stateJson?: string) {
  const stateRow =
    stateJson != null
      ? ({ stateJson } as any)
      : app.db.getOne<any>('SELECT stateJson FROM alert_mirror_state WHERE userId=?', [userId]);
  if (!stateRow) return { ok: true, evaluated: 0, triggered: 0 };

  let state: any;
  try {
    state = MirrorStateSchema.parse(JSON.parse(stateRow.stateJson));
  } catch {
    return { ok: false, error: 'invalid_state' };
  }

  const alerts = app.db.query<any>(
    'SELECT id, alertJson, lastTriggeredAtISO FROM server_alerts WHERE userId=? AND isEnabled=1',
    [userId]
  );

  let evaluated = 0;
  let triggered = 0;
  for (const row of alerts) {
    let alert: any;
    try {
      alert = AlertSchema.parse(JSON.parse(row.alertJson));
      if (row.lastTriggeredAtISO) alert.lastTriggeredAtISO = row.lastTriggeredAtISO;
    } catch {
      continue;
    }

    evaluated++;
    const res = evaluateServerAlert(alert, state);
    if (!res.triggered) continue;

    // cooldown: if within cooldownMin, skip
    const cooldownMin = alert.cooldownMin ?? 0;
    if (alert.lastTriggeredAtISO && cooldownMin > 0) {
      const last = Date.parse(alert.lastTriggeredAtISO);
      const now = Date.parse(state.nowISO);
      if (!Number.isNaN(last) && now - last < cooldownMin * 60_000) continue;
    }

    const triggeredAtISO = state.nowISO;
    app.db.exec('UPDATE server_alerts SET lastTriggeredAtISO=?, updatedAtISO=? WHERE id=?', [
      triggeredAtISO,
      new Date().toISOString(),
      row.id
    ]);

    const logId = newId('tr');
    app.db.exec('INSERT INTO alert_trigger_logs(id,userId,alertId,triggeredAtISO,source,contextJson) VALUES (?,?,?,?,?,?)', [
      logId,
      userId,
      alert.id,
      triggeredAtISO,
      'server',
      JSON.stringify(res.context)
    ]);

    const payload = {
      title: 'Kryptoportfolio alert',
      body: res.context.reason,
      data: { alertId: alert.id, type: alert.type, context: res.context }
    };

    await sendWebPush(app, userId, payload);
    await sendExpoPush(app, userId, payload);
    triggered++;
  }

  return { ok: true, evaluated, triggered };
}
