import React from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-brand text-content-inverse hover:bg-brand-dark hover:brightness-110 shadow-md hover:shadow-lg hover:shadow-brand/20 focus-visible:ring-brand',
  secondary:
    'bg-surface-raised text-content-primary border border-border hover:border-brand/30 hover:bg-surface-overlay hover:shadow-sm focus-visible:ring-border',
  ghost:
    'text-content-secondary hover:text-content-primary hover:bg-surface-raised/80 focus-visible:ring-border',
  danger:
    'bg-semantic-error text-white hover:bg-red-600 shadow-md hover:shadow-glow-error focus-visible:ring-semantic-error',
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'text-caption px-3 py-1.5 gap-1.5',
  md: 'text-body px-4 py-2 gap-2',
  lg: 'text-body px-6 py-3 gap-2',
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  className = '',
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center font-medium rounded-button
        transition-all duration-150 ease-expo active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        focus-visible:ring-offset-surface-base disabled:opacity-50 disabled:pointer-events-none
        ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
