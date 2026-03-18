import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';
import type { Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { signBinanceRequest, buildBinanceQueryString } from '../../_lib/binanceHmac';

const binance = new Hono<{ Bindings: Env }>();

const CredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

const BINANCE_TEST_API_KEY = 'TEST_BINANCE_API_KEY';

function isTestCreds(apiKey: string) {
  return apiKey === BINANCE_TEST_API_KEY;
}

async function binanceFetch(
  url: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number | boolean> = {},
): Promise<unknown> {
  const ts = Date.now();
  const allParams = { ...params, timestamp: ts };
  const qs = buildBinanceQueryString(allParams);
  const sig = await signBinanceRequest(qs, apiSecret);
  const res = await fetch(`${url}?${qs}&signature=${sig}`, {
    headers: { 'X-MBX-APIKEY': apiKey },
  });
  if (!res.ok) throw new Error(`Binance ${res.status}: ${await res.text()}`);
  return res.json();
}

binance.post('/v1/import/binance/verify', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const { apiKey, apiSecret } = CredsSchema.parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(apiKey)) {
    return json({ canTrade: true });
  }
  try {
    const data = await binanceFetch('https://api.binance.com/api/v3/account', apiKey, apiSecret);
    return json({ canTrade: (data as any).canTrade });
  } catch (e) {
    return json({ error: 'binance_proxy_error', message: String(e) }, { status: 502 });
  }
});

binance.post('/v1/import/binance/trades', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = z
    .object({ ...CredsSchema.shape, symbol: z.string().min(1), startTime: z.number().optional() })
    .parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(body.apiKey)) {
    const trades =
      body.symbol === 'BTCUSDT'
        ? [{ symbol: 'BTCUSDT', id: 100001, price: '42000.00', qty: '0.001', quoteQty: '42.00', commission: '0.0000001', commissionAsset: 'BTC', time: 1705312200000, isBuyer: true }]
        : [];
    return json({ trades });
  }
  try {
    const params: Record<string, string | number | boolean> = { symbol: body.symbol, limit: 1000 };
    if (body.startTime) params.startTime = body.startTime;
    const trades = await binanceFetch('https://api.binance.com/api/v3/myTrades', body.apiKey, body.apiSecret, params);
    return json({ trades });
  } catch (e) {
    return json({ error: 'binance_proxy_error', message: String(e) }, { status: 502 });
  }
});

binance.post('/v1/import/binance/deposits', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = z.object({ ...CredsSchema.shape, startTime: z.number().optional() }).parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(body.apiKey)) {
    return json({ deposits: [{ coin: 'BTC', amount: '0.01', insertTime: 1704000000000, txId: 'fixture-txid-001', status: 1 }] });
  }
  try {
    const params: Record<string, string | number | boolean> = {};
    if (body.startTime) params.startTime = body.startTime;
    const deposits = await binanceFetch('https://api.binance.com/sapi/v1/capital/deposit/hisrec', body.apiKey, body.apiSecret, params);
    return json({ deposits });
  } catch (e) {
    return json({ error: 'binance_proxy_error', message: String(e) }, { status: 502 });
  }
});

binance.post('/v1/import/binance/withdrawals', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = z.object({ ...CredsSchema.shape, startTime: z.number().optional() }).parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(body.apiKey)) {
    return json({ withdrawals: [] });
  }
  try {
    const params: Record<string, string | number | boolean> = {};
    if (body.startTime) params.startTime = body.startTime;
    const withdrawals = await binanceFetch('https://api.binance.com/sapi/v1/capital/withdraw/history', body.apiKey, body.apiSecret, params);
    return json({ withdrawals });
  } catch (e) {
    return json({ error: 'binance_proxy_error', message: String(e) }, { status: 502 });
  }
});

export { binance };
