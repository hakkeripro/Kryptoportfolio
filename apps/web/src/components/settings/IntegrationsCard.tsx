import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import type { Settings } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { useSyncStore } from '../../store/useSyncStore';

interface Props {
  settings: Settings | null;
  autoRefreshIntervalSec: number;
  busy: boolean;
  setBusy: (v: boolean) => void;
}

export default function IntegrationsCard({ settings, autoRefreshIntervalSec: initialInterval, busy, setBusy }: Props) {
  const { t } = useTranslation();
  const syncNow = useSyncStore((s) => s.syncNow);
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState(initialInterval);
  const [syncMsg, setSyncMsg] = useState('');
  const [saveMsg, setSaveMsg] = useState('');

  const hasDirty = settings
    ? (settings.autoRefreshIntervalSec ?? 300) !== autoRefreshIntervalSec
    : false;

  const save = async () => {
    setSaveMsg('');
    setBusy(true);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const existing = await db.settings.get('settings_1');
      if (!existing) throw new Error('settings_not_initialized');
      const now = new Date().toISOString();
      await db.settings.put({ ...existing, autoRefreshIntervalSec, updatedAtISO: now } as typeof existing);
      setSaveMsg(t('settings.portfolio.savedMsg'));
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const doSync = async () => {
    setSyncMsg('');
    setBusy(true);
    try {
      const res = await syncNow();
      setSyncMsg(res ? `uploaded=${res.uploaded}, pulled=${res.pulled}` : 'missing token or vault');
    } catch (e) {
      setSyncMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 space-y-4"
      data-testid="card-integrations"
    >
      {/* Auto-refresh */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-body font-medium text-content-primary">Price auto-refresh</div>
          <button
            data-testid="btn-settings-save-integrations"
            disabled={busy || !hasDirty}
            onClick={() => void save()}
            className="rounded-button bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-caption"
          >
            {t('settings.btn.save')}
          </button>
        </div>
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mb-1">
            {t('settings.portfolio.autoRefresh')}
          </div>
          <select
            data-testid="form-settings-auto-refresh"
            className="w-full max-w-[200px] rounded-button bg-surface-base border border-white/[0.08] px-3 py-2 text-caption"
            value={String(autoRefreshIntervalSec)}
            onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
          >
            <option value="0">{t('settings.autoRefresh.off')}</option>
            <option value="60">{t('settings.autoRefresh.1min')}</option>
            <option value="300">{t('settings.autoRefresh.5min')}</option>
            <option value="900">{t('settings.autoRefresh.15min')}</option>
          </select>
        </label>
        {saveMsg ? (
          <div className="text-caption text-content-primary">{saveMsg}</div>
        ) : null}
      </div>

      {/* Sync */}
      <div className="space-y-2 pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between gap-3">
          <div className="text-body font-medium text-content-primary">Sync</div>
          <button
            data-testid="btn-sync-now"
            disabled={busy}
            onClick={() => void doSync()}
            className="rounded-button bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-caption"
          >
            Sync now
          </button>
        </div>
        {syncMsg ? (
          <div data-testid="metric-sync-status" className="text-caption text-content-secondary">
            {syncMsg}
          </div>
        ) : null}
      </div>

      {/* Exchanges link */}
      <div className="pt-2 border-t border-white/[0.06]">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-body font-medium text-content-primary">Exchange connections</div>
            <div className="text-caption text-content-secondary">
              Configure Coinbase API keys and autosync
            </div>
          </div>
          <Link
            to="/transactions/import"
            className="rounded-button border border-white/[0.08] px-3 py-2 text-caption text-content-secondary hover:text-content-primary hover:border-white/20 transition-colors"
          >
            Manage →
          </Link>
        </div>
      </div>
    </div>
  );
}
