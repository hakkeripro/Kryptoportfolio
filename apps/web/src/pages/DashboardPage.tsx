import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { motion } from 'framer-motion';
import { BarChart3, RefreshCw, Plus, Search } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { useAuthStore } from '../store/useAuthStore';
import { AllocationBars, ValueChart, colorForAsset } from '../components/DashboardCharts';
import type { AllocationItem } from '../components/DashboardCharts';
import { KpiCard, Card, CardTitle, EmptyState, TokenIcon, Button, Input } from '../components/ui';
import { staggerContainer, fadeInUp, pageTransition } from '@/lib/animations';

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

  const kpiCards = [
    {
      testId: 'metric-total-value',
      label: t('dashboard.kpi.totalValue'),
      value: fmtMoney(metrics.totalValueBase, baseCurrency),
      numericValue: totalValue.toNumber(),
    },
    {
      testId: 'metric-realized',
      label: t('dashboard.kpi.realizedPnl'),
      value: fmtMoney(metrics.realizedPnlBaseToDate, baseCurrency),
      numericValue: realizedDelta.toNumber(),
      delta: realizedDelta.isZero()
        ? undefined
        : `${realizedDelta.isPositive() ? '+' : ''}${realizedDelta.toDecimalPlaces(2).toFixed()}`,
      deltaType: (realizedDelta.isPositive()
        ? 'positive'
        : realizedDelta.isNegative()
          ? 'negative'
          : 'neutral') as 'positive' | 'negative' | 'neutral',
    },
    {
      testId: 'metric-asset-count',
      label: t('dashboard.kpi.totalAssets'),
      value: String(positionCount),
      numericValue: positionCount,
    },
    {
      testId: 'metric-best-performer',
      label: t('dashboard.kpi.bestPerformer'),
      value: bestPerformer?.symbol ?? '\u2014',
      delta: bestPerformer
        ? `${bestPerformer.pct.isPositive() ? '+' : ''}${bestPerformer.pct.toDecimalPlaces(1).toFixed()}%`
        : undefined,
      deltaType: (bestPerformer?.pct.isPositive()
        ? 'positive'
        : bestPerformer?.pct.isNegative()
          ? 'negative'
          : 'neutral') as 'positive' | 'negative' | 'neutral',
    },
  ];

  return (
    <motion.div
      className="space-y-6"
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-heading text-[28px] font-semibold text-card-foreground">
            {t('dashboard.title')}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('dashboard.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2">
          {status.lastRebuildISO && (
            <span className="text-[0.625rem] text-muted-foreground hidden sm:inline">
              {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
            </span>
          )}
          <label
            className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer"
            data-testid="toggle-auto-refresh"
          >
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => void toggleAutoRefresh(e.target.checked)}
              className="accent-[#FF8400]"
            />
            {t('dashboard.autoRefresh.label')}
          </label>
          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            data-testid="btn-refresh-prices"
            onClick={() => void refreshNow()}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {t('dashboard.btn.refresh')}
          </Button>
          <Button size="sm" onClick={() => nav('/transactions/import')}>
            <Plus className="h-3.5 w-3.5" />
            {t('dashboard.btn.addTransaction')}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <motion.div
        className="grid grid-cols-2 sm:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {kpiCards.map((kpi) => (
          <motion.div key={kpi.testId} variants={fadeInUp} data-testid={kpi.testId}>
            <KpiCard {...kpi} />
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
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
          <Card className="p-5 border-[#2E2E2E] bg-[#1A1A1A]">
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

      {/* Holdings Table */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <Card className="p-5 border-[#2E2E2E] bg-[#1A1A1A]" data-testid="card-portfolio-top">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="font-heading text-card-foreground">
              {t('dashboard.topPositions.title')}
            </CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder={t('dashboard.search')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 h-8 w-36 sm:w-48 text-xs bg-transparent border-[#2E2E2E]"
              />
            </div>
          </div>

          <div data-testid="list-top-positions">
            {filteredPositions.length ? (
              <>
                {/* Table header */}
                <div className="grid grid-cols-[2fr_100px_120px_120px_80px] gap-2 px-5 pb-2.5 border-b border-[#2E2E2E]">
                  {['Asset', 'Price', 'Holdings', 'Value', '24h'].map((col, i) => (
                    <span
                      key={col}
                      className={`text-[11px] text-muted-foreground font-semibold uppercase tracking-wider ${
                        i === 4 ? 'text-right' : ''
                      }`}
                    >
                      {col}
                    </span>
                  ))}
                </div>
                {/* Table body */}
                <motion.ul variants={staggerContainer} initial="hidden" animate="show">
                  {filteredPositions.map((p) => {
                    const pnl = d(p.unrealizedPnlBase);
                    const costBasis = d(p.costBasisBase);
                    const pnlPct = costBasis.isZero() ? null : pnl.div(costBasis).mul(100);
                    const pricePerUnit = d(p.amount).isZero()
                      ? new Decimal(0)
                      : d(p.valueBase).div(d(p.amount));
                    return (
                      <motion.li
                        key={p.assetId}
                        variants={fadeInUp}
                        className="grid grid-cols-[2fr_100px_120px_120px_80px] gap-2 items-center
                          py-3 px-5 border-b border-[#2E2E2E] hover:bg-white/[0.03]
                          transition-colors cursor-pointer"
                        onClick={() => nav(`/assets/${p.assetId}`)}
                      >
                        <div className="flex items-center gap-2.5">
                          <TokenIcon symbol={p.symbol} size="md" />
                          <div>
                            <div className="text-[13px] font-mono text-card-foreground font-medium">
                              {p.symbol}
                            </div>
                            <div className="text-xs text-muted-foreground">{p.name}</div>
                          </div>
                        </div>
                        <div className="text-[13px] font-mono text-card-foreground">
                          {fmtMoney(pricePerUnit.toFixed(), baseCurrency)}
                        </div>
                        <div className="text-[13px] font-mono text-card-foreground">
                          {d(p.amount).toDecimalPlaces(4).toFixed()} {p.symbol}
                        </div>
                        <div className="text-[13px] font-mono text-card-foreground">
                          {fmtMoney(p.valueBase, baseCurrency)}
                        </div>
                        <div
                          className={`text-[13px] font-mono text-right ${
                            pnl.isPositive()
                              ? 'text-[#B6FFCE]'
                              : pnl.isNegative()
                                ? 'text-[#FF5C33]'
                                : 'text-muted-foreground'
                          }`}
                        >
                          {pnlPct
                            ? `${pnlPct.isPositive() ? '+' : ''}${pnlPct.toDecimalPlaces(1).toFixed()}%`
                            : '\u2014'}
                        </div>
                      </motion.li>
                    );
                  })}
                </motion.ul>
              </>
            ) : (
              <EmptyState
                icon={<BarChart3 className="h-10 w-10" />}
                title={t('dashboard.empty.positions.title')}
                description={t('dashboard.empty.positions.desc')}
              />
            )}
          </div>
        </Card>
      </motion.div>

      {/* Status footer */}
      {status.lastRebuildISO && (
        <p className="text-xs text-muted-foreground text-right">
          {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
          {dbState.error && <span className="text-[#FF5C33] ml-2">{dbState.error}</span>}
        </p>
      )}
    </motion.div>
  );
}
