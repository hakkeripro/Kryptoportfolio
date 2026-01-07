import { useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Alert, Asset } from '@kp/core';
import { AlertSchema, uuid } from '@kp/core';

import { useAppStore } from '../store/useAppStore';
import { useDbQuery } from '../hooks/useDbQuery';
import { buildMirrorState } from '../alerts/buildMirrorState';
import { refreshLivePrices } from '../derived/refreshLivePrices';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import {
  enableServerAlerts,
  getServerAlertLog,
  getServerAlertsStatus,
  getVapidPublicKey,
  subscribeWebPush,
  sendTestWebPush,
  updateServerMirrorState
} from '../alerts/serverAlertsApi';

type FormType = Alert['type'];

function formatAlert(a: Alert, assetsById: Record<string, Asset>, baseCurrency: string) {
  if (a.type === 'PORTFOLIO_VALUE') {
    const dir = a.direction === 'BELOW' ? 'below' : 'above';
    return `Portfolio value ${dir} ${a.thresholdBase} ${baseCurrency}`;
  }
  if (a.type === 'PRICE') {
    const asset = assetsById[a.assetId];
    const sym = asset?.symbol ?? String(a.assetId ?? '').replace(/^asset_/, '').toUpperCase();
    const dir = a.direction === 'BELOW' ? 'below' : 'above';
    return `${sym} price ${dir} ${a.thresholdBase} ${baseCurrency}`;
  }
  if (a.type === 'DRAWDOWN') {
    return `Drawdown ≥ ${a.thresholdPct}%`;
  }
  if (a.type === 'PCT_CHANGE') {
    const asset = assetsById[a.assetId];
    const sym = asset?.symbol ?? String(a.assetId ?? '').replace(/^asset_/, '').toUpperCase();
    return `${sym} pct-change ≥ ${a.thresholdPct}%`;
  }
  return a.type;
}

const NumberInput = z
  .string()
  .trim()
  .refine((s) => /^-?\d+(\.\d+)?$/.test(s), 'invalid_number');

async function ensurePushEnabled(apiBase: string, token: string) {
  const vapid = await getVapidPublicKey(apiBase);
  if (!vapid.enabled || !vapid.publicKey) return { ok: false as const, reason: 'VAPID_NOT_CONFIGURED' };

  if (!('serviceWorker' in navigator)) return { ok: false as const, reason: 'NO_SW' };
  if (!('PushManager' in window)) return { ok: false as const, reason: 'NO_PUSH' };

  // Push requires HTTPS (localhost is ok in most browsers, but we still guide users).
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!isSecure) return { ok: false as const, reason: 'HTTPS_REQUIRED' };

  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false as const, reason: 'PERMISSION_DENIED' };

  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid.publicKey)
  });

  await subscribeWebPush(apiBase, token, sub.toJSON());
  return { ok: true as const };
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

