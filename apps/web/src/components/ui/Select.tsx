import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, className = '', children, id, ...props }, ref) => {
    const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className="flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-caption text-content-secondary font-medium"
          >
            {label}
          </label>
        )}
        <div className="relative">
          <select
            ref={ref}
            id={selectId}
            className={`w-full appearance-none rounded-input border bg-surface-base/40
              px-3 py-2 pr-10 text-body text-content-primary
              focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand
              disabled:opacity-50 disabled:cursor-not-allowed
              ${error ? 'border-semantic-error' : 'border-border'}
              ${className}`}
            {...props}
          >
            {children}
          </select>
          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-content-tertiary" />
        </div>
        {error && (
          <span className="text-caption text-semantic-error">{error}</span>
        )}
      </div>
    );
  },
);

Select.displayName = 'Select';
