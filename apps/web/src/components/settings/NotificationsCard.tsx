import { useEffect, useState } from 'react';
import type { Settings } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { ensureDefaultSettings } from '../../derived/ensureDefaultSettings';
import { rebuildDerivedCaches } from '../../derived/rebuildDerived';
import { refreshLivePrices } from '../../derived/refreshLivePrices';
import { buildMirrorState } from '../../alerts/buildMirrorState';
import {
  disableServerAlerts,
  enableServerAlerts,
  getServerAlertsStatus,
} from '../../alerts/serverAlertsApi';

interface Props {
  settings: Settings | null;
  token: string;
  apiBase: string;
  baseCurrency: string;
  busy: boolean;
  setBusy: (v: boolean) => void;
}

export default function NotificationsCard({
  settings,
  token,
  apiBase,
  baseCurrency,
  busy,
  setBusy,
}: Props) {
  const [serverMsg, setServerMsg] = useState('');
  const [serverStatus, setServerStatus] = useState<{
    enabled: number;
    total: number;
    mirrorUpdatedAtISO: string | null;
  } | null>(null);

  const serverAlertsEnabledLocal = !!settings?.notifications?.serverAlertsEnabled;
  const devicePushEnabledLocal = !!settings?.notifications?.devicePushEnabled;

  const refreshServerStatus = async () => {
    if (!token) {
      setServerStatus(null);
      return;
    }
    try {
      const s = await getServerAlertsStatus(apiBase, token);
      setServerStatus(s);
    } catch (e) {
      setServerMsg(e instanceof Error ? e.message : String(e));
    }
  };

  useEffect(() => {
    void refreshServerStatus();
  }, [token, apiBase]);

  async function saveNotificationPref(partial: Partial<NonNullable<Settings['notifications']>>) {
    await ensureWebDbOpen();
    const db = getWebDb();
    const existing = (await db.settings.get('settings_1')) ?? (await ensureDefaultSettings());
    const now = new Date().toISOString();
    const next: Settings = {
      ...existing,
      updatedAtISO: now,
      notifications: {
        serverAlertsEnabled: !!existing?.notifications?.serverAlertsEnabled,
        devicePushEnabled: !!existing?.notifications?.devicePushEnabled,
        ...partial,
      },
    };
    await db.settings.put(next);
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
      setServerMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const clearServerRules = async () => {
    if (!token) {
      setServerMsg('Login required.');
      return;
    }
    const ok = window.confirm(
      'This will delete ALL server-side alert rules for your account. Continue?',
    );
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
      setServerMsg(e instanceof Error ? e.message : String(e));
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
      setServerMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-raised p-4 space-y-3"
      data-testid="card-notifications"
    >
      <div className="font-medium">Notifications</div>

      <div
        className="rounded-lg border border-border bg-surface-base p-3 space-y-2"
        data-testid="card-server-alerts"
      >
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Server alerts</div>
            <div className="text-xs text-content-secondary">
              Push notifications even when the app is closed.
            </div>
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

        <div
          className="grid gap-1 text-xs text-content-secondary"
          data-testid="box-server-alerts-status"
        >
          <div className="flex items-center justify-between">
            <span className="text-content-secondary">Enabled rules</span>
            <span className="font-mono">
              {serverStatus ? `${serverStatus.enabled}/${serverStatus.total}` : '—'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-content-secondary">Mirror updated</span>
            <span className="font-mono">
              {serverStatus?.mirrorUpdatedAtISO
                ? new Date(serverStatus.mirrorUpdatedAtISO).toLocaleString()
                : '—'}
            </span>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            disabled={busy}
            onClick={() => void refreshServerStatus()}
            className="rounded-lg border border-border hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
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
          <div className="text-sm text-content-primary" data-testid="txt-server-alerts-message">
            {serverMsg}
          </div>
        ) : null}
      </div>

      <div className="rounded-lg border border-border bg-surface-base p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Device push</div>
            <div className="text-xs text-content-secondary">
              Per-device permission (browser). Managed in Alerts page.
            </div>
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
        <div className="text-xs text-content-secondary">
          Go to <span className="font-medium">Alerts</span> to enable push notifications for this
          device.
        </div>
      </div>
    </div>
  );
}
