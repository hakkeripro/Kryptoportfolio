import React, { useState } from 'react';

type TokenIconSize = 'sm' | 'md' | 'lg';

interface TokenIconProps {
  symbol: string;
  iconUrl?: string | null;
  size?: TokenIconSize;
  className?: string;
}

const sizePx: Record<TokenIconSize, number> = { sm: 20, md: 28, lg: 40 };

function hashHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash) % 360;
}

export function TokenIcon({
  symbol,
  iconUrl,
  size = 'md',
  className = '',
}: TokenIconProps) {
  const [imgError, setImgError] = useState(false);
  const px = sizePx[size];
  const letter = symbol.charAt(0).toUpperCase();
  const hue = hashHue(symbol);

  if (iconUrl && !imgError) {
    return (
      <img
        src={iconUrl}
        alt={symbol}
        width={px}
        height={px}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`rounded-full ${className}`}
      />
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full text-white font-semibold ${className}`}
      style={{
        width: px,
        height: px,
        fontSize: px * 0.45,
        backgroundColor: `hsl(${hue}, 55%, 45%)`,
      }}
    >
      {letter}
    </span>
  );
}
