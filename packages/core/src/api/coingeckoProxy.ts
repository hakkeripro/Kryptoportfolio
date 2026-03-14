/**
 * Shared CoinGecko proxy logic: bounded cache + response normalization.
 */

// ---------- Bounded TTL cache ----------

const MAX_CACHE_SIZE = 200;

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();

export function getCached<T = unknown>(key: string): T | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value as T;
}

export function setCached(key: string, value: unknown, ttlMs: number): void {
  if (cache.size >= MAX_CACHE_SIZE) {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (now > v.expiresAt) cache.delete(k);
    }
    while (cache.size >= MAX_CACHE_SIZE) {
      const firstKey = cache.keys().next().value;
      if (firstKey !== undefined) cache.delete(firstKey);
      else break;
    }
  }
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

// ---------- CoinGecko helpers ----------

export interface CoingeckoConfig {
  baseUrl?: string;
  demoApiKey?: string;
}

export function coingeckoBase(cfg: CoingeckoConfig): string {
  return String(cfg.baseUrl ?? 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
}

export function coingeckoHeaders(cfg: CoingeckoConfig): Record<string, string> {
  return cfg.demoApiKey ? { 'x-cg-demo-api-key': String(cfg.demoApiKey) } : {};
}

// ---------- Response normalization ----------

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank: number | null;
  thumb: string | null;
  large: string | null;
}

export function normalizeSearchResponse(raw: unknown): { coins: CoinSearchResult[] } {
  const data = raw as any;
  const coins: CoinSearchResult[] = Array.isArray(data?.coins)
    ? data.coins.map((c: any) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        symbol: String(c.symbol ?? ''),
        market_cap_rank: typeof c.market_cap_rank === 'number' ? c.market_cap_rank : null,
        thumb: c.thumb ? String(c.thumb) : null,
        large: c.large ? String(c.large) : null,
      }))
    : [];
  return { coins };
}

export interface SimplePricesResult {
  vsCurrency: string;
  prices: Record<string, number>;
  lastUpdatedAt: Record<string, number>;
}

export function normalizeSimplePricesResponse(
  raw: unknown,
  ids: string[],
  vsCurrency: string,
): SimplePricesResult {
  const data = raw as any;
  const prices: Record<string, number> = {};
  const lastUpdatedAt: Record<string, number> = {};
  for (const id of ids) {
    const entry = data?.[id];
    const p = entry?.[vsCurrency];
    if (typeof p === 'number') prices[id] = p;
    const lu = entry?.last_updated_at;
    if (typeof lu === 'number') lastUpdatedAt[id] = lu;
  }
  return { vsCurrency, prices, lastUpdatedAt };
}

// ---------- Test mode stubs ----------

export function testSearchCoins(query: string): { coins: CoinSearchResult[] } {
  const qq = query.toLowerCase();
  const mk = (id: string, name: string, symbol: string, rank: number): CoinSearchResult => ({
    id,
    name,
    symbol,
    market_cap_rank: rank,
    thumb: null,
    large: null,
  });
  const coins =
    qq.includes('bitcoin') || qq === 'btc'
      ? [mk('bitcoin', 'Bitcoin', 'btc', 1)]
      : qq.includes('ethereum') || qq === 'eth'
        ? [mk('ethereum', 'Ethereum', 'eth', 2)]
        : qq.includes('usd-coin') || qq.includes('usdc')
          ? [mk('usd-coin', 'USD Coin', 'usdc', 5)]
          : [];
  return { coins };
}

export function testSimplePrices(
  ids: string[],
  vsCurrency: string,
): SimplePricesResult {
  const base: Record<string, number> = {
    bitcoin: 40000,
    ethereum: 2000,
    'usd-coin': 1,
  };
  const fx = vsCurrency === 'eur' ? 1 : vsCurrency === 'usd' ? 1.1 : 1;
  const prices: Record<string, number> = {};
  const lastUpdatedAt: Record<string, number> = {};
  const now = Math.floor(Date.now() / 1000);
  for (const id of ids) {
    const p = base[id];
    if (typeof p === 'number') {
      prices[id] = p * fx;
      lastUpdatedAt[id] = now;
    }
  }
  return { vsCurrency, prices, lastUpdatedAt };
}
