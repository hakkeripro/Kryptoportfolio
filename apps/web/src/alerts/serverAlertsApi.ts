import { z } from 'zod';
import type { Alert, MirrorState } from '@kp/core';

const StatusSchemaA = z.object({
  ok: z.boolean().optional(),
  enabledCount: z.number().int().nonnegative().optional(),
  totalCount: z.number().int().nonnegative().optional(),
  mirrorUpdatedAtISO: z.string().datetime().nullable().optional()
});

const StatusSchemaB = z.object({
  enabled: z.number().int().nonnegative().optional(),
  total: z.number().int().nonnegative().optional(),
  mirrorUpdatedAtISO: z.string().datetime().nullable().optional()
});

const TriggerSchema = z.object({
  id: z.string(),
  alertId: z.string().optional(),
  triggeredAtISO: z.string().datetime(),
  source: z.string().optional(),
  context: z.any().optional(),
  contextJson: z.string().optional()
});

const LogSchemaA = z.object({ logs: z.array(TriggerSchema).optional() });
const LogSchemaB = z.object({ triggers: z.array(TriggerSchema).optional() });

const EnableRespSchema = z.object({ ok: z.boolean().optional(), evaluated: z.number().optional(), triggered: z.number().optional() }).passthrough();

const VapidSchema = z.object({ enabled: z.boolean(), publicKey: z.string().nullable() });

async function apiFetch<T>(base: string, path: string, init: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, { cache: 'no-store', ...init });
  const txt = await r.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(json)}`);
  return json as T;
}

function authHeaders(token: string | null): HeadersInit {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export async function getServerAlertsStatus(apiBase: string, token: string | null) {
  const raw = await apiFetch<any>(apiBase, '/v1/alerts/server/status', {
    method: 'GET',
    headers: { ...authHeaders(token) }
  });

  const a = StatusSchemaA.safeParse(raw);
  const b = StatusSchemaB.safeParse(raw);
  if (a.success) {
    return {
      enabled: a.data.enabledCount ?? 0,
      total: a.data.totalCount ?? 0,
      mirrorUpdatedAtISO: a.data.mirrorUpdatedAtISO ?? null,
      runnerLastRunAtISO: (a.data as any).runnerLastRunAtISO ?? null,
      runnerLastError: (a.data as any).runnerLastError ?? null,
      runnerLastEvaluated: (a.data as any).runnerLastEvaluated ?? null,
      runnerLastTriggered: (a.data as any).runnerLastTriggered ?? null
    };
  }
  if (b.success) {
    return {
      enabled: b.data.enabled ?? 0,
      total: b.data.total ?? 0,
      mirrorUpdatedAtISO: b.data.mirrorUpdatedAtISO ?? null,
      runnerLastRunAtISO: (b.data as any).runnerLastRunAtISO ?? null,
      runnerLastError: (b.data as any).runnerLastError ?? null,
      runnerLastEvaluated: (b.data as any).runnerLastEvaluated ?? null,
      runnerLastTriggered: (b.data as any).runnerLastTriggered ?? null
    };
  }
  return { enabled: 0, total: 0, mirrorUpdatedAtISO: null, runnerLastRunAtISO: null, runnerLastError: null, runnerLastEvaluated: null, runnerLastTriggered: null };
}

export async function enableServerAlerts(apiBase: string, token: string, alerts: Alert[], state: MirrorState) {
  const raw = await apiFetch<any>(apiBase, '/v1/alerts/server/enable', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ alerts, state })
  });
  return EnableRespSchema.parse(raw);
}

export async function updateServerMirrorState(apiBase: string, token: string, state: MirrorState) {
  const raw = await apiFetch<any>(apiBase, '/v1/alerts/server/state', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ state })
  });
  return EnableRespSchema.parse(raw);
}

export async function getServerAlertLog(apiBase: string, token: string, limit = 50) {
  const raw = await apiFetch<any>(apiBase, `/v1/alerts/server/log?limit=${encodeURIComponent(String(limit))}`, {
    method: 'GET',
    headers: { ...authHeaders(token) }
  });
  const a = LogSchemaA.safeParse(raw);
  const b = LogSchemaB.safeParse(raw);
  const rows = a.success ? (a.data.logs ?? []) : b.success ? (b.data.triggers ?? []) : [];
  return rows.map((r) => {
    let ctx: any = r.context;
    if (!ctx && r.contextJson) {
      try {
        ctx = JSON.parse(r.contextJson);
      } catch {
        ctx = null;
      }
    }
    return {
      id: r.id,
      alertId: r.alertId ?? null,
      triggeredAtISO: r.triggeredAtISO,
      source: r.source ?? 'server',
      context: ctx ?? null
    };
  });
}

export async function runServerAlerts(apiBase: string, token: string) {
  const raw = await apiFetch<any>(apiBase, '/v1/alerts/server/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({})
  });
  return EnableRespSchema.parse(raw);
}

export async function getVapidPublicKey(apiBase: string) {
  const raw = await apiFetch<any>(apiBase, '/v1/push/web/vapidPublicKey', { method: 'GET' });
  return VapidSchema.parse(raw);
}

export async function subscribeWebPush(apiBase: string, token: string, subscription: any) {
  // local Fastify expects {subscription}; hosted Functions expects {subscription} too
  return apiFetch<any>(apiBase, '/v1/push/web/subscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ subscription })
  });
}


export async function unsubscribeWebPush(apiBase: string, token: string, endpoint: string) {
  return apiFetch<any>(apiBase, '/v1/push/web/unsubscribe', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({ endpoint })
  });
}

export async function sendTestWebPush(apiBase: string, token: string) {
  return apiFetch<any>(apiBase, '/v1/push/web/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...authHeaders(token) },
    body: JSON.stringify({})
  });
}
