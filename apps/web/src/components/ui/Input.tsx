import React, { forwardRef } from 'react';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  icon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, icon, className = '', id, ...props }, ref) => {
    const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label htmlFor={inputId} className="text-caption text-content-secondary font-medium">
            {label}
          </label>
        )}
        <div className="relative">
          {icon && (
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-content-tertiary">
              {icon}
            </span>
          )}
          <input
            ref={ref}
            id={inputId}
            className={`w-full rounded-input border bg-surface-base/40 px-3 py-2 text-body
              text-content-primary placeholder:text-content-tertiary
              transition-all duration-200 ease-expo
              focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand
              focus:shadow-[var(--glow-brand)]
              hover:border-content-tertiary/30
              disabled:opacity-50 disabled:cursor-not-allowed
              ${icon ? 'pl-10' : ''}
              ${error ? 'border-semantic-error focus:ring-semantic-error/40 focus:shadow-[var(--glow-error)]' : 'border-border'}
              ${className}`}
            {...props}
          />
        </div>
        {error && <span className="text-caption text-semantic-error animate-fade-in">{error}</span>}
      </div>
    );
  },
);

Input.displayName = 'Input';
