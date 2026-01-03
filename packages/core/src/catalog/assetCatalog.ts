/**
 * Minimal deterministic asset catalog used to attach provider IDs (e.g. CoinGecko).
 *
 * V3 rule: never guess provider IDs from symbols heuristically.
 * This list is explicit and can be expanded over time.
 */

export type KnownAsset = {
  symbol: string;
  name: string;
  /** CoinGecko ID (stable identifier for pricing) */
  coingeckoId?: string;
  type?: 'crypto' | 'stable' | 'fiat' | 'other';
};

// Keep this list small and curated. Unknown assets are created without provider refs.
export const KNOWN_ASSETS: KnownAsset[] = [
  { symbol: 'BTC', name: 'Bitcoin', coingeckoId: 'bitcoin', type: 'crypto' },
  { symbol: 'ETH', name: 'Ethereum', coingeckoId: 'ethereum', type: 'crypto' },
  { symbol: 'SOL', name: 'Solana', coingeckoId: 'solana', type: 'crypto' },
  { symbol: 'XRP', name: 'XRP', coingeckoId: 'ripple', type: 'crypto' },
  { symbol: 'ADA', name: 'Cardano', coingeckoId: 'cardano', type: 'crypto' },
  { symbol: 'DOGE', name: 'Dogecoin', coingeckoId: 'dogecoin', type: 'crypto' },
  { symbol: 'DOT', name: 'Polkadot', coingeckoId: 'polkadot', type: 'crypto' },
  { symbol: 'AVAX', name: 'Avalanche', coingeckoId: 'avalanche-2', type: 'crypto' },
  { symbol: 'MATIC', name: 'Polygon', coingeckoId: 'matic-network', type: 'crypto' },
  { symbol: 'LINK', name: 'Chainlink', coingeckoId: 'chainlink', type: 'crypto' },
  { symbol: 'LTC', name: 'Litecoin', coingeckoId: 'litecoin', type: 'crypto' },
  { symbol: 'BCH', name: 'Bitcoin Cash', coingeckoId: 'bitcoin-cash', type: 'crypto' },

  { symbol: 'USDC', name: 'USD Coin', coingeckoId: 'usd-coin', type: 'stable' },
  { symbol: 'USDT', name: 'Tether', coingeckoId: 'tether', type: 'stable' },
  { symbol: 'DAI', name: 'Dai', coingeckoId: 'dai', type: 'stable' },
  { symbol: 'EURC', name: 'Euro Coin', coingeckoId: 'euro-coin', type: 'stable' },

  // Fiats (no coingeckoId needed for fiat FX in this app)
  { symbol: 'EUR', name: 'Euro', type: 'fiat' },
  { symbol: 'USD', name: 'US Dollar', type: 'fiat' },
  { symbol: 'GBP', name: 'British Pound', type: 'fiat' },
  { symbol: 'SEK', name: 'Swedish Krona', type: 'fiat' },
  { symbol: 'NOK', name: 'Norwegian Krone', type: 'fiat' },
  { symbol: 'DKK', name: 'Danish Krone', type: 'fiat' }
];

export function lookupKnownAsset(symbol: string): KnownAsset | undefined {
  const s = symbol.trim().toUpperCase();
  return KNOWN_ASSETS.find((a) => a.symbol === s);
}

export function lookupCoingeckoIdForSymbol(symbol: string): string | undefined {
  return lookupKnownAsset(symbol)?.coingeckoId;
}

export function inferAssetType(symbol: string): KnownAsset['type'] {
  const known = lookupKnownAsset(symbol);
  if (known?.type) return known.type;
  const s = symbol.trim().toUpperCase();
  if (['USD', 'EUR', 'GBP', 'SEK', 'NOK', 'DKK'].includes(s)) return 'fiat';
  // Conservative default: unknown is crypto-ish.
  return 'crypto';
}
