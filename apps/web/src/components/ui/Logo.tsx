import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showWordmark?: boolean;
  className?: string;
}

const sizes = { sm: 24, md: 32, lg: 48 };

export function Logo({ size = 'md', showWordmark = true, className = '' }: LogoProps) {
  const px = sizes[size];
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <svg
        width={px}
        height={px}
        viewBox="0 0 48 48"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="VaultFolio"
      >
        {/* Shield outline */}
        <path
          d="M24 4L6 12v12c0 11.1 7.7 21.5 18 24 10.3-2.5 18-12.9 18-24V12L24 4Z"
          fill="var(--color-brand)"
          fillOpacity="0.15"
          stroke="var(--color-brand)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Keyhole */}
        <circle cx="24" cy="20" r="4" fill="var(--color-brand)" />
        <path
          d="M22 23h4l1 8h-6l1-8Z"
          fill="var(--color-brand)"
        />
      </svg>
      {showWordmark && (
        <span
          className="font-semibold tracking-tight text-content-primary"
          style={{ fontSize: px * 0.6 }}
        >
          VaultFolio
        </span>
      )}
    </span>
  );
}
