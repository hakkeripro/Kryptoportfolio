import React from 'react';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className = '', hover = false }: CardProps) {
  return (
    <div
      className={`relative bg-gradient-card backdrop-blur-md border border-border-subtle
        rounded-card p-card shadow-md transition-all duration-300 ease-expo
        before:absolute before:inset-0 before:rounded-card before:border before:border-white/[0.04] before:pointer-events-none
        ${hover ? 'hover:shadow-lg hover:-translate-y-0.5 hover:border-brand/20 hover:shadow-brand/5' : ''}
        ${className}`}
    >
      {children}
    </div>
  );
}

export function CardHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-3 ${className}`}>{children}</div>;
}

export function CardTitle({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <h3 className={`text-heading-4 text-content-primary ${className}`}>{children}</h3>;
}
