import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDbQuery } from '../hooks/useDbQuery';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Settings } from '@kp/core';

function errToMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e);
}

async function apiFetch<T>(base: string, path: string, token: string, body: unknown): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(body)
  });
  const txt = await r.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(json)}`);
  return json as any;
}

export default function SettingsPage() {
  const { apiBase, setApiBase, token, email, syncNow } = useAppStore();
  const [syncMsg, setSyncMsg] = useState<string>('');
  const [serverAlertsMsg, setServerAlertsMsg] = useState<string>('');
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);

  // Portfolio / domain settings
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [lotMethodDefault, setLotMethodDefault] = useState<'FIFO' | 'LIFO' | 'HIFO' | 'AVG_COST'>('FIFO');
  const [rewardsCostBasisMode, setRewardsCostBasisMode] = useState<'ZERO' | 'FMV'>('ZERO');
  const [taxProfile, setTaxProfile] = useState<string>('GENERIC');
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(300);

  // Load settings_1 from DB
  const settingsQ = useDbQuery<Settings | null>(
    async (db) => {
      const s = await db.settings.get('settings_1');
      return (s as any) ?? null;
    },
    [],
    null
  );

  useEffect(() => {
    // Ensure defaults exist once vault is unlocked.
    void ensureDefaultSettings();
  }, []);

  useEffect(() => {
    if (!settingsQ.data) return;
    setBaseCurrency(String(settingsQ.data.baseCurrency ?? 'EUR').toUpperCase());
    setLotMethodDefault((settingsQ.data.lotMethodDefault as any) ?? 'FIFO');
    setRewardsCostBasisMode((settingsQ.data.rewardsCostBasisMode as any) ?? 'ZERO');
    setTaxProfile(String((settingsQ.data as any).taxProfile ?? 'GENERIC'));
    setAutoRefreshIntervalSec(Number((settingsQ.data as any).autoRefreshIntervalSec ?? 300));
  }, [settingsQ.data?.updatedAtISO]);

  const hasDirty = useMemo(() => {
    const s = settingsQ.data;
    if (!s) return false;
    return (
      String(s.baseCurrency ?? 'EUR').toUpperCase() !== baseCurrency.toUpperCase() ||
      (s.lotMethodDefault as any) !== lotMethodDefault ||
      (s.rewardsCostBasisMode as any) !== rewardsCostBasisMode ||
      String((s as any).taxProfile ?? 'GENERIC') !== taxProfile ||
      Number((s as any).autoRefreshIntervalSec ?? 300) !== autoRefreshIntervalSec
    );
  }, [settingsQ.data, baseCurrency, lotMethodDefault, rewardsCostBasisMode, taxProfile, autoRefreshIntervalSec]);

  const doSync = async () => {
    setSyncMsg('');
    setBusy(true);
    try {
      const res = await syncNow();
      setSyncMsg(res ? `uploaded=${res.uploaded}, pulled=${res.pulled}` : 'missing token or vault');
    } catch (e) {
      setSyncMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const savePortfolioSettings = async () => {
    setSaveMsg('');
    setBusy(true);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const existing = (await db.settings.get('settings_1')) as any;
      if (!existing) throw new Error('settings_not_initialized');

      const now = new Date().toISOString();
      const next: Settings = {
        ...existing,
        baseCurrency: baseCurrency.toUpperCase(),
        lotMethodDefault,
        rewardsCostBasisMode,
        autoRefreshIntervalSec: Math.max(15, Math.floor(Number(autoRefreshIntervalSec) || 300)),
        taxProfile: taxProfile || 'GENERIC',
        updatedAtISO: now
      } as any;
      await db.settings.put(next as any);

      // Deterministic: derived caches depend on baseCurrency + lot method.
      await rebuildDerivedCaches({ daysBack: 365 });
      setSaveMsg('Saved + rebuilt derived caches');
    } catch (e) {
      setSaveMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const enableServerAlerts = async () => {
    if (!token) return setServerAlertsMsg('login required');
    setBusy(true);
    setServerAlertsMsg('');
    try {
      // NOTE: For now we send empty alerts + minimal mirror state (will be populated by portfolio engine later).
      await apiFetch(apiBase, '/v1/alerts/server/enable', token, {
        alerts: [],
        state: {
          baseCurrency: 'EUR',
          provider: 'coingecko',
          nowISO: new Date().toISOString(),
          portfolioValueBase: '0',
          assetPrices: {}
        }
      });
      setServerAlertsMsg('enabled');
    } catch (e) {
      setServerAlertsMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const fetchTriggerLog = async () => {
    if (!token) return setServerAlertsMsg('login required');
    setBusy(true);
    setServerAlertsMsg('');
    try {
      const r = await fetch(`${apiBase}/v1/alerts/server/log?limit=50`, {
        method: 'GET',
        headers: { authorization: `Bearer ${token}` }
      });
      const json = await r.json();
      setLogs(json.logs ?? []);
    } catch (e) {
      setServerAlertsMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="font-medium">Account</div>
        <div className="text-sm text-slate-300">{token ? `Logged in as ${email}` : 'Not logged in'}</div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="font-medium">API base</div>
        <input
          data-testid="form-settings-api-base"
          value={apiBase}
          onChange={(e) => setApiBase(e.target.value)}
          className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm max-w-md w-full"
          placeholder="http://localhost:8788"
        />
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-4" data-testid="card-portfolio-settings">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <div className="font-medium">Portfolio settings</div>
            <div className="text-sm text-slate-300">
              These settings affect imports, lotting and tax calculations. Changing them rebuilds derived caches.
            </div>
          </div>
          <button
            data-testid="btn-settings-save-portfolio"
            disabled={busy || settingsQ.loading || !hasDirty}
            onClick={() => void savePortfolioSettings()}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
          >
            Save
          </button>
        </div>

        {settingsQ.error ? <div className="text-sm text-rose-300">{settingsQ.error}</div> : null}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="block">
            <div className="text-xs text-slate-300">Base currency</div>
            <input
              data-testid="form-settings-base-currency"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={baseCurrency}
              onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
              placeholder="EUR"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-300">Lot method default</div>
            <select
              data-testid="form-settings-lot-method-default"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={lotMethodDefault}
              onChange={(e) => setLotMethodDefault(e.target.value as any)}
            >
              <option value="FIFO">FIFO</option>
              <option value="LIFO">LIFO</option>
              <option value="HIFO">HIFO</option>
              <option value="AVG_COST">AVG_COST</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-300">Rewards cost basis</div>
            <select
              data-testid="form-settings-rewards-mode"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={rewardsCostBasisMode}
              onChange={(e) => setRewardsCostBasisMode(e.target.value as any)}
            >
              <option value="ZERO">ZERO (default)</option>
              <option value="FMV">FMV (requires price/user input)</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-300">Tax profile</div>
            <input
              data-testid="form-settings-tax-profile"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={taxProfile}
              onChange={(e) => setTaxProfile(e.target.value)}
              placeholder="GENERIC"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-300">Auto-refresh interval (sec)</div>
            <input
              data-testid="form-settings-auto-refresh"
              type="number"
              min={15}
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={autoRefreshIntervalSec}
              onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
            />
          </label>

          <div className="flex items-end">
            <button
              data-testid="btn-rebuild-snapshots-365d"
              disabled={busy}
              onClick={() => void rebuildDerivedCaches({ daysBack: 365 })}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
            >
              Rebuild derived (365d)
            </button>
          </div>
        </div>

        {saveMsg ? (
          <div data-testid="metric-settings-save-status" className="text-sm text-slate-200">
            {saveMsg}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="font-medium">Sync</div>
        <button
          data-testid="btn-sync-now"
          disabled={busy}
          onClick={() => void doSync()}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
        >
          Sync now
        </button>
        {syncMsg && (
          <div data-testid="metric-sync-status" className="text-sm text-slate-200">
            {syncMsg}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="font-medium">Server-side alerts + push (opt-in)</div>
        <div className="flex gap-2 flex-wrap">
          <button
            data-testid="btn-enable-server-alerts"
            disabled={busy}
            onClick={() => void enableServerAlerts()}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
          >
            Enable server alerts
          </button>
          <button
            data-testid="btn-fetch-trigger-log"
            disabled={busy}
            onClick={() => void fetchTriggerLog()}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
          >
            Fetch trigger log
          </button>
        </div>
        {serverAlertsMsg && <div className="text-sm text-slate-200">{serverAlertsMsg}</div>}

        <div>
          <div className="text-sm font-medium mb-2">Trigger log</div>
          <div data-testid="list-trigger-log" className="space-y-2">
            {logs.length === 0 ? (
              <div className="text-sm text-slate-400">No triggers yet.</div>
            ) : (
              logs.map((l) => (
                <div key={l.id} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-sm">
                  <div className="font-mono text-xs text-slate-300">{l.triggeredAtISO}</div>
                  <div className="text-slate-200">{l.source}: {l.alertId}</div>
                  <pre className="text-xs text-slate-400 whitespace-pre-wrap">{JSON.stringify(l.context, null, 2)}</pre>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
