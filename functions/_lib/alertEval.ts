import { AlertSchema, evaluateServerAlert, isAlertInCooldown, newId } from '@kp/core';
import { sendWebPushToUser, type PushMessage } from './pushSender';
import type { Env } from './db';

export async function evalAlerts(
  sql: any,
  env: Env,
  userId: string,
  state: any,
  source: string
): Promise<{ ok: boolean; evaluated: number; triggered: number }> {
  const rows = await sql<
    { id: string; alert_json: string; is_enabled: boolean; last_triggered_at_iso: string | null }[]
  >`
    SELECT id, alert_json, is_enabled, last_triggered_at_iso
    FROM server_alerts
    WHERE user_id=${userId} AND is_enabled=TRUE
  `;

  let evaluated = 0;
  let triggered = 0;

  for (const row of rows) {
    let alert: any;
    try {
      alert = AlertSchema.parse(JSON.parse(String(row.alert_json)));
      if (row.last_triggered_at_iso) alert.lastTriggeredAtISO = row.last_triggered_at_iso;
      alert.isEnabled = !!row.is_enabled;
    } catch {
      continue;
    }

    evaluated++;
    const res = evaluateServerAlert(alert, state);
    if (!res.triggered) {
      if (source === 'enable' || source === 'state') {
        try {
          await sql`
            INSERT INTO alert_trigger_logs(id,user_id,alert_id,triggered_at_iso,source,context_json)
            VALUES (${newId('tr')}, ${userId}, ${row.id}, ${state.nowISO}, ${source}, ${JSON.stringify({ ...res.context, triggered: false })})
          `;
        } catch {}
      }
      continue;
    }

    // cooldown check (was missing in Hono — now unified with Fastify)
    if (isAlertInCooldown(alert.lastTriggeredAtISO, alert.cooldownMin ?? 0, state.nowISO)) continue;

    triggered++;
    const trigISO = String(state.nowISO ?? new Date().toISOString());

    try {
      await sql`
        UPDATE server_alerts
        SET last_triggered_at_iso=${trigISO}, updated_at_iso=${new Date().toISOString()}
        WHERE id=${row.id} AND user_id=${userId}
      `;
    } catch {}

    try {
      await sql`
        INSERT INTO alert_trigger_logs(id,user_id,alert_id,triggered_at_iso,source,context_json)
        VALUES (${newId('tr')}, ${userId}, ${row.id}, ${trigISO}, ${source}, ${JSON.stringify(res.context)})
      `;
    } catch {}
  }

  if (triggered > 0) {
    const notif = {
      title: 'Kryptoportfolio alert',
      body: triggered === 1 ? '1 alert triggered' : `${triggered} alerts triggered`,
      url: '/alerts',
      data: { count: triggered, source },
    };

    const msg: PushMessage = { data: JSON.stringify(notif), options: { ttl: 60 } };
    try {
      await sendWebPushToUser(sql, env, userId, msg);
    } catch {}
  }

  return { ok: true, evaluated, triggered };
}
