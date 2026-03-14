import { Hono } from 'hono';
import { z } from 'zod';
import { json, readJson } from '../../_lib/http';
import type { Env } from '../../_lib/db';
import { requireAuth } from '../../_lib/auth';
import { normalizeCoinbaseCredentials } from '../../_lib/coinbaseJwt';
import {
  coinbaseGetExchangeRates,
  coinbaseListAllAccounts,
  coinbaseListTransactionsPage,
  coinbaseShowTransaction,
} from '../../_lib/coinbaseV2Client';
import { classifyCoinbaseError } from '@kp/core';

const imports = new Hono<{ Bindings: Env }>();

const CoinbaseCredentialsSchema = z.object({ keyName: z.string().optional(), privateKeyPem: z.string().min(1) });

imports.post('/v1/import/coinbase/v2/accounts', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const raw = CoinbaseCredentialsSchema.parse(await readJson(c.req.raw));
  try {
    const norm = await normalizeCoinbaseCredentials(raw);
    const accounts = await coinbaseListAllAccounts({ keyName: norm.keyName, privateKeyPem: norm.privateKeyPem });
    return json({ accounts });
  } catch (e) {
    const { status, body } = classifyCoinbaseError(e);
    return json(body, { status });
  }
});

imports.post('/v1/import/coinbase/v2/transactions/page', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const schema = z
    .object({
      ...CoinbaseCredentialsSchema.shape,
      accountId: z.string().min(1),
      nextUri: z.string().optional().nullable(),
      limit: z.number().int().min(1).max(100).optional(),
    })
    .strict();

  const parsed = schema.parse(await readJson(c.req.raw));
  try {
    const norm = await normalizeCoinbaseCredentials(parsed);
    const page = await coinbaseListTransactionsPage(
      { keyName: norm.keyName, privateKeyPem: norm.privateKeyPem },
      parsed.accountId,
      parsed.nextUri,
      parsed.limit ?? 100
    );
    return json({ items: page.items, nextUri: page.nextUri });
  } catch (e) {
    const { status, body } = classifyCoinbaseError(e);
    return json(body, { status });
  }
});

imports.post('/v1/import/coinbase/v2/transactions/show', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const schema = z
    .object({
      ...CoinbaseCredentialsSchema.shape,
      accountId: z.string().min(1),
      transactionId: z.string().min(1),
    })
    .strict();
  const parsed = schema.parse(await readJson(c.req.raw));
  try {
    const norm = await normalizeCoinbaseCredentials(parsed);
    const tx = await coinbaseShowTransaction(
      { keyName: norm.keyName, privateKeyPem: norm.privateKeyPem },
      parsed.accountId,
      parsed.transactionId
    );
    return json(tx);
  } catch (e) {
    const { status, body } = classifyCoinbaseError(e);
    return json(body, { status });
  }
});

imports.get('/v1/import/coinbase/v2/exchange-rates', async (c) => {
  const currency = c.req.query('currency');
  try {
    const rates = await coinbaseGetExchangeRates(typeof currency === 'string' ? currency : undefined);
    return json(rates);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: 'coinbase_proxy_error', message: msg }, { status: 502 });
  }
});

export { imports };
