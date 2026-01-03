import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

function setCached(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function coingeckoBase(app: FastifyInstance): string {
  return String(app.config.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
}

function coingeckoHeaders(app: FastifyInstance): Record<string, string> {
  const key = app.config.COINGECKO_DEMO_API_KEY;
  return key ? { 'x-cg-demo-api-key': String(key) } : {};
}

export function registerCoingeckoRoutes(app: FastifyInstance) {
  // Public proxy endpoints (no auth) so the app works even without login.
  // Rate limiting is handled globally by the Fastify rate-limit plugin.

  app.get('/v1/catalog/coingecko/search', async (req, reply) => {
    const q = z
      .object({ query: z.string().min(1).max(80) })
      .parse(req.query);

    // TEST_MODE: deterministic offline stub so Playwright can run without external network.
    if (app.config.TEST_MODE) {
      const qq = q.query.toLowerCase();
      const mk = (id: string, name: string, symbol: string, rank: number) => ({
        id,
        name,
        symbol,
        market_cap_rank: rank,
        thumb: null,
        large: null
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

    const cacheKey = `search:${q.query.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached as any;

    const url = `${coingeckoBase(app)}/search?query=${encodeURIComponent(q.query)}`;
    const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(app) } });
    if (!r.ok) return reply.code(502).send({ error: 'coingecko_proxy_error', status: r.status });
    const json = (await r.json()) as any;

    // Keep response stable: only expose a subset.
    const coins = Array.isArray(json?.coins)
      ? json.coins.map((c: any) => ({
          id: String(c.id ?? ''),
          name: String(c.name ?? ''),
          symbol: String(c.symbol ?? ''),
          market_cap_rank: typeof c.market_cap_rank === 'number' ? c.market_cap_rank : null,
          thumb: c.thumb ? String(c.thumb) : null,
          large: c.large ? String(c.large) : null
        }))
      : [];

    const out = { coins };
    setCached(cacheKey, out, 10 * 60_000);
    return out;
  });

  app.get('/v1/prices/coingecko/simple', async (req, reply) => {
    const q = z
      .object({
        ids: z.string().min(1).max(2000),
        vs: z.string().min(3).max(10)
      })
      .parse(req.query);

    const ids = q.ids
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 250);
    const vs = q.vs.trim().toLowerCase();
    if (!ids.length) return reply.code(400).send({ error: 'ids_required' });

    const cacheKey = `simple:${ids.join(',')}:${vs}`;
    const cached = getCached(cacheKey);
    if (cached) return cached as any;

    // TEST_MODE: deterministic prices.
    if (app.config.TEST_MODE) {
      const base: Record<string, number> = {
        bitcoin: 40000,
        ethereum: 2000,
        'usd-coin': 1
      };
      const fx = vs === 'eur' ? 1 : vs === 'usd' ? 1.1 : 1;
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
      const out = { vsCurrency: vs, prices, lastUpdatedAt };
      setCached(cacheKey, out, 30_000);
      return out;
    }

    const url = `${coingeckoBase(app)}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=${encodeURIComponent(vs)}&include_last_updated_at=true`;
    const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(app) } });
    if (!r.ok) return reply.code(502).send({ error: 'coingecko_proxy_error', status: r.status });
    const json = (await r.json()) as any;

    // Expected response: { bitcoin: { eur: 123, last_updated_at: 123 } }
    const prices: Record<string, number> = {};
    const lastUpdatedAt: Record<string, number> = {};
    for (const id of ids) {
      const entry = json?.[id];
      const p = entry?.[vs];
      if (typeof p === 'number') prices[id] = p;
      const lu = entry?.last_updated_at;
      if (typeof lu === 'number') lastUpdatedAt[id] = lu;
    }

    const out = { vsCurrency: vs, prices, lastUpdatedAt };
    // Short TTL (prices change frequently)
    setCached(cacheKey, out, 30_000);
    return out;
  });
}
