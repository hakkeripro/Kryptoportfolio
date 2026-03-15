import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import { BarChart3, RefreshCw } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { useAuthStore } from '../store/useAuthStore';
import PageHeader from '../components/PageHeader';
import { AllocationChart, ValueChart } from '../components/DashboardCharts';
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
  const apiBase = useAuthStore((s) => s.apiBase);
  const dbState = useDashboardData();
  const baseCurrency = (dbState.data.settings?.baseCurrency ?? 'EUR').toUpperCase();
  const { status, refreshing, refreshNow, toggleAutoRefresh } = useDashboardRefresh(
    apiBase,
    baseCurrency,
    dbState.data.latest?.dayISO,
  );

  const autoRefreshEnabled = (dbState.data.settings?.autoRefreshIntervalSec ?? 0) > 0;

  const metrics = useMemo(() => {
    const latest = dbState.data.latest;
    return {
      totalValueBase: latest?.totalValueBase ?? '0',
      realizedPnlBaseToDate: latest?.realizedPnlBaseToDate ?? '0',
      unrealizedPnlBase: latest?.unrealizedPnlBase ?? '0',
    };
  }, [dbState.data.latest]);

  const allocation = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [];
    const nameById = new Map(dbState.data.assets.map((a) => [a.id, a.symbol]));
    return latest.positions
      .map((p) => ({
        assetId: p.assetId,
        name: nameById.get(p.assetId) ?? p.assetId,
        value: Number(d(p.valueBase).toNumber()),
      }))
      .filter((x) => Number.isFinite(x.value) && x.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, 12);
  }, [dbState.data.latest, dbState.data.assets]);

  const topPositions = useMemo(() => {
    const latest = dbState.data.latest;
    if (!latest?.positions?.length) return [];
    const byId = new Map(dbState.data.assets.map((a) => [a.id, a]));
    return [...latest.positions]
      .sort((a, b) => d(b.valueBase).cmp(d(a.valueBase)))
      .slice(0, 8)
      .map((p) => ({
        ...p,
        symbol: byId.get(p.assetId)?.symbol ?? p.assetId,
      }));
  }, [dbState.data.latest, dbState.data.assets]);

  const valueSeries = useMemo(
    () => dbState.data.snaps.map((s) => ({ day: s.dayISO, value: Number(d(s.totalValueBase)) })),
    [dbState.data.snaps],
  );

  const realizedDelta = d(metrics.realizedPnlBaseToDate);
  const unrealizedDelta = d(metrics.unrealizedPnlBase);

  return (
    <div className="space-y-section">
      <PageHeader
        title={t('dashboard.title')}
        actions={
          <div className="flex items-center gap-2">
            <label
              className="flex items-center gap-2 text-caption text-content-secondary cursor-pointer"
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
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            deltaType: realizedDelta.isPositive() ? 'positive' as const : realizedDelta.isNegative() ? 'negative' as const : 'neutral' as const,
          },
          {
            testId: 'metric-unrealized',
            label: t('dashboard.kpi.unrealizedPnl'),
            value: fmtMoney(metrics.unrealizedPnlBase, baseCurrency),
            delta: unrealizedDelta.isZero()
              ? undefined
              : `${unrealizedDelta.isPositive() ? '+' : ''}${unrealizedDelta.toDecimalPlaces(2).toFixed()}`,
            deltaType: unrealizedDelta.isPositive() ? 'positive' as const : unrealizedDelta.isNegative() ? 'negative' as const : 'neutral' as const,
          },
        ].map((kpi, i) => (
          <div key={kpi.testId} data-testid={kpi.testId} className="animate-slide-up" style={{ animationDelay: `${i * 80}ms` }}>
            <KpiCard {...kpi} />
          </div>
        ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="animate-slide-up" style={{ animationDelay: '240ms' }}>
          <AllocationChart data={allocation} />
        </div>
        <div className="animate-slide-up" style={{ animationDelay: '320ms' }}>
          <ValueChart data={valueSeries} />
        </div>
      </div>

      {/* Top positions */}
      <Card data-testid="card-portfolio-top">
        <CardTitle>{t('dashboard.topPositions.title')}</CardTitle>
        <div data-testid="list-top-positions" className="mt-3">
          {topPositions.length ? (
            <ul className="divide-y divide-border/50">
              {topPositions.map((p, i) => (
                <li
                  key={p.assetId}
                  className="group py-3 flex items-center justify-between rounded-button
                    hover:bg-surface-overlay/30 px-2 -mx-2 transition-all duration-150 ease-expo
                    animate-slide-up"
                  style={{ animationDelay: `${i * 50 + 400}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <TokenIcon symbol={p.symbol} size="sm" />
                    <span className="text-body text-content-primary font-medium">{p.symbol}</span>
                  </div>
                  <span className="text-body font-mono text-content-primary">
                    {fmtMoney(p.valueBase, baseCurrency)}
                  </span>
                </li>
              ))}
            </ul>
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
