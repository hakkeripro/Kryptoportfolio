import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Settings } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { rebuildDerivedCaches } from '../../derived/rebuildDerived';

type LotMethod = Settings['lotMethodDefault'];
type RewardsCostBasisMode = Settings['rewardsCostBasisMode'];

interface Props {
  settings: Settings | null;
  loading: boolean;
  error: unknown;
  busy: boolean;
  setBusy: (v: boolean) => void;
}

export default function PortfolioSettingsCard({ settings, loading, error, busy, setBusy }: Props) {
  const { t } = useTranslation();
  const [saveMsg, setSaveMsg] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [lotMethodDefault, setLotMethodDefault] = useState<LotMethod>('FIFO');
  const [rewardsCostBasisMode, setRewardsCostBasisMode] = useState<RewardsCostBasisMode>('ZERO');
  const [taxProfile, setTaxProfile] = useState<string>('GENERIC');
  const [autoRefreshIntervalSec, setAutoRefreshIntervalSec] = useState<number>(300);

  useEffect(() => {
    if (!settings) return;
    setBaseCurrency(String(settings.baseCurrency ?? 'EUR').toUpperCase());
    setLotMethodDefault(settings.lotMethodDefault ?? 'FIFO');
    setRewardsCostBasisMode(settings.rewardsCostBasisMode ?? 'ZERO');
    setTaxProfile(settings.taxProfile ?? 'GENERIC');
    setAutoRefreshIntervalSec(settings.autoRefreshIntervalSec ?? 300);
  }, [settings?.updatedAtISO]);

  const hasDirty = useMemo(() => {
    if (!settings) return false;
    return (
      String(settings.baseCurrency ?? 'EUR').toUpperCase() !== baseCurrency.toUpperCase() ||
      settings.lotMethodDefault !== lotMethodDefault ||
      settings.rewardsCostBasisMode !== rewardsCostBasisMode ||
      (settings.taxProfile ?? 'GENERIC') !== taxProfile ||
      (settings.autoRefreshIntervalSec ?? 300) !== autoRefreshIntervalSec
    );
  }, [
    settings,
    baseCurrency,
    lotMethodDefault,
    rewardsCostBasisMode,
    taxProfile,
    autoRefreshIntervalSec,
  ]);

  const save = async () => {
    setSaveMsg('');
    setBusy(true);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const existing = await db.settings.get('settings_1');
      if (!existing) throw new Error('settings_not_initialized');

      const now = new Date().toISOString();
      const next: Settings = {
        ...existing,
        baseCurrency: baseCurrency.toUpperCase(),
        lotMethodDefault,
        rewardsCostBasisMode,
        autoRefreshIntervalSec,
        taxProfile: taxProfile || 'GENERIC',
        updatedAtISO: now,
      } as Settings;
      await db.settings.put(next);
      await rebuildDerivedCaches({ daysBack: 365 });
      setSaveMsg(t('settings.portfolio.savedMsg'));
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-raised p-4 space-y-4"
      data-testid="card-portfolio-settings"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="font-medium">{t('settings.portfolio.title')}</div>
          <div className="text-sm text-content-secondary">
            {t('settings.portfolio.description')}
          </div>
        </div>
        <button
          data-testid="btn-settings-save-portfolio"
          disabled={busy || loading || !hasDirty}
          onClick={() => void save()}
          className="rounded-lg bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
        >
          {t('settings.btn.save')}
        </button>
      </div>

      {error ? <div className="text-sm text-semantic-error">{String(error)}</div> : null}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <div className="text-xs text-content-secondary">
            {t('settings.portfolio.baseCurrency')}
          </div>
          <input
            data-testid="form-settings-base-currency"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
            placeholder="EUR"
          />
        </label>

        <label className="block">
          <div className="text-xs text-content-secondary">{t('settings.portfolio.lotMethod')}</div>
          <select
            data-testid="form-settings-lot-method-default"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            value={lotMethodDefault}
            onChange={(e) => setLotMethodDefault(e.target.value as LotMethod)}
          >
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
            <option value="HIFO">HIFO</option>
            <option value="AVG_COST">AVG_COST</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-content-secondary">
            {t('settings.portfolio.rewardsCostBasis')}
          </div>
          <select
            data-testid="form-settings-rewards-mode"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            value={rewardsCostBasisMode}
            onChange={(e) => setRewardsCostBasisMode(e.target.value as RewardsCostBasisMode)}
          >
            <option value="ZERO">{t('settings.portfolio.rewardsZero')}</option>
            <option value="FMV">{t('settings.portfolio.rewardsFmv')}</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-content-secondary">{t('settings.portfolio.taxProfile')}</div>
          <select
            data-testid="form-settings-tax-profile"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            value={taxProfile}
            onChange={(e) => setTaxProfile(e.target.value)}
          >
            <option value="GENERIC">GENERIC</option>
            <option value="FINLAND">FINLAND</option>
          </select>
        </label>

        <label className="block">
          <div className="text-xs text-content-secondary">
            {t('settings.portfolio.autoRefresh')}
          </div>
          <select
            data-testid="form-settings-auto-refresh"
            className="mt-1 w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            value={String(autoRefreshIntervalSec)}
            onChange={(e) => setAutoRefreshIntervalSec(Number(e.target.value))}
          >
            <option value="0">{t('settings.autoRefresh.off')}</option>
            <option value="60">{t('settings.autoRefresh.1min')}</option>
            <option value="300">{t('settings.autoRefresh.5min')}</option>
            <option value="900">{t('settings.autoRefresh.15min')}</option>
          </select>
        </label>
      </div>

      {saveMsg ? (
        <div data-testid="metric-settings-save-status" className="text-sm text-content-primary">
          {saveMsg}
        </div>
      ) : null}
    </div>
  );
}
