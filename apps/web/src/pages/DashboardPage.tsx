import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { BarChart3, RefreshCw, Plus, Search, TrendingUp, Layers, Award } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { useAuthStore } from '../store/useAuthStore';
import { AllocationBars, ValueChart, colorForAsset } from '../components/DashboardCharts';
import type { AllocationItem } from '../components/DashboardCharts';
import { KpiCard, Card, CardTitle, EmptyState, TokenIcon, Button } from '../components/ui';

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
  const unrealizedDelta = d(metrics.unrealizedPnlBase);

  return (
    <div className="space-y-section">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1 text-content-primary">{t('dashboard.title')}</h1>
          <p className="text-caption text-content-tertiary mt-0.5">
            {t('dashboard.subtitle', { defaultValue: 'Portfolio overview & performance' })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {status.lastRebuildISO && (
            <span className="text-[0.625rem] text-content-tertiary hidden sm:inline">
              {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
            </span>
          )}
          <label
            className="flex items-center gap-1.5 text-caption text-content-secondary cursor-pointer"
            data-testid="toggle-auto-refresh"
          >
            <input
              type="checkbox"
              checked={autoRefreshEnabled}
              onChange={(e) => void toggleAutoRefresh(e.target.checked)}
              className="accent-brand"
            />
            {t('dashboard.autoRefresh.label')}
          </label>
          <Button
            variant="secondary"
            size="sm"
            loading={refreshing}
            icon={<RefreshCw className="h-3.5 w-3.5" />}
            data-testid="btn-refresh-prices"
            onClick={() => void refreshNow()}
          >
            {t('dashboard.btn.refresh')}
          </Button>
          <Button
            variant="primary"
            size="sm"
            icon={<Plus className="h-3.5 w-3.5" />}
            onClick={() => nav('/transactions/import')}
          >
            {t('dashboard.btn.addTransaction', { defaultValue: 'Add Transaction' })}
          </Button>
        </div>
      </div>

      {/* KPI Cards — 4 columns */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          {
            testId: 'metric-total-value',
            label: t('dashboard.kpi.totalValue'),
            value: fmtMoney(metrics.totalValueBase, baseCurrency),
            icon: <BarChart3 className="h-4 w-4" />,
          },
          {
            testId: 'metric-realized',
            label: t('dashboard.kpi.realizedPnl'),
            value: fmtMoney(metrics.realizedPnlBaseToDate, baseCurrency),
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
            label: t('dashboard.kpi.totalAssets', { defaultValue: 'Total Assets' }),
            value: String(positionCount),
            icon: <Layers className="h-4 w-4" />,
          },
          {
            testId: 'metric-best-performer',
            label: t('dashboard.kpi.bestPerformer', { defaultValue: 'Best Performer' }),
            value: bestPerformer?.symbol ?? '—',
            delta: bestPerformer
              ? `${bestPerformer.pct.isPositive() ? '+' : ''}${bestPerformer.pct.toDecimalPlaces(1).toFixed()}%`
              : undefined,
            deltaType: (bestPerformer?.pct.isPositive()
              ? 'positive'
              : bestPerformer?.pct.isNegative()
                ? 'negative'
                : 'neutral') as 'positive' | 'negative' | 'neutral',
            icon: <Award className="h-4 w-4" />,
          },
        ].map((kpi, i) => (
          <div
            key={kpi.testId}
            data-testid={kpi.testId}
            className="animate-slide-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Charts row: Value chart (2/3) + Allocation bars (1/3) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 animate-slide-up" style={{ animationDelay: '240ms' }}>
          <ValueChart data={valueSeries} />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '300ms' }}>
          <Card>
            <AllocationBars data={allocation} />
            {!allocation.length && (
              <EmptyState
                icon={<BarChart3 className="h-8 w-8" />}
                title={t('dashboard.empty.allocation.title')}
                description={t('dashboard.empty.allocation.desc')}
              />
            )}
          </Card>
        </div>
      </div>

      {/* Holdings table */}
      <Card data-testid="card-portfolio-top">
        <div className="flex items-center justify-between mb-3">
          <CardTitle>{t('dashboard.topPositions.title', { defaultValue: 'Holdings' })}</CardTitle>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-tertiary" />
            <input
              type="text"
              placeholder={t('dashboard.search', { defaultValue: 'Search assets...' })}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 rounded-button bg-surface-base border border-border-subtle
                text-caption text-content-primary placeholder:text-content-tertiary
                focus:outline-none focus:border-brand/40 transition-colors w-36 sm:w-48"
            />
          </div>
        </div>

        <div data-testid="list-top-positions">
          {filteredPositions.length ? (
            <>
              {/* Table header */}
              <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 px-2 pb-2 border-b border-border-subtle">
                <span className="text-[0.625rem] text-content-tertiary font-medium uppercase tracking-wider">
                  Asset
                </span>
                <span className="text-[0.625rem] text-content-tertiary font-medium uppercase tracking-wider text-right">
                  Holdings
                </span>
                <span className="text-[0.625rem] text-content-tertiary font-medium uppercase tracking-wider text-right">
                  Value
                </span>
                <span className="text-[0.625rem] text-content-tertiary font-medium uppercase tracking-wider text-right">
                  PnL
                </span>
              </div>
              {/* Table body */}
              <ul>
                {filteredPositions.map((p, i) => {
                  const pnl = d(p.unrealizedPnlBase);
                  const costBasis = d(p.costBasisBase);
                  const pnlPct = costBasis.isZero()
                    ? null
                    : pnl.div(costBasis).mul(100);
                  return (
                    <li
                      key={p.assetId}
                      className="group grid grid-cols-[2fr_1fr_1fr_1fr] gap-2 items-center py-2.5 px-2
                        rounded-button hover:bg-surface-overlay/30 transition-all duration-150 ease-expo
                        animate-slide-up"
                      style={{ animationDelay: `${i * 40 + 360}ms` }}
                    >
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={p.symbol} size="md" />
                        <div>
                          <div className="text-body text-content-primary font-medium">
                            {p.symbol}
                          </div>
                        </div>
                      </div>
                      <div className="text-right font-mono text-caption text-content-secondary">
                        {d(p.amount).toDecimalPlaces(4).toFixed()} {p.symbol}
                      </div>
                      <div className="text-right font-mono text-body text-content-primary">
                        {fmtMoney(p.valueBase, baseCurrency)}
                      </div>
                      <div
                        className={`text-right font-mono text-caption ${
                          pnl.isPositive()
                            ? 'text-semantic-success'
                            : pnl.isNegative()
                              ? 'text-semantic-error'
                              : 'text-content-tertiary'
                        }`}
                      >
                        {pnlPct
                          ? `${pnlPct.isPositive() ? '+' : ''}${pnlPct.toDecimalPlaces(1).toFixed()}%`
                          : '—'}
                      </div>
                    </li>
                  );
                })}
              </ul>
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

      {/* Status footer */}
      {status.lastRebuildISO && (
        <p className="text-caption text-content-tertiary text-right animate-fade-in">
          {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
          {dbState.error && <span className="text-semantic-error ml-2">{dbState.error}</span>}
        </p>
      )}
    </div>
  );
}
