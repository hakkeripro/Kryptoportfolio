import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';
import type { Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { signKrakenRequest } from '../../_lib/krakenHmac';

const kraken = new Hono<{ Bindings: Env }>();

const CredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

const KRAKEN_BASE = 'https://api.kraken.com';
const KRAKEN_TEST_API_KEY = 'TEST_KRAKEN_API_KEY';

function isTestCreds(apiKey: string) {
  return apiKey === KRAKEN_TEST_API_KEY;
}

async function krakenPrivate(
  path: string,
  apiKey: string,
  apiSecret: string,
  params: Record<string, string | number> = {},
): Promise<unknown> {
  const nonce = String(Date.now() * 1000);
  const bodyParams = new URLSearchParams({ nonce, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const body = bodyParams.toString();
  const signature = await signKrakenRequest(path, nonce, body, apiSecret);
  const res = await fetch(`${KRAKEN_BASE}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });
  if (!res.ok) throw new Error(`Kraken ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { error: string[]; result?: unknown };
  if (data.error.length > 0) throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  return data.result;
}

kraken.post('/v1/import/kraken/verify', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const { apiKey, apiSecret } = CredsSchema.parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(apiKey)) {
    return json({ ok: true });
  }
  try {
    await krakenPrivate('/0/private/Balance', apiKey, apiSecret);
    return json({ ok: true });
  } catch (e) {
    return json({ error: 'kraken_proxy_error', message: String(e) }, { status: 502 });
  }
});

kraken.post('/v1/import/kraken/ledgers', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = z
    .object({ ...CredsSchema.shape, offset: z.number().int().min(0).default(0), start: z.number().optional() })
    .parse(await readJson(c.req.raw));
  if (String(c.env.TEST_MODE) === '1' && isTestCreds(body.apiKey)) {
    if (body.offset > 0) return json({ entries: [], count: 3 });
    return json({
      entries: [
        { refid: 'ABCDEF-001', time: 1705312200, type: 'trade', asset: 'XXBT', amount: '0.001', fee: '0.0000026' },
        { refid: 'ABCDEF-001', time: 1705312200, type: 'trade', asset: 'ZUSD', amount: '-42.00', fee: '0' },
        { refid: 'DEP-001', time: 1704000000, type: 'deposit', asset: 'XXBT', amount: '0.01', fee: '0' },
      ],
      count: 3,
    });
  }
  try {
    const params: Record<string, string | number> = { ofs: body.offset };
    if (body.start !== undefined) params.start = body.start;
    const result = (await krakenPrivate('/0/private/Ledgers', body.apiKey, body.apiSecret, params)) as {
      ledger: Record<string, unknown>;
      count: number;
    };
    const entries = Object.values(result.ledger ?? {});
    return json({ entries, count: result.count });
  } catch (e) {
    return json({ error: 'kraken_proxy_error', message: String(e) }, { status: 502 });
  }
});

export { kraken };
