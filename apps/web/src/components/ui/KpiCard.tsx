import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, delta, deltaType = 'neutral', icon }: KpiCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-semantic-success'
      : deltaType === 'negative'
        ? 'text-semantic-error'
        : 'text-content-tertiary';

  const DeltaIcon =
    deltaType === 'positive' ? TrendingUp : deltaType === 'negative' ? TrendingDown : null;

  return (
    <Card>
      <div className="flex items-start justify-between">
        <span className="text-caption text-content-secondary">{label}</span>
        {icon && <span className="text-content-tertiary">{icon}</span>}
      </div>
      <div className="mt-1 text-heading-2 text-content-primary">{value}</div>
      {delta && (
        <div className={`flex items-center gap-1 mt-1 text-caption ${deltaColor}`}>
          {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
          <span>{delta}</span>
        </div>
      )}
    </Card>
  );
}
