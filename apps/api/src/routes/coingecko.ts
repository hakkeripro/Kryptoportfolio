import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  getCached,
  setCached,
  coingeckoBase,
  coingeckoHeaders,
  normalizeSearchResponse,
  normalizeSimplePricesResponse,
  testSearchCoins,
  testSimplePrices,
  type CoingeckoConfig,
} from '@kp/core';

function cgConfig(app: FastifyInstance): CoingeckoConfig {
  return {
    baseUrl: app.config.COINGECKO_BASE_URL,
    demoApiKey: app.config.COINGECKO_DEMO_API_KEY,
  };
}

export function registerCoingeckoRoutes(app: FastifyInstance) {
  app.get('/v1/catalog/coingecko/search', async (req, reply) => {
    const q = z.object({ query: z.string().min(1).max(80) }).parse(req.query);

    if (app.config.testMode) {
      return testSearchCoins(q.query);
    }

    const cacheKey = `search:${q.query.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) return cached;

    const cfg = cgConfig(app);
    const url = `${coingeckoBase(cfg)}/search?query=${encodeURIComponent(q.query)}`;
    const r = await fetch(url, {
      headers: { accept: 'application/json', ...coingeckoHeaders(cfg) },
    });
    if (!r.ok) return reply.code(502).send({ error: 'coingecko_proxy_error', status: r.status });
    const raw = await r.json();

    const out = normalizeSearchResponse(raw);
    setCached(cacheKey, out, 10 * 60_000);
    return out;
  });

  app.get('/v1/prices/coingecko/simple', async (req, reply) => {
    const q = z
      .object({
        ids: z.string().min(1).max(2000),
        vs: z.string().min(3).max(10),
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
    if (cached) return cached;

    if (app.config.testMode) {
      const out = testSimplePrices(ids, vs);
      setCached(cacheKey, out, 30_000);
      return out;
    }

    const cfg = cgConfig(app);
    const url = `${coingeckoBase(cfg)}/simple/price?ids=${encodeURIComponent(ids.join(','))}&vs_currencies=${encodeURIComponent(vs)}&include_last_updated_at=true`;
    const r = await fetch(url, {
      headers: { accept: 'application/json', ...coingeckoHeaders(cfg) },
    });
    if (!r.ok) return reply.code(502).send({ error: 'coingecko_proxy_error', status: r.status });
    const raw = await r.json();

    const out = normalizeSimplePricesResponse(raw, ids, vs);
    setCached(cacheKey, out, 30_000);
    return out;
  });
}
