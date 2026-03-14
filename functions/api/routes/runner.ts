import { Hono } from 'hono';
import { z } from 'zod';
import { MirrorStateSchema } from '@kp/core';
import { json } from '../../_lib/http';
import { getSql, type Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { evalAlerts } from '../../_lib/alertEval';

const runner = new Hono<{ Bindings: Env }>();

function getRunnerBearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function requireRunner(env: Env, req: Request): void {
  const secret = String(env.CRON_SECRET ?? '');
  if (!secret) throw new Error('unauthorized');
  const bearer = getRunnerBearer(req);
  if (!bearer || bearer !== secret) throw new Error('unauthorized');
}

runner.post('/v1/alerts/server/run', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  const stateRow = await sql<{ state_json: string }[]>`
    SELECT state_json FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
  `;

  if (!stateRow.length) {
    try {
      await sql`
        INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
        VALUES (${userId},${nowISO},NULL,0,0,${nowISO})
        ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
      `;
    } catch {}
    return json({ ok: true, evaluated: 0, triggered: 0 });
  }

  let state: any;
  try {
    state = MirrorStateSchema.parse(JSON.parse(String(stateRow[0].state_json)));
  } catch {
    try {
      await sql`
        INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
        VALUES (${userId},${nowISO},${'invalid_state'},0,0,${nowISO})
        ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${'invalid_state'}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
      `;
    } catch {}
    return json({ ok: false, error: 'invalid_state' }, { status: 400 });
  }

  const res = await evalAlerts(sql, c.env, userId, state, 'cron');

  try {
    await sql`
      INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
      VALUES (${userId},${nowISO},NULL,${res.evaluated ?? 0},${res.triggered ?? 0},${nowISO})
      ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=${res.evaluated ?? 0}, last_triggered=${res.triggered ?? 0}, updated_at_iso=${nowISO}
    `;
  } catch {}

  return json(res);
});

runner.post('/v1/alerts/server/runAll', async (c) => {
  requireRunner(c.env, c.req.raw);
  const sql = getSql(c.env);

  const limit = z.coerce.number().int().min(1).max(1000).default(200).parse(c.req.query('limit') ?? 200);
  const nowISO = new Date().toISOString();

  const users = await sql<{ user_id: string }[]>`
    SELECT DISTINCT s.user_id
    FROM server_alerts s
    JOIN alert_mirror_state m ON m.user_id=s.user_id
    WHERE s.is_enabled=TRUE
    LIMIT ${limit}
  `;

  let usersOk = 0;
  let usersErrored = 0;
  let evaluatedTotal = 0;
  let triggeredTotal = 0;

  for (const u of users) {
    const userId = String(u.user_id);

    const stateRow = await sql<{ state_json: string }[]>`
      SELECT state_json FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
    `;
    if (!stateRow.length) continue;

    let state: any;
    try {
      state = MirrorStateSchema.parse(JSON.parse(String(stateRow[0].state_json)));
    } catch {
      usersErrored++;
      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},${'invalid_state'},0,0,${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${'invalid_state'}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
        `;
      } catch {}
      continue;
    }

    try {
      const res = await evalAlerts(sql, c.env, userId, state, 'cron');
      evaluatedTotal += res.evaluated ?? 0;
      triggeredTotal += res.triggered ?? 0;
      usersOk++;

      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},NULL,${res.evaluated ?? 0},${res.triggered ?? 0},${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=${res.evaluated ?? 0}, last_triggered=${res.triggered ?? 0}, updated_at_iso=${nowISO}
        `;
      } catch {}
    } catch (e: any) {
      usersErrored++;
      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},${String(e?.message ?? e)},0,0,${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${String(e?.message ?? e)}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
        `;
      } catch {}
    }
  }

  return json({ ok: true, users: users.length, usersOk, usersErrored, evaluatedTotal, triggeredTotal });
});

export { runner };
