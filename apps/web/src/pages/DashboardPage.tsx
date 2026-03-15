import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import Decimal from 'decimal.js';
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3, RefreshCw, TrendingUp } from 'lucide-react';
import { useDashboardData } from '../hooks/useDashboardData';
import { useDashboardRefresh } from '../hooks/useDashboardRefresh';
import { useAuthStore } from '../store/useAuthStore';
import PageHeader from '../components/PageHeader';
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

const PALETTE = [
  '#10b981',
  '#3b82f6',
  '#f59e0b',
  '#ef4444',
  '#a78bfa',
  '#fb7185',
  '#22d3ee',
  '#c084fc',
  '#4ade80',
  '#f97316',
];

function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
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
        <div data-testid="metric-total-value">
          <KpiCard
            label={t('dashboard.kpi.totalValue')}
            value={fmtMoney(metrics.totalValueBase, baseCurrency)}
            icon={<BarChart3 className="h-4 w-4" />}
          />
        </div>
        <div data-testid="metric-realized">
          <KpiCard
            label={t('dashboard.kpi.realizedPnl')}
            value={fmtMoney(metrics.realizedPnlBaseToDate, baseCurrency)}
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
        </div>
        <div data-testid="metric-unrealized">
          <KpiCard
            label={t('dashboard.kpi.unrealizedPnl')}
            value={fmtMoney(metrics.unrealizedPnlBase, baseCurrency)}
            delta={
              unrealizedDelta.isZero()
                ? undefined
                : `${unrealizedDelta.isPositive() ? '+' : ''}${unrealizedDelta.toDecimalPlaces(2).toFixed()}`
            }
            deltaType={
              unrealizedDelta.isPositive()
                ? 'positive'
                : unrealizedDelta.isNegative()
                  ? 'negative'
                  : 'neutral'
            }
          />
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card data-testid="chart-allocation">
          <CardTitle>{t('dashboard.chart.allocation')}</CardTitle>
          {allocation.length ? (
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-overlay)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-content-primary)',
                    }}
                  />
                  <Pie
                    data={allocation}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                  >
                    {allocation.map((x) => (
                      <Cell key={x.assetId} fill={colorForKey(x.assetId)} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<BarChart3 className="h-10 w-10" />}
              title={t('dashboard.empty.allocation.title')}
              description={t('dashboard.empty.allocation.desc')}
            />
          )}
        </Card>

        <Card data-testid="chart-portfolio-value">
          <CardTitle>{t('dashboard.chart.portfolioValue')}</CardTitle>
          {valueSeries.length ? (
            <div className="h-64 mt-3">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={valueSeries}>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--color-surface-overlay)',
                      border: '1px solid var(--color-border)',
                      borderRadius: '0.5rem',
                      color: 'var(--color-content-primary)',
                    }}
                  />
                  <XAxis dataKey="day" hide />
                  <YAxis hide domain={['auto', 'auto']} />
                  <Line
                    type="monotone"
                    dataKey="value"
                    dot={false}
                    stroke="var(--color-brand)"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              icon={<TrendingUp className="h-10 w-10" />}
              title={t('dashboard.empty.snapshots.title')}
              description={t('dashboard.empty.snapshots.desc')}
            />
          )}
        </Card>
      </div>

      {/* Top positions */}
      <Card data-testid="card-portfolio-top">
        <CardTitle>{t('dashboard.topPositions.title')}</CardTitle>
        <div data-testid="list-top-positions" className="mt-3">
          {topPositions.length ? (
            <ul className="divide-y divide-border">
              {topPositions.map((p) => (
                <li key={p.assetId} className="py-3 flex items-center justify-between">
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
        <p className="text-caption text-content-tertiary text-right">
          {t('dashboard.lastUpdate')} {new Date(status.lastRebuildISO).toLocaleString()}
          {dbState.error && <span className="text-semantic-error ml-2">{dbState.error}</span>}
        </p>
      )}
    </div>
  );
}
