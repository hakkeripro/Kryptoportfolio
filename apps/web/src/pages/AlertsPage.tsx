import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { z } from 'zod';
import Decimal from 'decimal.js';
import { Plus, Bell, Trash2 } from 'lucide-react';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Alert, Asset } from '@kp/core';
import { AlertSchema, uuid } from '@kp/core';

import { useAuthStore } from '../store/useAuthStore';
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
  updateServerMirrorState,
} from '../alerts/serverAlertsApi';
import { Button, Card, TokenIcon } from '../components/ui';

type FormType = Alert['type'];

function formatAlert(a: Alert, assetsById: Record<string, Asset>, baseCurrency: string) {
  if (a.type === 'PORTFOLIO_VALUE') {
    const dir = a.direction === 'BELOW' ? 'below' : 'above';
    return `Portfolio value ${dir} ${a.thresholdBase} ${baseCurrency}`;
  }
  if (a.type === 'PRICE') {
    const asset = a.assetId ? assetsById[a.assetId] : undefined;
    const sym = asset?.symbol ?? String(a.assetId ?? '').replace(/^asset_/, '').toUpperCase();
    const dir = a.direction === 'BELOW' ? 'below' : 'above';
    return `${sym} price ${dir} ${a.thresholdBase} ${baseCurrency}`;
  }
  if (a.type === 'DRAWDOWN') return `Drawdown ≥ ${a.thresholdPct}%`;
  if (a.type === 'PCT_CHANGE') {
    const asset = a.assetId ? assetsById[a.assetId] : undefined;
    const sym = asset?.symbol ?? String(a.assetId ?? '').replace(/^asset_/, '').toUpperCase();
    return `${sym} pct-change ≥ ${a.thresholdPct}%`;
  }
  return a.type;
}

function alertAssetSymbol(a: Alert, assetsById: Record<string, Asset>): string {
  if (a.assetId) {
    const asset = assetsById[a.assetId];
    return asset?.symbol ?? String(a.assetId).replace(/^asset_/, '').toUpperCase();
  }
  return '';
}

const NumberInput = z.string().trim().refine((s) => /^-?\d+(\.\d+)?$/.test(s), 'invalid_number');

