import { useTranslation } from 'react-i18next';
import {
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  Cell,
  Area,
  AreaChart,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { BarChart3, TrendingUp } from 'lucide-react';
import { Card, CardTitle, EmptyState } from './ui';

interface AllocationItem {
  assetId: string;
  name: string;
  value: number;
}

const TOOLTIP_STYLE = {
  backgroundColor: 'var(--color-surface-overlay)',
  border: '1px solid var(--color-border)',
  borderRadius: '0.5rem',
  color: 'var(--color-content-primary)',
  boxShadow: 'var(--shadow-lg)',
  backdropFilter: 'blur(8px)',
};

const PALETTE = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#a78bfa',
  '#fb7185', '#22d3ee', '#c084fc', '#4ade80', '#f97316',
];

function colorForKey(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length]!;
}

export function AllocationChart({ data }: { data: AllocationItem[] }) {
  const { t } = useTranslation();
  return (
    <Card data-testid="chart-allocation">
      <CardTitle>{t('dashboard.chart.allocation')}</CardTitle>
      {data.length ? (
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip contentStyle={TOOLTIP_STYLE} />
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={2}
                animationBegin={0}
                animationDuration={800}
              >
                {data.map((x) => (
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
  );
}

export function ValueChart({ data }: { data: { day: string; value: number }[] }) {
  const { t } = useTranslation();
  return (
    <Card data-testid="chart-portfolio-value">
      <CardTitle>{t('dashboard.chart.portfolioValue')}</CardTitle>
      {data.length ? (
        <div className="h-64 mt-3">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="var(--color-brand)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border-subtle)" vertical={false} />
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
                style={{ filter: 'drop-shadow(0 0 6px rgba(16, 185, 129, 0.3))' }}
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
