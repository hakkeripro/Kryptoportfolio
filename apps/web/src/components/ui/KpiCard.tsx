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
      <div className="relative overflow-hidden">
        {/* Gradient accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
        <div className="flex items-start justify-between pt-1">
          <span className="text-caption text-content-secondary">{label}</span>
          {icon && <span className="text-content-tertiary">{icon}</span>}
        </div>
        <div className="mt-1 text-heading-2 text-content-primary font-mono">{value}</div>
        {delta && (
          <div className={`flex items-center gap-1 mt-1 text-caption ${deltaColor}`}>
            {DeltaIcon && <DeltaIcon className="h-3 w-3" />}
            <span>{delta}</span>
          </div>
        )}
      </div>
    </Card>
  );
}
