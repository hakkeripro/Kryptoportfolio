import { useEffect, useMemo, useState } from 'react';
import type { Settings } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';

import { useDbQuery } from '../hooks/useDbQuery';
import { useAppStore } from '../store/useAppStore';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { buildMirrorState } from '../alerts/buildMirrorState';
import { refreshLivePrices } from '../derived/refreshLivePrices';
import {
  disableServerAlerts,
  enableServerAlerts,
  getServerAlertsStatus
} from '../alerts/serverAlertsApi';
import { clearPasskeyWrap, createOrReplacePasskeyWrap, getStoredPasskeyWrap, isPasskeySupported } from '../vault/passkey';

function errToMsg(e: unknown) {
  if (e instanceof Error) return e.message;
  return String(e);
}

const AUTO_REFRESH_OPTIONS = [
  { value: 0, label: 'Off' },
  { value: 60, label: 'Every 1 min' },
  { value: 300, label: 'Every 5 min' },
  { value: 900, label: 'Every 15 min' }
];

export default function SettingsPage() {
  const { apiBase, setApiBase, token, email, syncNow } = useAppStore();

  const [busy, setBusy] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string>('');
  const [syncMsg, setSyncMsg] = useState<string>('');

  const settingsQ = useDbQuery<Settings | null>(
    async () => {
      try {
        return await ensureDefaultSettings();
      } catch {
        return null;
      }
    },
    [],
    null
  );

  // Form state
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [lotMethodDefault, setLotMethodDefault] = useState<'FIFO' | 'LIFO' | 'HIFO' | 'AVG_COST'>('FIFO');
  const [rewardsCostBasisMode, setRewardsCostBasisMode] = useState<'ZERO' | 'FMV'>('ZERO');
  const [taxProfile, setTaxProfile] = useState<string>('GENERIC');
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(300);

  // Notifications / server alerts
  const [serverMsg, setServerMsg] = useState<string>('');
  const [serverStatus, setServerStatus] = useState<{ enabled: number; total: number; mirrorUpdatedAtISO: string | null; runnerLastRunAtISO?: string | null; runnerLastError?: string | null } | null>(null);

  // Passkey
  const [passkeyMsg, setPasskeyMsg] = useState<string>('');
  const hasPasskey = !!getStoredPasskeyWrap();

  useEffect(() => {
    if (!settingsQ.data) return;
    setBaseCurrency(String(settingsQ.data.baseCurrency ?? 'EUR').toUpperCase());
    setLotMethodDefault((settingsQ.data.lotMethodDefault as any) ?? 'FIFO');
    setRewardsCostBasisMode((settingsQ.data.rewardsCostBasisMode as any) ?? 'ZERO');
    setTaxProfile(String((settingsQ.data as any).taxProfile ?? 'GENERIC'));
    setAutoRefreshIntervalSec(Number((settingsQ.data as any).autoRefreshIntervalSec ?? 300));
  }, [settingsQ.data?.updatedAtISO]);

  const serverAlertsEnabledLocal = !!settingsQ.data?.notifications?.serverAlertsEnabled;
  const devicePushEnabledLocal = !!settingsQ.data?.notifications?.devicePushEnabled;

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
        autoRefreshIntervalSec,
        taxProfile: taxProfile || 'GENERIC',
        updatedAtISO: now
      } as any;
      await db.settings.put(next as any);
      await rebuildDerivedCaches({ daysBack: 365 });
      setSaveMsg('Saved + rebuilt derived caches');
    } catch (e) {
      setSaveMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const refreshServerStatus = async () => {
    if (!token) {
      setServerStatus(null);
      return;
    }
    try {
      const s = await getServerAlertsStatus(apiBase, token);
      setServerStatus(s);
    } catch (e) {
      setServerMsg(errToMsg(e));
    }
  };

  useEffect(() => {
    void refreshServerStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, apiBase]);

  async function saveNotificationPref(partial: Partial<NonNullable<Settings['notifications']>>) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const existing = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
    const now = new Date().toISOString();
    const next: Settings = {
      ...existing,
      updatedAtISO: now,
      notifications: {
        serverAlertsEnabled: !!existing?.notifications?.serverAlertsEnabled,
        devicePushEnabled: !!existing?.notifications?.devicePushEnabled,
        ...partial
      }
    } as any;
    await db.settings.put(next as any);
  }

  const toggleServerAlerts = async (nextEnabled: boolean) => {
    setServerMsg('');
    if (!token) {
      setServerMsg('Login required to manage server alerts.');
      return;
    }
    setBusy(true);
    try {
      if (nextEnabled) {
        // Safety: do not delete server rules when the list is empty.
        await refreshLivePrices(apiBase, baseCurrency);
        await rebuildDerivedCaches({ daysBack: 365 });
        const state = await buildMirrorState();
        await enableServerAlerts(apiBase, token, [], state, { mode: 'enable_only' });
        await saveNotificationPref({ serverAlertsEnabled: true });
        setServerMsg('Server alerts enabled.');
      } else {
        await disableServerAlerts(apiBase, token);
        await saveNotificationPref({ serverAlertsEnabled: false });
        setServerMsg('Server alerts disabled.');
      }
      await refreshServerStatus();
    } catch (e) {
      setServerMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const clearServerRules = async () => {
    if (!token) return setServerMsg('Login required.');
    const ok = window.confirm('This will delete ALL server-side alert rules for your account. Continue?');
    if (!ok) return;
    setBusy(true);
    setServerMsg('');
    try {
      await refreshLivePrices(apiBase, baseCurrency);
      await rebuildDerivedCaches({ daysBack: 365 });
      const state = await buildMirrorState();
      await enableServerAlerts(apiBase, token, [], state, { mode: 'replace' });
      setServerMsg('Server rules cleared.');
      await refreshServerStatus();
    } catch (e) {
      setServerMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const toggleDevicePushPref = async (nextEnabled: boolean) => {
    setServerMsg('');
    setBusy(true);
    try {
      await saveNotificationPref({ devicePushEnabled: nextEnabled });
    } catch (e) {
      setServerMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const enablePasskey = async () => {
    setPasskeyMsg('');
    const passphrase = useAppStore.getState().passphrase;
    if (!passphrase) {
      setPasskeyMsg('Unlock the vault first.');
      return;
    }
    setBusy(true);
    try {
      await createOrReplacePasskeyWrap(passphrase);
      setPasskeyMsg('Passkey enabled for this device.');
    } catch (e) {
      setPasskeyMsg(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const disablePasskey = async () => {
    setPasskeyMsg('');
    setBusy(true);
    try {
      clearPasskeyWrap();
      setPasskeyMsg('Passkey removed from this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
        <div className="font-medium">Account</div>
        <div className="text-sm text-slate-300">{token ? `Logged in as ${email}` : 'Not logged in'}</div>
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

        {settingsQ.error ? <div className="text-sm text-rose-300">{String(settingsQ.error)}</div> : null}

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
            <select
              data-testid="form-settings-tax-profile"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={taxProfile}
              onChange={(e) => setTaxProfile(e.target.value)}
            >
              <option value="GENERIC">GENERIC</option>
              <option value="FINLAND">FINLAND</option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs text-slate-300">Price auto-refresh</div>
            <select
              data-testid="form-settings-auto-refresh"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
              value={String(autoRefreshIntervalSec)}
              onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
            >
              {AUTO_REFRESH_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {saveMsg ? (
          <div data-testid="metric-settings-save-status" className="text-sm text-slate-200">
            {saveMsg}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3" data-testid="card-security">
        <div className="font-medium">Security</div>
        <div className="text-sm text-slate-300">
          Enable a Passkey on this device to unlock without typing your Vault passphrase.
        </div>
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-slate-800 bg-slate-950/30 p-3">
          <div>
            <div className="text-sm font-medium">Passkey unlock (this device)</div>
            <div className="text-xs text-slate-400">
              {isPasskeySupported() ? (hasPasskey ? 'Enabled' : 'Not enabled') : 'Not supported in this browser'}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              disabled={busy || !isPasskeySupported() || hasPasskey}
              onClick={() => void enablePasskey()}
              className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
              data-testid="btn-passkey-enable"
            >
              Enable
            </button>
            <button
              disabled={busy || !hasPasskey}
              onClick={() => void disablePasskey()}
              className="rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-60 px-3 py-2 text-sm"
              data-testid="btn-passkey-disable"
            >
              Remove
            </button>
          </div>
        </div>
        {passkeyMsg ? <div className="text-sm text-slate-200">{passkeyMsg}</div> : null}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3" data-testid="card-notifications">
        <div className="font-medium">Notifications</div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-2" data-testid="card-server-alerts">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Server alerts</div>
              <div className="text-xs text-slate-400">Push notifications even when the app is closed.</div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={serverAlertsEnabledLocal}
                disabled={busy}
                onChange={(e) => void toggleServerAlerts(e.target.checked)}
                data-testid="toggle-server-alerts"
              />
              {serverAlertsEnabledLocal ? 'Enabled' : 'Disabled'}
            </label>
          </div>

          <div className="grid gap-1 text-xs text-slate-300" data-testid="box-server-alerts-status">
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
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              disabled={busy}
              onClick={() => void refreshServerStatus()}
              className="rounded-lg border border-slate-800 hover:bg-slate-800 disabled:opacity-60 px-3 py-2 text-sm"
              data-testid="btn-refresh-server-alerts-status"
            >
              Refresh status
            </button>
            <button
              disabled={busy || !token}
              onClick={() => void clearServerRules()}
              className="rounded-lg border border-rose-800 text-rose-200 hover:bg-rose-950/30 disabled:opacity-60 px-3 py-2 text-sm"
              data-testid="btn-clear-server-rules"
            >
              Clear server rules
            </button>
          </div>

          {serverMsg ? (
            <div className="text-sm text-slate-200" data-testid="txt-server-alerts-message">
              {serverMsg}
            </div>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm font-medium">Device push</div>
              <div className="text-xs text-slate-400">Per-device permission (browser). Managed in Alerts page.</div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={devicePushEnabledLocal}
                disabled={busy}
                onChange={(e) => void toggleDevicePushPref(e.target.checked)}
                data-testid="toggle-device-push"
              />
              {devicePushEnabledLocal ? 'On' : 'Off'}
            </label>
          </div>
          <div className="text-xs text-slate-400">
            Go to <span className="font-medium">Alerts</span> to enable push notifications for this device.
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3" data-testid="card-sync">
        <div className="font-medium">Sync</div>
        <button
          data-testid="btn-sync-now"
          disabled={busy}
          onClick={() => void doSync()}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 px-3 py-2 text-sm"
        >
          Sync now
        </button>
        {syncMsg ? (
          <div data-testid="metric-sync-status" className="text-sm text-slate-200">
            {syncMsg}
          </div>
        ) : null}
      </div>

      {import.meta.env.DEV ? (
        <details className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="card-advanced">
          <summary className="cursor-pointer font-medium">Advanced (dev)</summary>
          <div className="mt-3 space-y-2">
            <div className="text-sm text-slate-300">API base URL (Vite proxy/localhost only).</div>
            <input
              data-testid="form-settings-api-base"
              value={apiBase}
              onChange={(e) => setApiBase(e.target.value)}
              className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm max-w-md w-full"
              placeholder="http://localhost:8788"
            />
          </div>
        </details>
      ) : null}
    </div>
  );
}
