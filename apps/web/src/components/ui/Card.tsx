import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  'data-testid'?: string;
}

export function Card({ children, className = '', hover = false, ...rest }: CardProps) {
  return (
    <div
      className={`bg-[var(--color-card)] border border-[var(--color-card-border)]
        rounded-card p-card transition-colors duration-200
        ${hover ? 'hover:border-brand/20' : ''}
        ${className}`}
      {...rest}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function CardTitle({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={`text-heading-4 font-heading text-content-primary ${className}`}>{children}</h3>
  );
}
