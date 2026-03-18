import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Settings, TaxCountry } from '@kp/core';
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

const COUNTRY_OPTIONS: { value: TaxCountry; label: string; flag: string }[] = [
  { value: 'FI', label: 'Finland', flag: '🇫🇮' },
  { value: 'SE', label: 'Sweden', flag: '🇸🇪' },
  { value: 'DE', label: 'Germany', flag: '🇩🇪' },
  { value: 'OTHER', label: 'Other', flag: '🌍' },
];

export default function TaxProfileCard({ settings, loading, error, busy, setBusy }: Props) {
  const { t } = useTranslation();
  const [saveMsg, setSaveMsg] = useState('');
  const [baseCurrency, setBaseCurrency] = useState('EUR');
  const [lotMethodDefault, setLotMethodDefault] = useState<LotMethod>('FIFO');
  const [rewardsCostBasisMode, setRewardsCostBasisMode] = useState<RewardsCostBasisMode>('ZERO');
  const [taxCountry, setTaxCountry] = useState<TaxCountry | undefined>(undefined);
  const [hmoEnabled, setHmoEnabled] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setBaseCurrency(String(settings.baseCurrency ?? 'EUR').toUpperCase());
    setLotMethodDefault(settings.lotMethodDefault ?? 'FIFO');
    setRewardsCostBasisMode(settings.rewardsCostBasisMode ?? 'ZERO');
    setTaxCountry(settings.taxCountry ?? undefined);
    setHmoEnabled(settings.hmoEnabled ?? false);
  }, [settings?.updatedAtISO]);

  const isFI = taxCountry === 'FI';

  const hasDirty = useMemo(() => {
    if (!settings) return false;
    return (
      String(settings.baseCurrency ?? 'EUR').toUpperCase() !== baseCurrency.toUpperCase() ||
      settings.lotMethodDefault !== lotMethodDefault ||
      settings.rewardsCostBasisMode !== rewardsCostBasisMode ||
      (settings.taxCountry ?? undefined) !== taxCountry ||
      (settings.hmoEnabled ?? false) !== hmoEnabled
    );
  }, [settings, baseCurrency, lotMethodDefault, rewardsCostBasisMode, taxCountry, hmoEnabled]);

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
        lotMethodDefault: isFI ? 'FIFO' : lotMethodDefault,
        rewardsCostBasisMode,
        taxCountry,
        hmoEnabled: isFI ? hmoEnabled : false,
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
      className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 space-y-4"
      data-testid="card-tax-profile"
    >
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <div className="text-body font-medium text-content-primary">Tax Profile</div>
          <div className="text-caption text-content-secondary">
            Configure how your crypto gains are calculated
          </div>
        </div>
        <button
          data-testid="btn-settings-save-tax-profile"
          disabled={busy || loading || !hasDirty}
          onClick={() => void save()}
          className="rounded-button bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-caption"
        >
          {t('settings.btn.save')}
        </button>
      </div>

      {error ? <div className="text-caption text-semantic-error">{String(error)}</div> : null}

      {/* Tax country */}
      <div>
        <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mb-2">
          Tax country
        </div>
        <div
          className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          data-testid="form-settings-tax-country"
        >
          {COUNTRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setTaxCountry(opt.value)}
              className={`flex items-center gap-2 rounded-button px-3 py-2 text-caption border transition-colors ${
                taxCountry === opt.value
                  ? 'border-[#FF8400] bg-[#FF8400]/[0.08] text-content-primary'
                  : 'border-white/[0.08] bg-surface-raised text-content-secondary hover:border-white/20'
              }`}
            >
              <span>{opt.flag}</span>
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
        {isFI && (
          <p className="text-[10px] text-white/40 mt-1.5">
            Finland: FIFO required by Finnish Tax Administration
          </p>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Base currency */}
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mb-1">
            {t('settings.portfolio.baseCurrency')}
          </div>
          <input
            data-testid="form-settings-base-currency"
            className="w-full rounded-button bg-surface-base border border-white/[0.08] px-3 py-2 text-caption focus:outline-none focus:border-brand/50 transition-colors"
            value={baseCurrency}
            onChange={(e) => setBaseCurrency(e.target.value.toUpperCase())}
            placeholder="EUR"
          />
        </label>

        {/* Lot method */}
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mb-1">
            {t('settings.portfolio.lotMethod')}
            {isFI && (
              <span className="ml-1 text-white/30 normal-case tracking-normal">(locked: FIFO)</span>
            )}
          </div>
          <select
            data-testid="form-settings-lot-method-default"
            disabled={isFI}
            className="w-full rounded-button bg-surface-base border border-white/[0.08] px-3 py-2 text-caption disabled:opacity-50"
            value={isFI ? 'FIFO' : lotMethodDefault}
            onChange={(e) => setLotMethodDefault(e.target.value as LotMethod)}
          >
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
            <option value="HIFO">HIFO</option>
            <option value="AVG_COST">AVG_COST</option>
          </select>
        </label>

        {/* Rewards cost basis */}
        <label className="block">
          <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mb-1">
            {t('settings.portfolio.rewardsCostBasis')}
          </div>
          <select
            data-testid="form-settings-rewards-mode"
            className="w-full rounded-button bg-surface-base border border-white/[0.08] px-3 py-2 text-caption"
            value={rewardsCostBasisMode}
            onChange={(e) => setRewardsCostBasisMode(e.target.value as RewardsCostBasisMode)}
          >
            <option value="ZERO">{t('settings.portfolio.rewardsZero')}</option>
            <option value="FMV">{t('settings.portfolio.rewardsFmv')}</option>
          </select>
        </label>
      </div>

      {/* HMO toggle — only for FI */}
      {isFI && (
        <label
          className="flex items-center justify-between gap-3 rounded-button border border-white/[0.08] bg-surface-raised px-3 py-2.5 cursor-pointer"
          data-testid="form-settings-hmo-enabled"
        >
          <div>
            <div className="text-caption font-medium text-content-primary">HMO default</div>
            <div className="text-[10px] text-white/40">
              Apply hankintameno-olettama where beneficial (prep for Feature 25)
            </div>
          </div>
          <input
            type="checkbox"
            checked={hmoEnabled}
            onChange={(e) => setHmoEnabled(e.target.checked)}
            className="rounded border-border accent-brand w-4 h-4"
          />
        </label>
      )}

      {saveMsg ? (
        <div
          data-testid="metric-settings-save-status"
          className="text-caption text-content-primary"
        >
          {saveMsg}
        </div>
      ) : null}
    </div>
  );
}
