import React from 'react';
import { Button } from './Button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ icon, title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
      <div className="mb-4 text-content-tertiary animate-slide-up">{icon}</div>
      <h3
        className="text-heading-4 text-content-primary mb-1 animate-slide-up"
        style={{ animationDelay: '80ms' }}
      >
        {title}
      </h3>
      {description && (
        <p
          className="text-body text-content-secondary max-w-sm mb-4 animate-slide-up"
          style={{ animationDelay: '160ms' }}
        >
          {description}
        </p>
      )}
      {actionLabel && onAction && (
        <div className="animate-slide-up" style={{ animationDelay: '240ms' }}>
          <Button onClick={onAction}>{actionLabel}</Button>
        </div>
      )}
    </div>
  );
}
