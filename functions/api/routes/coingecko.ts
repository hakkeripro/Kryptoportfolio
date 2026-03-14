import { Hono } from 'hono';
import { z } from 'zod';
import { json } from '../../_lib/http';
import type { Env } from '../../_lib/db';
import {
  getCached,
  setCached,
  coingeckoBase,
  coingeckoHeaders,
  normalizeSearchResponse,
  normalizeSimplePricesResponse,
  type CoingeckoConfig,
} from '@kp/core';

function cgConfig(env: Env): CoingeckoConfig {
  return {
    baseUrl: env.COINGECKO_BASE_URL,
    demoApiKey: env.COINGECKO_DEMO_API_KEY,
  };
}

const coingecko = new Hono<{ Bindings: Env }>();

coingecko.get('/v1/catalog/coingecko/search', async (c) => {
  const query = z.string().min(1).max(80).parse(c.req.query('query'));

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return json(cached as any);

  const cfg = cgConfig(c.env);
  const url = `${coingeckoBase(cfg)}/search?query=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(cfg) } });
  if (!r.ok) return json({ error: 'coingecko_proxy_error', status: r.status }, { status: 502 });
  const raw = await r.json();

  const out = normalizeSearchResponse(raw);
  setCached(cacheKey, out, 10 * 60_000);
  return json(out);
});

coingecko.get('/v1/prices/coingecko/simple', async (c) => {
  const idsRaw = z.string().min(1).max(2000).parse(c.req.query('ids'));
  const vsRaw = z.string().min(3).max(10).parse(c.req.query('vs'));

  const ids = idsRaw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 250);
  const vs = vsRaw.trim().toLowerCase();
  if (!ids.length) return json({ error: 'ids_required' }, { status: 400 });

  const cacheKey = `simple:${ids.join(',')}:${vs}`;
  const cached = getCached(cacheKey);
  if (cached) return json(cached as any);

  const cfg = cgConfig(c.env);
  const url = `${coingeckoBase(cfg)}/simple/price?ids=${encodeURIComponent(
    ids.join(',')
  )}&vs_currencies=${encodeURIComponent(vs)}&include_last_updated_at=true`;
  const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(cfg) } });
  if (!r.ok) return json({ error: 'coingecko_proxy_error', status: r.status }, { status: 502 });
  const raw = await r.json();

  const out = normalizeSimplePricesResponse(raw, ids, vs);
  setCached(cacheKey, out, 30_000);
  return json(out);
});

export { coingecko };
