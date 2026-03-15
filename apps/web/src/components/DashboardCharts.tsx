import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { TrendingUp } from 'lucide-react';
import { Card, CardTitle, EmptyState } from './ui';

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface-overlay)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  color: 'var(--color-content-primary)',
  boxShadow: 'var(--shadow-lg)',
  backdropFilter: 'blur(8px)',
};

type TimeRange = '7D' | '30D' | '1Y' | 'ALL';

const RANGE_DAYS: Record<TimeRange, number> = {
  '7D': 7,
  '30D': 30,
  '1Y': 365,
  ALL: 9999,
};

export interface AllocationItem {
  assetId: string;
  name: string;
  value: number;
  pct: number;
  color: string;
}

const BAR_COLORS = [
  '#ff8400', '#3b82f6', '#a78bfa', '#f59e0b',
  '#ef4444', '#22d3ee', '#fb7185', '#4ade80',
];

export function colorForAsset(key: string, index: number): string {
  if (index < BAR_COLORS.length) return BAR_COLORS[index]!;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return `hsl(${h % 360}, 55%, 50%)`;
}

export function AllocationBars({ data }: { data: AllocationItem[] }) {
  const { t } = useTranslation();
  if (!data.length) return null;

  return (
    <div className="space-y-3">
      <CardTitle>{t('dashboard.chart.allocation')}</CardTitle>
      {data.map((item) => (
        <div key={item.assetId} className="space-y-1">
          <div className="flex items-center justify-between text-caption">
            <span className="font-medium text-content-primary">{item.name}</span>
            <span className="text-content-secondary">{item.pct.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-surface-base overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-expo"
              style={{ width: `${Math.min(item.pct, 100)}%`, backgroundColor: item.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ValueChart({ data }: { data: { day: string; value: number }[] }) {
  const { t } = useTranslation();
  const [range, setRange] = useState<TimeRange>('30D');

  const filtered = data.slice(-RANGE_DAYS[range]);

  return (
    <Card data-testid="chart-portfolio-value">
      <div className="flex items-center justify-between mb-3">
        <CardTitle>{t('dashboard.chart.portfolioValue')}</CardTitle>
        <div className="flex gap-1">
          {(['7D', '30D', '1Y', 'ALL'] as TimeRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-full text-[0.625rem] font-medium transition-all duration-150
                ${range === r
                  ? 'bg-brand text-white'
                  : 'text-content-tertiary hover:text-content-secondary hover:bg-surface-overlay/60'
                }`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      {filtered.length ? (
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={filtered}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="var(--color-border-subtle)"
                vertical={false}
              />
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <XAxis dataKey="day" hide />
              <YAxis hide domain={['auto', 'auto']} />
              <Area
                type="monotone"
                dataKey="value"
                dot={false}
                stroke="var(--color-brand)"
                strokeWidth={2}
                fill="url(#areaGradient)"
                style={{ filter: 'drop-shadow(0 0 6px rgba(255, 132, 0, 0.3))' }}
                animationDuration={1000}
              />
            </AreaChart>
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
  );
}