async function ensurePushEnabled(apiBase: string, token: string) {
  const vapid = await getVapidPublicKey(apiBase);
  if (!vapid.enabled || !vapid.publicKey) return { ok: false as const, reason: 'VAPID_NOT_CONFIGURED' };
  if (!('serviceWorker' in navigator)) return { ok: false as const, reason: 'NO_SW' };
  if (!('PushManager' in window)) return { ok: false as const, reason: 'NO_PUSH' };
  const isSecure = window.location.protocol === 'https:' || window.location.hostname === 'localhost';
  if (!isSecure) return { ok: false as const, reason: 'HTTPS_REQUIRED' };
  const perm = await Notification.requestPermission();
  if (perm !== 'granted') return { ok: false as const, reason: 'PERMISSION_DENIED' };
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid.publicKey),
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
  const { t } = useTranslation();
  const apiBase = useAuthStore((s) => s.apiBase);
  const token = useAuthStore((s) => s.token);

  const alertsQ = useDbQuery(
    async (db) => {
      const rows = await db.alerts.toArray();
      rows.sort((a: any, b: any) => String(b.updatedAtISO || '').localeCompare(String(a.updatedAtISO || '')));
      return rows as any;
    }, [], [] as any[],
  );
  const assetsQ = useDbQuery(async (db) => await db.assets.toArray(), [], [] as any[]);
  const settingsQ = useDbQuery(
    async (db) => (await db.settings.get('settings_1')) as any, [], null as any,
  );

  const assetsById = useMemo(() => {
    const m: Record<string, Asset> = {};
    for (const a of (assetsQ.data ?? []) as Asset[]) m[a.id] = a;
    return m;
  }, [assetsQ.data]);

  const baseCurrency = String((settingsQ.data as any)?.baseCurrency ?? 'EUR').toUpperCase();

  const [showForm, setShowForm] = useState(true);
  const [formType, setFormType] = useState<FormType>('PORTFOLIO_VALUE');
  const [formDirection, setFormDirection] = useState<'ABOVE' | 'BELOW'>('ABOVE');
  const [formThreshold, setFormThreshold] = useState('1000');
  const [formAssetId, setFormAssetId] = useState<string>('');
  const [formCooldown, setFormCooldown] = useState('0');
  const [serverMsg, setServerMsg] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<{
    enabled: number; total: number; mirrorUpdatedAtISO: string | null;
  } | null>(null);
  const [logRows, setLogRows] = useState<any[]>([]);
  const [loading, setLoading] = useState<string | null>(null);

  const localAlerts = (alertsQ.data ?? []) as Alert[];

  async function refreshServerStatus() {
    if (!token) { setServerStatus(null); return; }
    try { setServerStatus(await getServerAlertsStatus(apiBase, token)); } catch (e: any) { setServerMsg(String(e?.message ?? e)); }
  }
  async function refreshLog() {
    if (!token) return;
    try { setLogRows(await getServerAlertLog(apiBase, token, 50)); } catch (e: any) { setServerMsg(String(e?.message ?? e)); }
  }

  async function addAlert() {
    setServerMsg(null);
    const now = new Date().toISOString();
    const cooldownMin = NumberInput.safeParse(formCooldown).success ? Math.max(0, Number(formCooldown)) : 0;
    let alert: any = {
      id: `al_${uuid()}`, schemaVersion: 1, createdAtISO: now, updatedAtISO: now,
      isDeleted: false, type: formType, isEnabled: true, source: 'server', cooldownMin,
    };
    if (formType === 'PORTFOLIO_VALUE') {
      alert = { ...alert, thresholdBase: new Decimal(NumberInput.parse(formThreshold)).abs().toFixed(), direction: formDirection };
    } else if (formType === 'PRICE') {
      if (!formAssetId) throw new Error('asset_required');
      alert = { ...alert, assetId: formAssetId, thresholdBase: new Decimal(NumberInput.parse(formThreshold)).abs().toFixed(), direction: formDirection };
    } else if (formType === 'DRAWDOWN') {
      alert = { ...alert, thresholdPct: new Decimal(NumberInput.parse(formThreshold)).abs().toFixed() };
    } else if (formType === 'PCT_CHANGE') {
      if (!formAssetId) throw new Error('asset_required');
      alert = { ...alert, assetId: formAssetId, thresholdPct: new Decimal(NumberInput.parse(formThreshold)).abs().toFixed() };
    }
    const parsed = AlertSchema.parse(alert);
    await ensureWebDbOpen();
    await getWebDb().alerts.put(parsed as any);
    setShowForm(false);
  }

  async function toggleAlert(id: string, isEnabled: boolean) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const row = (await db.alerts.get(id)) as any;
    if (!row) return;
    await db.alerts.put({ ...row, isEnabled, updatedAtISO: new Date().toISOString() });
  }

  async function deleteAlert(id: string) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const row = (await db.alerts.get(id)) as any;
    if (!row) return;
    await db.alerts.put({ ...row, isDeleted: true, isEnabled: false, updatedAtISO: new Date().toISOString() });
  }

  async function syncRulesToServer() {
    if (!token) { setServerMsg(t('alerts.error.loginRequiredSync')); return; }
    setLoading('server'); setServerMsg(null);
    try {
      const active = localAlerts.filter((a) => !a.isDeleted && a.isEnabled && (a as any).source !== 'foreground');
      if (!active.length) {
        const ok = window.confirm('You have 0 active alerts locally.\n\nThis will clear all server-side rules.\n\nAre you sure?');
        if (!ok) { setLoading(null); return; }
      }
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });
      const state = await buildMirrorState();
      const res = await enableServerAlerts(apiBase, token, active, state, { mode: 'replace' });
      setServerMsg(`Server rules synced (${active.length} rules). Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`);
      await refreshServerStatus(); await refreshLog();
    } catch (e: any) { setServerMsg(String(e?.message ?? e)); } finally { setLoading(null); }
  }

  async function enableDelivery() {
    if (!token) { setServerMsg(t('alerts.error.loginRequired')); return; }
    setLoading('enableDelivery'); setServerMsg(null);
    try {
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });
      const state = await buildMirrorState();
      const res = await enableServerAlerts(apiBase, token, [], state, { mode: 'enable_only' });
      setServerMsg(`Server delivery enabled (existing rules kept). Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`);
      await refreshServerStatus(); await refreshLog();
    } catch (e: any) { setServerMsg(String(e?.message ?? e)); } finally { setLoading(null); }
  }

  async function updateState() {
    if (!token) { setServerMsg(t('alerts.error.loginRequired')); return; }
    setLoading('state'); setServerMsg(null);
    try {
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });
      const state = await buildMirrorState();
      const res = await updateServerMirrorState(apiBase, token, state);
      setServerMsg(`State updated. Evaluated ${res.evaluated ?? 0}, triggered ${res.triggered ?? 0}.`);
      await refreshServerStatus(); await refreshLog();
    } catch (e: any) { setServerMsg(String(e?.message ?? e)); } finally { setLoading(null); }
  }

  async function enablePush() {
    if (!token) { setServerMsg(t('alerts.error.loginRequired')); return; }
    setLoading('push'); setServerMsg(null);
    try {
      const res = await ensurePushEnabled(apiBase, token);
      if (res.ok) setServerMsg(t('alerts.msg.pushEnabled'));
      else setServerMsg(`Push not enabled: ${res.reason}`);
    } catch (e: any) { setServerMsg(String(e?.message ?? e)); } finally { setLoading(null); }
  }

  async function testPush() {
    if (!token) { setServerMsg(t('alerts.error.loginRequired')); return; }
    setLoading('pushTest'); setServerMsg(null);
    try {
      const r = await sendTestWebPush(apiBase, token);
      if (r.ok) setServerMsg(`Test notification queued (attempted ${r.attempted ?? 0}, success ${r.success ?? 0}).`);
      else setServerMsg(t('alerts.msg.pushTestFailed'));
    } catch (e: any) { setServerMsg(String(e?.message ?? e)); } finally { setLoading(null); }
  }

  useEffect(() => { void refreshServerStatus(); void refreshLog(); }, [token]);

  const visibleAlerts = localAlerts.filter((a) => !a.isDeleted);
  const inputCls = 'w-full rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary focus:outline-none focus:border-brand/50 transition-colors';

  return (
    <div className="space-y-section" data-testid="panel-alerts">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1 font-heading text-content-primary">{t('alerts.title')}</h1>
          <p className="text-caption text-content-tertiary mt-0.5">
            Get notified when prices hit your targets
          </p>
        </div>
        <Button variant="primary" size="sm" icon={<Plus className="h-3.5 w-3.5" />}
          onClick={() => setShowForm(!showForm)}>
          Create Alert
        </Button>
      </div>

      {/* Create alert form (collapsible) */}
      {showForm && (
        <Card data-testid="panel-alerts-form">
          <div className="text-body font-medium text-content-primary mb-3">New Alert</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <label className="block">
              <div className="text-caption text-content-secondary mb-1">{t('alerts.form.type')}</div>
              <select className={inputCls} value={formType} onChange={(e) => setFormType(e.target.value as any)} data-testid="form-alert-type">
                <option value="PORTFOLIO_VALUE">{t('alerts.type.portfolioValue')}</option>
                <option value="PRICE">{t('alerts.type.price')}</option>
                <option value="DRAWDOWN">{t('alerts.type.drawdown')}</option>
                <option value="PCT_CHANGE">{t('alerts.type.pctChange')}</option>
              </select>
            </label>
            {(formType === 'PORTFOLIO_VALUE' || formType === 'PRICE') && (
              <label className="block">
                <div className="text-caption text-content-secondary mb-1">{t('alerts.form.direction')}</div>
                <select className={inputCls} value={formDirection} onChange={(e) => setFormDirection(e.target.value as any)} data-testid="form-alert-direction">
                  <option value="ABOVE">{t('alerts.direction.above')}</option>
                  <option value="BELOW">{t('alerts.direction.below')}</option>
                </select>
              </label>
            )}
            {(formType === 'PRICE' || formType === 'PCT_CHANGE') && (
              <label className="block">
                <div className="text-caption text-content-secondary mb-1">{t('alerts.form.asset')}</div>
                <select className={inputCls} value={formAssetId} onChange={(e) => setFormAssetId(e.target.value)} data-testid="form-alert-asset">
                  <option value="">{t('alerts.form.assetPlaceholder')}</option>
                  {(assetsQ.data ?? []).map((a: any) => <option key={a.id} value={a.id}>{a.symbol} — {a.name}</option>)}
                </select>
              </label>
            )}
            <label className="block">
              <div className="text-caption text-content-secondary mb-1">{t('alerts.form.threshold')}</div>
              <input className={inputCls} value={formThreshold} onChange={(e) => setFormThreshold(e.target.value)}
                placeholder={formType === 'PCT_CHANGE' || formType === 'DRAWDOWN' ? t('alerts.form.thresholdPercent') : t('alerts.form.thresholdBase')}
                data-testid="form-alert-threshold" />
            </label>
            <label className="block">
              <div className="text-caption text-content-secondary mb-1">{t('alerts.form.cooldown')}</div>
              <input className={inputCls} value={formCooldown} onChange={(e) => setFormCooldown(e.target.value)} data-testid="form-alert-cooldown" />
            </label>
          </div>
          <div className="mt-3">
            <Button variant="primary" size="sm" onClick={() => void addAlert()} data-testid="btn-save-alert">
              {t('alerts.btn.addAlert')}
            </Button>
          </div>
        </Card>
      )}

      {/* Alert cards */}
      <div className="space-y-3" data-testid="list-alerts">
        {visibleAlerts.length ? (
          visibleAlerts.map((a, i) => {
            const sym = alertAssetSymbol(a, assetsById);
            return (
              <div
                key={a.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface-raised p-4
                  hover:border-border transition-colors animate-slide-up"
                style={{ animationDelay: `${i * 40}ms` }}
                data-testid={`row-alert-${a.id}`}
              >
                {sym ? (
                  <TokenIcon symbol={sym} size="md" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                    <Bell className="h-5 w-5 text-brand" />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-body text-content-primary font-medium truncate">
                    {formatAlert(a, assetsById, baseCurrency)}
                  </div>
                  <div className="text-caption text-content-tertiary">
                    {t('alerts.row.cooldown', { n: a.cooldownMin ?? 0 })}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer" data-testid={`toggle-alert-${a.id}`}>
                    <input type="checkbox" checked={!!a.isEnabled} onChange={(e) => void toggleAlert(a.id, e.target.checked)}
                      className="sr-only peer" />
                    <div className="w-9 h-5 bg-surface-overlay rounded-full peer peer-checked:bg-brand transition-colors
                      after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full
                      after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full" />
                  </label>
                  <button
                    className="p-1.5 rounded-button text-content-tertiary hover:text-semantic-error hover:bg-semantic-error/5 transition-colors"
                    onClick={() => void deleteAlert(a.id)}
                    data-testid={`btn-delete-alert-${a.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="py-8 text-center text-caption text-content-tertiary">
            {t('alerts.empty')}
          </div>
        )}
      </div>

      {/* Server alerts panel */}
      <Card data-testid="panel-alerts-server">
        <div className="flex items-center justify-between mb-3">
          <div>
            <div className="text-body font-medium text-content-primary">{t('alerts.server.title')}</div>
            <div className="text-caption text-content-tertiary">{t('alerts.server.description')}</div>
          </div>
        </div>

        {!token ? (
          <div className="rounded-button border border-border bg-surface-base p-3 text-caption text-content-secondary" data-testid="box-alerts-login-required">
            {t('alerts.server.loginRequired')}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="rounded-button border border-border bg-surface-base p-3 text-caption" data-testid="box-alerts-server-status">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">{t('alerts.server.enabledRules')}</span>
                <span className="font-mono text-content-primary">{serverStatus ? `${serverStatus.enabled}/${serverStatus.total}` : '—'}</span>
              </div>
              <div className="flex items-center justify-between mt-1">
                <span className="text-content-secondary">{t('alerts.server.mirrorUpdated')}</span>
                <span className="font-mono text-content-primary">{serverStatus?.mirrorUpdatedAtISO ? new Date(serverStatus.mirrorUpdatedAtISO).toLocaleString() : '—'}</span>
              </div>
              <button className="mt-2 text-caption text-content-tertiary hover:text-content-secondary transition-colors"
                onClick={() => void refreshServerStatus()} data-testid="btn-refresh-server-status">
                {t('common.refresh')}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="primary" size="sm" onClick={() => void syncRulesToServer()} disabled={loading != null} loading={loading === 'server'}
                data-testid="btn-enable-server-alerts">
                {t('alerts.server.btn.syncRules')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void updateState()} disabled={loading != null} loading={loading === 'state'}
                data-testid="btn-update-server-state">
                {t('alerts.server.btn.updateState')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void enableDelivery()} disabled={loading != null} loading={loading === 'enableDelivery'}
                data-testid="btn-enable-delivery">
                {t('alerts.server.btn.enableDelivery')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void enablePush()} disabled={loading != null} loading={loading === 'push'}
                data-testid="btn-enable-push">
                {t('alerts.server.btn.enablePush')}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => void testPush()} disabled={loading != null} loading={loading === 'pushTest'}
                data-testid="btn-push-test">
                {t('alerts.server.btn.testPush')}
              </Button>
            </div>

            {serverMsg && (
              <div className="rounded-button border border-border bg-surface-base p-3 text-caption text-content-primary" data-testid="txt-alert-server-message">
                {serverMsg}
              </div>
            )}

            {/* Trigger log */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="text-caption font-medium text-content-secondary">{t('alerts.triggerLog.title')}</div>
                <button className="text-caption text-content-tertiary hover:text-content-secondary transition-colors"
                  onClick={() => void refreshLog()} data-testid="btn-refresh-alert-log">
                  {t('common.refresh')}
                </button>
              </div>
              <div className="space-y-2" data-testid="list-trigger-log">
                {logRows.length ? (
                  logRows.map((r: any) => (
                    <div key={r.id} className="rounded-button border border-border-subtle p-3 text-caption" data-testid={`row-trigger-log-${r.id}`}>
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-content-secondary">{new Date(r.triggeredAtISO).toLocaleString()}</span>
                        <span className="text-content-tertiary">{r.source}</span>
                      </div>
                      <div className="mt-1 text-content-primary">
                        {r.context?.reason ? String(r.context.reason) : JSON.stringify(r.context)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-caption text-content-tertiary">{t('alerts.triggerLog.empty')}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
