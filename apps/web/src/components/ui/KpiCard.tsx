import React from 'react';
import { Card } from './Card';

interface KpiCardProps {
  label: string;
  value: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
}

export function KpiCard({ label, value, delta, deltaType = 'neutral' }: KpiCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-semantic-success'
      : deltaType === 'negative'
        ? 'text-semantic-error'
        : 'text-content-tertiary';

  return (
    <Card>
      <span className="text-xs font-medium text-content-secondary">{label}</span>
      <div className="mt-2 text-2xl font-semibold font-heading text-content-primary">{value}</div>
      {delta && (
        <div className={`mt-2 text-xs ${deltaColor}`}>{delta}</div>
      )}
    </Card>
  );
}
