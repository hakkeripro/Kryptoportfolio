import React from 'react';

type BadgeVariant = 'default' | 'success' | 'warning' | 'error' | 'info';
type BadgeSize = 'sm' | 'md';

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  default: 'bg-surface-raised text-content-secondary border-border',
  success: 'bg-semantic-success/10 text-semantic-success border-semantic-success/20',
  warning: 'bg-amber-500/10 text-semantic-warning border-amber-500/20',
  error: 'bg-red-500/10 text-semantic-error border-red-500/20',
  info: 'bg-blue-500/10 text-semantic-info border-blue-500/20',
};

const sizeClasses: Record<BadgeSize, string> = {
  sm: 'text-[0.625rem] px-1.5 py-0.5',
  md: 'text-caption px-2 py-0.5',
};

export function Badge({ children, variant = 'default', size = 'md', className = '' }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center rounded-badge border font-medium shadow-sm
        transition-all duration-150 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {children}
    </span>
  );
}
