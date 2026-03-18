import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, Plus, Search, X, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import { useImportSuccessStore } from '../store/useImportSuccessStore';
import { isPasskeySupported, getStoredPasskeyWrap } from '../vault/passkey';
import { AllocationBars, ValueChart, colorForAsset } from '../components/DashboardCharts';
import type { AllocationItem } from '../components/DashboardCharts';
import { KpiCard, Card, EmptyState, TokenIcon, Button, Input } from '../components/ui';
import { staggerContainer, fadeInUp } from '@/lib/animations';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmtMoney(val: string | undefined | null, currency: string): string {
  return `${d(val).toDecimalPlaces(2).toFixed()} ${currency}`;
}

function fmtCompact(val: string | undefined | null, currency: string): string {
  const n = d(val).toNumber();
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M ${currency}`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K ${currency}`;
  return `${d(val).toDecimalPlaces(2).toFixed()} ${currency}`;
}

function fmtPct(pct: number | null): string {
  if (pct == null) return '—';
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
}

// ── Import success banner ────────────────────────────────────────────────────
function ImportSuccessBanner() {
  const { pendingBanner, clearBanner } = useImportSuccessStore();

  useEffect(() => {
    if (!pendingBanner) return;
    const id = setTimeout(clearBanner, 8000);
    return () => clearTimeout(id);
  }, [pendingBanner, clearBanner]);

  if (!pendingBanner) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg
        bg-emerald-500/10 border border-emerald-500/20 text-emerald-400"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-sm font-mono">
        {pendingBanner.count} new transactions encrypted &amp; synced from {pendingBanner.provider}.
      </span>
      <button
        onClick={clearBanner}
        className="shrink-0 text-emerald-400/60 hover:text-emerald-400 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

// ── Setup progress banner ────────────────────────────────────────────────────
const SETUP_STEPS = [
  { label: 'Account', done: true },
  { label: 'Vault', done: true },
  { label: 'Import transactions', done: false },
  { label: 'Map assets', done: false },
];

function SetupProgressBanner({ onImport }: { onImport: () => void }) {
  return (
    <div
      data-testid="banner-setup-progress"
      className="flex items-center gap-3 px-4 py-3 rounded-lg
        bg-[#FF8400]/[0.06] border border-[#FF8400]/20 flex-wrap"
    >
      <div className="flex items-center gap-2 flex-wrap flex-1">
        {SETUP_STEPS.map((step) => (
          <span
            key={step.label}
            className={`text-[11px] font-mono ${step.done ? 'text-emerald-400' : 'text-white/40'}`}
          >
            {step.done ? '✅' : '○'} {step.label}
          </span>
        ))}
      </div>
      <button
        onClick={onImport}
        className="text-[11px] font-mono text-[#FF8400] hover:text-[#FF8400]/80 transition-colors shrink-0"
      >
        → Get started
      </button>
    </div>
  );
}

// ── Partial data warning ─────────────────────────────────────────────────────
function PartialDataWarning({ count, onMap }: { count: number; onMap: () => void }) {
  if (count === 0) return null;
  return (
    <div
      data-testid="banner-partial-data"
      className="flex items-center gap-3 px-4 py-3 rounded-lg
        bg-amber-500/[0.06] border border-amber-500/20 text-amber-400"
    >
      <AlertTriangle className="h-4 w-4 shrink-0" />
      <span className="flex-1 text-[11px] font-mono">
        {count} asset{count > 1 ? 's' : ''} need price mapping before values show.
      </span>
      <button
        onClick={onMap}
        className="text-[11px] font-mono text-amber-400 hover:text-amber-300 transition-colors shrink-0"
      >
        [Map assets →]
      </button>
    </div>
  );
}

// ── Passkey banner ───────────────────────────────────────────────────────────
const PASSKEY_BANNER_DISMISSED_KEY = 'pl_passkey_banner_dismissed';

function PasskeyBanner({ onSetup }: { onSetup: () => void }) {
  const [dismissed, setDismissed] = useState(
    () => localStorage.getItem(PASSKEY_BANNER_DISMISSED_KEY) === '1',
  );

  const dismiss = () => {
    localStorage.setItem(PASSKEY_BANNER_DISMISSED_KEY, '1');
    setDismissed(true);
  };

  if (dismissed || !isPasskeySupported() || !!getStoredPasskeyWrap()) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 px-4 py-3 rounded-lg
        bg-[#FF8400]/[0.06] border border-[#FF8400]/20"
    >
      <span className="text-lg shrink-0">🔑</span>
      <span className="flex-1 text-[11px] font-mono text-white/60">
        Add Face ID / fingerprint for faster unlock — no passphrase needed.
      </span>
      <button
        onClick={onSetup}
        className="text-[11px] font-mono text-[#FF8400] hover:text-[#FF8400]/80 transition-colors shrink-0"
      >
        [Set up →]
      </button>
      <button
        onClick={dismiss}
        className="shrink-0 text-white/20 hover:text-white/50 transition-colors"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </motion.div>
  );
}

// ── Get Started widget ───────────────────────────────────────────────────────
const EXCHANGES = [
  { name: 'Coinbase', emoji: '🟠' },
  { name: 'Binance', emoji: '⬡' },
  { name: 'Kraken', emoji: 'K' },
];

function GetStartedWidget({ onImport }: { onImport: () => void }) {
  return (
    <Card
      data-testid="widget-get-started"
      className="border-white/[0.08] bg-[#0F0F0F] p-6 space-y-4"
    >
      <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
        // GET STARTED
      </span>
      <p className="text-sm text-white/60">Connect your first exchange</p>
      <div className="flex flex-wrap gap-2">
        {EXCHANGES.map((ex) => (
          <button
            key={ex.name}
            onClick={onImport}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-white/[0.08]
              bg-white/[0.03] text-sm text-white/70 hover:border-[#FF8400]/40
              hover:text-white transition-colors font-mono"
          >
            <span>{ex.emoji}</span>
            <span>{ex.name}</span>
          </button>
        ))}
      </div>
      <Button
        onClick={onImport}
        className="bg-[#FF8400] hover:bg-[#FF8400]/90 text-black font-semibold text-sm"
      >
        <Plus className="h-3.5 w-3.5" />→ Import transactions
      </Button>
    </Card>
  );
}

export default function DashboardPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const apiBase = useAuthStore((s) => s.apiBase);
  const dbState = useDashboardData();
  const baseCurrency = (dbState.data.settings?.baseCurrency ?? 'EUR').toUpperCase();
  const { status, refreshing, refreshNow, toggleAutoRefresh } = useDashboardRefresh(
    apiBase,
    baseCurrency,
    dbState.data.latest?.dayISO,
  );

  const autoRefreshEnabled = (dbState.data.settings?.autoRefreshIntervalSec ?? 0) > 0;
  const [searchQuery, setSearchQuery] = useState('');
  const passphrase = useVaultStore((s) => s.passphrase);

  const hasTransactions = dbState.data.ledgerEventCount > 0;

  const metrics = useMemo(() => {
    const latest = dbState.data.latest;
    return {
      totalValueBase: latest?.totalValueBase ?? '0',
      realizedPnlBaseToDate: latest?.realizedPnlBaseToDate ?? '0',
      unrealizedPnlBase: latest?.unrealizedPnlBase ?? '0',
    };
  }, [dbState.data.latest]);

  const assetMap = useMemo(
    () => new Map(dbState.data.assets.map((a) => [a.id, a])),
    [dbState.data.assets],
  );

  const positions = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [];
    return [...latest.positions]
      .sort((a, b) => d(b.valueBase).cmp(d(a.valueBase)))
      .map((p) => {
        const asset = assetMap.get(p.assetId);
        return {
          ...p,
          symbol: asset?.symbol ?? p.assetId,
          name: asset?.name ?? asset?.symbol ?? p.assetId,
        };
      });
  }, [dbState.data.latest, assetMap]);

  const totalValue = d(metrics.totalValueBase);
  const positionCount = positions.filter((p) => d(p.amount).gt(0)).length;

  // Partial data: positions with amount > 0 but no value
  const unmappedCount = useMemo(
    () => positions.filter((p) => d(p.amount).gt(0) && d(p.valueBase).isZero()).length,
    [positions],
  );

  // 24h price change per assetId from recent pricePoints
  // eslint-disable-next-line react-hooks/purity
  const cutoff24h = useMemo(() => new Date(Date.now() - 23 * 60 * 60 * 1000).toISOString(), []);
  const priceChange24h = useMemo(() => {
    const result = new Map<string, number | null>();
    const byAsset = new Map<string, { ts: string; price: number }[]>();
    for (const pp of dbState.data.recentPricePoints) {
      if (!byAsset.has(pp.assetId)) byAsset.set(pp.assetId, []);
      byAsset.get(pp.assetId)!.push({ ts: pp.timestampISO, price: Number(pp.priceBase) });
    }
    for (const [assetId, points] of byAsset) {
      const sorted = points.sort((a, b) => a.ts.localeCompare(b.ts));
      const latest = sorted.at(-1);
      // Find a point roughly 24h ago
      const cutoff = cutoff24h;
      const older = sorted.filter((p) => p.ts <= cutoff).at(-1);
      if (latest && older && older.price > 0) {
        result.set(assetId, ((latest.price - older.price) / older.price) * 100);
      } else {
        result.set(assetId, null);
      }
    }
    return result;
  }, [dbState.data.recentPricePoints]);

  const allocation: AllocationItem[] = useMemo(() => {
    if (!positions.length || totalValue.isZero()) return [];
    const top = positions.filter((p) => d(p.valueBase).gt(0)).slice(0, 6);
    const othersValue = positions
      .slice(6)
      .reduce((acc, p) => acc.add(d(p.valueBase)), new Decimal(0));
    const items: AllocationItem[] = top.map((p, i) => ({
      assetId: p.assetId,
      name: p.symbol,
      value: d(p.valueBase).toNumber(),
      pct: d(p.valueBase).div(totalValue).mul(100).toNumber(),
      color: colorForAsset(p.assetId, i),
    }));
    if (othersValue.gt(0)) {
      items.push({
        assetId: 'others',
        name: 'Others',
        value: othersValue.toNumber(),
        pct: othersValue.div(totalValue).mul(100).toNumber(),
        color: '#666666',
      });
    }
    return items;
  }, [positions, totalValue]);

  const bestPerformer = useMemo(() => {
    if (!positions.length) return null;
    const withPnl = positions.filter((p) => p.unrealizedPnlBase && d(p.amount).gt(0));
    if (!withPnl.length) return null;
    const best = withPnl.reduce((a, b) =>
      d(a.unrealizedPnlBase).gt(d(b.unrealizedPnlBase)) ? a : b,
    );
    const costBasis = d(best.costBasisBase);
    const pnlPct = costBasis.isZero()
      ? new Decimal(0)
      : d(best.unrealizedPnlBase).div(costBasis).mul(100);
    return { symbol: best.symbol, pct: pnlPct };
  }, [positions]);

  const filteredPositions = useMemo(() => {
    if (!searchQuery) return positions.filter((p) => d(p.amount).gt(0));
    const q = searchQuery.toLowerCase();
    return positions.filter(
      (p) =>
        d(p.amount).gt(0) &&
        (p.symbol.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)),
    );
  }, [positions, searchQuery]);

  const valueSeries = useMemo(
    () => dbState.data.snaps.map((s) => ({ day: s.dayISO, value: Number(d(s.totalValueBase)) })),
    [dbState.data.snaps],
  );

  const realizedDelta = d(metrics.realizedPnlBaseToDate);
  const unrealizedDelta = d(metrics.unrealizedPnlBase);

  return (
    <div className="space-y-8">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-white/25">
          {t('dashboard.title')}
        </span>
        <div className="flex items-center gap-2">
          <label
            className="flex items-center gap-1.5 text-[11px] font-mono text-white/25 cursor-pointer"
            data-testid="toggle-auto-refresh"
          >
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => void toggleAutoRefresh(e.target.checked)}
              className="accent-[#FF8400] w-3 h-3"
            />
            {t('dashboard.autoRefresh.label')}
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            data-testid="btn-refresh-prices"
            onClick={() => void refreshNow()}
            className="h-7 px-2.5 text-[11px] font-mono border-white/10 text-white/40 hover:text-white/70 hover:border-white/20"
          >
            <RefreshCw className={`h-3 w-3 ${refreshing ? 'animate-spin' : ''}`} />
            {t('dashboard.btn.refresh')}
          </Button>
          <Button
            size="sm"
            onClick={() => nav('/transactions/import')}
            className="h-7 px-2.5 text-[11px] font-mono bg-[#FF8400] hover:bg-[#FF8400]/90 text-black font-semibold"
          >
            <Plus className="h-3 w-3" />
            {t('dashboard.btn.addTransaction')}
          </Button>
        </div>
      </div>

      {/* ── Banners ── */}
      <ImportSuccessBanner />
      {!hasTransactions && !dbState.loading && (
        <SetupProgressBanner onImport={() => nav('/transactions/import')} />
      )}
      <PartialDataWarning count={unmappedCount} onMap={() => nav('/settings/assets')} />
      {!!passphrase && <PasskeyBanner onSetup={() => nav('/settings')} />}

      {/* ── Hero: Total portfolio value ── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        data-testid="metric-total-value"
        className="space-y-1"
      >
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25">
          {t('dashboard.kpi.totalValue')} · {baseCurrency}
        </p>
        <div className="flex items-baseline gap-4 flex-wrap">
          <span className="text-[clamp(2.5rem,6vw,4rem)] font-mono font-bold text-white leading-none tabular-nums tracking-tight">
            {hasTransactions ? fmtCompact(metrics.totalValueBase, baseCurrency) : '—'}
          </span>
          {!unrealizedDelta.isZero() && (
            <span
              className={`text-sm font-mono px-2.5 py-1 rounded-full ${
                unrealizedDelta.isPositive()
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'bg-red-500/10 text-red-400'
              }`}
            >
              {unrealizedDelta.isPositive() ? '+' : ''}
              {fmtMoney(metrics.unrealizedPnlBase, baseCurrency)} unrealized
            </span>
          )}
        </div>
        {!hasTransactions && !dbState.loading && (
          <button
            onClick={() => nav('/transactions/import')}
            className="text-[11px] font-mono text-[#FF8400] hover:underline"
          >
            Add data →
          </button>
        )}
        {status.lastRebuildISO && (
          <p className="text-[10px] font-mono text-white/20">
            {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
          </p>
        )}
      </motion.div>

      {/* ── Secondary KPI row ── */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div variants={fadeInUp} data-testid="metric-realized">
          <KpiCard
            label={t('dashboard.kpi.realizedPnl')}
            value={hasTransactions ? fmtMoney(metrics.realizedPnlBaseToDate, baseCurrency) : '—'}
            numericValue={realizedDelta.toNumber()}
            unit={baseCurrency}
            delta={
              realizedDelta.isZero()
                ? undefined
                : `${realizedDelta.isPositive() ? '+' : ''}${realizedDelta.toDecimalPlaces(2).toFixed()}`
            }
            deltaType={
              realizedDelta.isPositive()
                ? 'positive'
                : realizedDelta.isNegative()
                  ? 'negative'
                  : 'neutral'
            }
          />
        </motion.div>
        <motion.div variants={fadeInUp} data-testid="metric-asset-count">
          <KpiCard
            label={t('dashboard.kpi.totalAssets')}
            value={hasTransactions ? String(positionCount) : '—'}
            numericValue={positionCount}
          />
        </motion.div>
        <motion.div variants={fadeInUp} data-testid="metric-best-performer">
          <KpiCard
            label={t('dashboard.kpi.bestPerformer')}
            value={bestPerformer?.symbol ?? '—'}
            delta={
              bestPerformer
                ? `${bestPerformer.pct.isPositive() ? '+' : ''}${bestPerformer.pct.toDecimalPlaces(1).toFixed()}%`
                : undefined
            }
            deltaType={
              bestPerformer?.pct.isPositive()
                ? 'positive'
                : bestPerformer?.pct.isNegative()
                  ? 'negative'
                  : 'neutral'
            }
          />
        </motion.div>
      </motion.div>

      {/* ── Charts ── */}
      <motion.div
        className="grid grid-cols-1 lg:grid-cols-3 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        <motion.div className="lg:col-span-2" variants={fadeInUp}>
          <ValueChart data={valueSeries} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <Card className="p-5 border-white/[0.08] bg-[#0F0F0F]">
            {allocation.length ? (
              <AllocationBars data={allocation} />
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title={t('dashboard.empty.allocation.title')}
                description={t('dashboard.empty.allocation.desc')}
              />
            )}
          </Card>
        </motion.div>
      </motion.div>

      {/* ── Get Started widget (empty state) ── */}
      {!hasTransactions && !dbState.loading && (
        <GetStartedWidget onImport={() => nav('/transactions/import')} />
      )}

      {/* ── Holdings ── */}
      {hasTransactions && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <Card
            className="border-white/[0.08] bg-[#0F0F0F] overflow-hidden"
            data-testid="card-portfolio-top"
          >
            {/* Table header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
                // {t('dashboard.topPositions.title')}
              </span>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-white/20 pointer-events-none" />
                <Input
                  type="text"
                  placeholder={t('dashboard.search')}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-7 w-36 sm:w-48 text-[11px] font-mono bg-white/[0.04] border-white/[0.08] text-white/60 placeholder:text-white/20 focus:border-[#FF8400]/30"
                />
              </div>
            </div>

            <div data-testid="list-top-positions">
              {filteredPositions.length ? (
                <>
                  {/* Column headers */}
                  <div className="grid grid-cols-[2fr_1fr_1fr_1fr_70px_80px] gap-2 px-5 py-2.5 border-b border-white/[0.04]">
                    {['Asset', 'Price', 'Holdings', 'Value', '24h', 'PnL'].map((col, i) => (
                      <span
                        key={col}
                        className={`text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 ${i >= 1 ? 'text-right' : ''}`}
                      >
                        {col}
                      </span>
                    ))}
                  </div>
                  {/* Rows */}
                  <motion.ul variants={staggerContainer} initial="hidden" animate="show">
                    {filteredPositions.map((p) => {
                      const pnl = d(p.unrealizedPnlBase);
                      const costBasis = d(p.costBasisBase);
                      const pnlPct = costBasis.isZero() ? null : pnl.div(costBasis).mul(100);
                      const pricePerUnit = d(p.amount).isZero()
                        ? new Decimal(0)
                        : d(p.valueBase).div(d(p.amount));
                      const change24h = priceChange24h.get(p.assetId) ?? null;
                      return (
                        <motion.li
                          key={p.assetId}
                          variants={fadeInUp}
                          className="grid grid-cols-[2fr_1fr_1fr_1fr_70px_80px] gap-2 items-center
                            py-3.5 px-5 border-b border-white/[0.04] last:border-0
                            hover:bg-[#FF8400]/[0.04] transition-colors cursor-pointer group"
                          onClick={() => nav(`/assets/${p.assetId}`)}
                        >
                          {/* Asset */}
                          <div className="flex items-center gap-2.5">
                            <TokenIcon symbol={p.symbol} size="md" />
                            <div>
                              <div className="text-[13px] font-mono text-white font-medium group-hover:text-[#FF8400] transition-colors">
                                {p.symbol}
                              </div>
                              <div className="text-[11px] font-mono text-white/30">{p.name}</div>
                            </div>
                          </div>
                          {/* Price */}
                          <div className="text-[13px] font-mono text-white/60 text-right tabular-nums">
                            {fmtMoney(pricePerUnit.toFixed(), baseCurrency)}
                          </div>
                          {/* Holdings */}
                          <div className="text-[13px] font-mono text-white/60 text-right tabular-nums">
                            {d(p.amount).toDecimalPlaces(4).toFixed()}
                          </div>
                          {/* Value */}
                          <div className="text-[13px] font-mono text-white text-right tabular-nums font-medium">
                            {fmtMoney(p.valueBase, baseCurrency)}
                          </div>
                          {/* 24h */}
                          <div className="text-right">
                            {change24h != null ? (
                              <span
                                className={`text-[11px] font-mono tabular-nums ${
                                  change24h >= 0 ? 'text-emerald-400' : 'text-red-400'
                                }`}
                              >
                                {fmtPct(change24h)}
                              </span>
                            ) : (
                              <span className="text-[13px] font-mono text-white/20">—</span>
                            )}
                          </div>
                          {/* PnL */}
                          <div className="text-right">
                            {pnlPct ? (
                              <span
                                className={`text-[11px] font-mono px-2 py-0.5 rounded-full tabular-nums ${
                                  pnl.isPositive()
                                    ? 'bg-emerald-500/10 text-emerald-400'
                                    : pnl.isNegative()
                                      ? 'bg-red-500/10 text-red-400'
                                      : 'bg-white/5 text-white/30'
                                }`}
                              >
                                {pnlPct.isPositive() ? '+' : ''}
                                {pnlPct.toDecimalPlaces(1).toFixed()}%
                              </span>
                            ) : (
                              <span className="text-[13px] font-mono text-white/20">—</span>
                            )}
                          </div>
                        </motion.li>
                      );
                    })}
                  </motion.ul>
                </>
              ) : (
                <div className="p-8">
                  <EmptyState
                    icon={<BarChart3 className="h-10 w-10" />}
                    title={t('dashboard.empty.positions.title')}
                    description={t('dashboard.empty.positions.desc')}
                  />
                </div>
              )}
            </div>
          </Card>
        </motion.div>
      )}

      {dbState.error && (
        <p className="text-[11px] font-mono text-red-400/60 text-right">{dbState.error}</p>
      )}
    </div>
  );
}