export default function AlertsPage() {
  const apiBase = useAppStore((s) => s.apiBase);
  const token = useAppStore((s) => s.token);

  // NOTE: useDbQuery is a tiny liveQuery hook (reacts to IndexedDB changes automatically).
  // Do not rely on manual refetch() here.
  const alertsQ = useDbQuery(
    async (db) => {
      const rows = await db.alerts.toArray();
      rows.sort((a: any, b: any) => String(b.updatedAtISO || '').localeCompare(String(a.updatedAtISO || '')));
      return rows as any;
    },
    [],
    [] as any[]
  );
  const assetsQ = useDbQuery(async (db) => await db.assets.toArray(), [], [] as any[]);
  const settingsQ = useDbQuery(async (db) => (await db.settings.get('settings_1')) as any, [], null as any);

  const assetsById = useMemo(() => {
    const m: Record<string, Asset> = {};
    for (const a of (assetsQ.data ?? []) as Asset[]) m[a.id] = a;
    return m;
  }, [assetsQ.data]);

  const baseCurrency = String((settingsQ.data as any)?.baseCurrency ?? 'EUR').toUpperCase();

  const [formType, setFormType] = useState<FormType>('PORTFOLIO_VALUE');
  const [formDirection, setFormDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [formThreshold, setFormThreshold] = useState('1000');
  const [formAssetId, setFormAssetId] = useState<string>('');
  const [formCooldown, setFormCooldown] = useState('0');
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<{ enabled: number; total: number; mirrorUpdatedAtISO: string | null; runnerLastRunAtISO?: string | null; runnerLastError?: string | null } | null>(null);
  const [logRows, setLogRows] = useState<{ id: string; alertId: string | null; triggeredAtISO: string; source: string; context: any }[]>(
    []
  );
  const [loading, setLoading] = useState<string | null>(null);

  const localAlerts = (alertsQ.data ?? []) as Alert[];

  async function refreshServerStatus() {
    if (!token) {
      setServerStatus(null);
      return;
    }
    try {
      const s = await getServerAlertsStatus(apiBase, token);
      setServerStatus(s);
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    }
  }

  async function refreshLog() {
    if (!token) return;
    try {
      const rows = await getServerAlertLog(apiBase, token, 50);
      setLogRows(rows);
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    }
  }

  async function addAlert() {
    setServerMsg(null);
    const now = new Date().toISOString();
    const cooldownMin = NumberInput.safeParse(formCooldown).success ? Math.max(0, Number(formCooldown)) : 0;

    let alert: any = {
      id: `al_${uuid()}`,
      schemaVersion: 1,
      createdAtISO: now,
      updatedAtISO: now,
      isDeleted: false,
      type: formType,
      isEnabled: true,
      source: 'server',
      cooldownMin
    };

    if (formType === 'PORTFOLIO_VALUE') {
      const th = NumberInput.parse(formThreshold);
      alert = { ...alert, thresholdBase: new Decimal(th).abs().toFixed(), direction: formDirection };
    } else if (formType === 'PRICE') {
      if (!formAssetId) throw new Error('asset_required');
      const th = NumberInput.parse(formThreshold);
      alert = { ...alert, assetId: formAssetId, thresholdBase: new Decimal(th).abs().toFixed(), direction: formDirection };
    } else if (formType === 'DRAWDOWN') {
      const th = NumberInput.parse(formThreshold);
      alert = { ...alert, thresholdPct: new Decimal(th).abs().toFixed() };
    } else if (formType === 'PCT_CHANGE') {
      if (!formAssetId) throw new Error('asset_required');
      const th = NumberInput.parse(formThreshold);
      alert = { ...alert, assetId: formAssetId, thresholdPct: new Decimal(th).abs().toFixed() };
    }

    const parsed = AlertSchema.parse(alert);
    await ensureWebDbOpen();
    await getWebDb().alerts.put(parsed as any);
    // liveQuery will re-run automatically when the alerts table changes
  }

  async function toggleAlert(id: string, isEnabled: boolean) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const row = (await db.alerts.get(id)) as any;
    if (!row) return;
    await db.alerts.put({ ...row, isEnabled, updatedAtISO: new Date().toISOString() });
    // liveQuery will re-run automatically
  }

  async function deleteAlert(id: string) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const row = (await db.alerts.get(id)) as any;
    if (!row) return;
    await db.alerts.put({ ...row, isDeleted: true, isEnabled: false, updatedAtISO: new Date().toISOString() });
    // liveQuery will re-run automatically
  }

  async function enableOnServer() {
    if (!token) {
      setServerMsg('Login required to enable server alerts.');
      return;
    }
    setLoading('server');
    setServerMsg(null);
    try {
      const active = localAlerts.filter((a) => !a.isDeleted && a.isEnabled && (a as any).source !== 'foreground');
      // Ensure mirror state uses fresh prices and derived caches.
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });

      const state = await buildMirrorState();

      if (!active.length) {
        const ok = window.confirm(
          'You have 0 active alerts locally.\n\nIf you continue, this will REPLACE (clear) all server-side rules.\n\nPress Cancel to enable server delivery without clearing existing server rules.'
        );
        const res = ok
          ? await enableServerAlerts(apiBase, token, [], state, { mode: 'replace' })
          : await enableServerAlerts(apiBase, token, [], state, { mode: 'enable_only' });
        setServerMsg(
          ok
            ? `Server rules replaced. Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`
            : `Server delivery enabled (kept existing rules). Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`
        );
      } else {
        const res = await enableServerAlerts(apiBase, token, active, state, { mode: 'replace' });
        setServerMsg(`Server alerts enabled. Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`);
      }
      await refreshServerStatus();
      await refreshLog();
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function updateState() {
    if (!token) {
      setServerMsg('Login required.');
      return;
    }
    setLoading('state');
    setServerMsg(null);
    try {
      // Ensure mirror state uses fresh prices and derived caches.
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });

      const state = await buildMirrorState();
      const res = await updateServerMirrorState(apiBase, token, state);
      setServerMsg(`State updated. Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`);
      await refreshServerStatus();
      await refreshLog();
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function enablePush() {
    if (!token) {
      setServerMsg('Login required.');
      return;
    }
    setLoading('push');
    setServerMsg(null);
    try {
      const res = await ensurePushEnabled(apiBase, token);
      if (res.ok) setServerMsg('Push enabled for this device.');
      else setServerMsg(`Push not enabled: ${res.reason}`);
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    } finally {
      setLoading(null);
    }
  }

  async function testPush() {
    if (!token) {
      setServerMsg('Login required.');
      return;
    }
    setLoading('pushTest');
    setServerMsg(null);
    try {
      const r = await sendTestWebPush(apiBase, token);
      if (r.ok) {
        const attempted = typeof r.attempted === 'number' ? r.attempted : 0;
        const success = typeof r.success === 'number' ? r.success : 0;
        setServerMsg(`Test notification queued (attempted ${attempted}, success ${success}).`);
      } else {
        setServerMsg('Push test failed.');
      }
    } catch (e: any) {
      setServerMsg(String(e?.message ?? e));
    } finally {
      setLoading(null);
    }
  }


  // light refresh on first render
  useEffect(() => {
    void refreshServerStatus();
    void refreshLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const visibleAlerts = localAlerts.filter((a) => !a.isDeleted);

  return (
    <div className="space-y-6" data-testid="panel-alerts">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Alerts</h1>
        <div className="text-xs text-slate-500">Server alerts require login + sync</div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="panel-alerts-local">
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold">Local alert rules</div>
            <div className="text-xs text-slate-500">Base: {baseCurrency}</div>
          </div>

          <div className="mt-3 space-y-3" data-testid="panel-alerts-form">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-slate-400">
                Type
                <select
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value as any)}
                  data-testid="form-alert-type"
                >
                  <option value="PORTFOLIO_VALUE">Portfolio value</option>
                  <option value="PRICE">Asset price</option>
                  <option value="DRAWDOWN">Drawdown</option>
                  <option value="PCT_CHANGE">Pct-change</option>
                </select>
              </label>

              {(formType === 'PORTFOLIO_VALUE' || formType === 'PRICE') && (
                <label className="text-xs text-slate-400">
                  Direction
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={formDirection}
                    onChange={(e) => setFormDirection(e.target.value as any)}
                    data-testid="form-alert-direction"
                  >
                    <option value="ABOVE">Above</option>
                    <option value="BELOW">Below</option>
                  </select>
                </label>
              )}

              {(formType === 'PRICE' || formType === 'PCT_CHANGE') && (
                <label className="text-xs text-slate-400">
                  Asset
                  <select
                    className="mt-1 w-full rounded border px-2 py-1 text-sm"
                    value={formAssetId}
                    onChange={(e) => setFormAssetId(e.target.value)}
                    data-testid="form-alert-asset"
                  >
                    <option value="">Select…</option>
                    {(assetsQ.data ?? []).map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol} — {a.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <label className="text-xs text-slate-400">
                Threshold
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={formThreshold}
                  onChange={(e) => setFormThreshold(e.target.value)}
                  placeholder={formType === 'PCT_CHANGE' || formType === 'DRAWDOWN' ? 'Percent' : 'Base currency'}
                  data-testid="form-alert-threshold"
                />
              </label>

              <label className="text-xs text-slate-400">
                Cooldown (min)
                <input
                  className="mt-1 w-full rounded border px-2 py-1 text-sm"
                  value={formCooldown}
                  onChange={(e) => setFormCooldown(e.target.value)}
                  data-testid="form-alert-cooldown"
                />
              </label>
            </div>

            <button
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700"
              onClick={() => void addAlert()}
              data-testid="btn-save-alert"
            >
              Add alert
            </button>
          </div>

          <div className="mt-4">
            <div className="text-xs font-semibold text-slate-400">Existing</div>
            <div className="mt-2 space-y-2" data-testid="list-alerts">
              {visibleAlerts.length ? (
                visibleAlerts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-start justify-between gap-3 rounded-lg border p-3"
                    data-testid={`row-alert-${a.id}`}
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{formatAlert(a, assetsById, baseCurrency)}</div>
                      <div className="text-xs text-slate-500">Cooldown: {a.cooldownMin ?? 0}m</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="flex items-center gap-2 text-xs" data-testid={`toggle-alert-${a.id}`}>
                        <input
                          type="checkbox"
                          checked={!!a.isEnabled}
                          onChange={(e) => void toggleAlert(a.id, e.target.checked)}
                        />
                        Enabled
                      </label>
                      <button
                        className="rounded border px-2 py-1 text-xs hover:bg-slate-700"
                        onClick={() => void deleteAlert(a.id)}
                        data-testid={`btn-delete-alert-${a.id}`}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500">No alerts yet.</div>
              )}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="panel-alerts-server">
          <div className="text-sm font-semibold">Server alerts (opt-in)</div>
          <div className="mt-1 text-xs text-slate-400">
            Enable to get push notifications even when the app is closed.
          </div>

          {!token ? (
            <div className="mt-3 rounded-lg border bg-slate-950/40 p-3 text-sm text-slate-200" data-testid="box-alerts-login-required">
              Login required to enable server alerts.
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <div className="rounded-lg border bg-slate-950/40 p-3 text-xs" data-testid="box-alerts-server-status">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Enabled rules</span>
                  <span className="font-mono">{serverStatus ? `${serverStatus.enabled}/${serverStatus.total}` : '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Mirror updated</span>
                  <span className="font-mono">
                    {serverStatus?.mirrorUpdatedAtISO ? new Date(serverStatus.mirrorUpdatedAtISO).toLocaleString() : '—'}
                  </span>
                </div>
                <button
                  className="mt-2 rounded border px-2 py-1 text-xs hover:bg-slate-700"
                  onClick={() => void refreshServerStatus()}
                  data-testid="btn-refresh-server-status"
                >
                  Refresh
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
                  onClick={() => void enableOnServer()}
                  disabled={loading != null}
                  data-testid="btn-enable-server-alerts"
                >
                  {loading === 'server' ? 'Enabling…' : 'Enable on server'}
                </button>
                <button
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                  onClick={() => void updateState()}
                  disabled={loading != null}
                  data-testid="btn-update-server-state"
                >
                  {loading === 'state' ? 'Updating…' : 'Update mirror state'}
                </button>
              </div>

              <button
                className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                onClick={() => void enablePush()}
                disabled={loading != null}
                data-testid="btn-enable-push"
              >
                {loading === 'push' ? 'Enabling push…' : 'Enable push notifications (this device)'}
              </button>

              <button
                className="rounded border px-3 py-2 text-sm hover:bg-slate-700 disabled:opacity-50"
                onClick={() => void testPush()}
                disabled={loading != null}
                data-testid="btn-push-test"
              >
                {loading === 'pushTest' ? 'Sending…' : 'Send test notification'}
              </button>

              {serverMsg ? (
                <div className="rounded-lg border bg-slate-950/40 p-3 text-sm text-slate-200" data-testid="txt-alert-server-message">
                  {serverMsg}
                </div>
              ) : null}

              <div>
                <div className="flex items-center justify-between">
                  <div className="text-xs font-semibold text-slate-400">Trigger log</div>
                  <button
                    className="rounded border px-2 py-1 text-xs hover:bg-slate-700"
                    onClick={() => void refreshLog()}
                    data-testid="btn-refresh-alert-log"
                  >
                    Refresh
                  </button>
                </div>
                <div className="mt-2 space-y-2" data-testid="list-trigger-log">
                  {logRows.length ? (
                    logRows.map((r) => (
                      <div key={r.id} className="rounded-lg border p-3 text-xs" data-testid={`row-trigger-log-${r.id}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono">{new Date(r.triggeredAtISO).toLocaleString()}</span>
                          <span className="text-slate-500">{r.source}</span>
                        </div>
                        <div className="mt-1 text-slate-200">
                          {r.context?.reason ? String(r.context.reason) : JSON.stringify(r.context)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-slate-500">No triggers yet.</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
