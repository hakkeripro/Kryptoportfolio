import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../services/authHooks.js';
import {
  coinbaseListAllAccounts,
  coinbaseListTransactionsPage,
  coinbaseShowTransaction,
  coinbaseGetExchangeRates,
} from '../services/coinbaseV2Client.js';
import { normalizeCoinbaseCredentials } from '../services/coinbaseJwt.js';
import {
  fixtureAccounts,
  fixtureFindTransaction,
  fixtureTransactionsByAccount,
  isCoinbaseV2FixtureCreds,
} from '../services/coinbaseV2Fixture.js';
import { classifyCoinbaseError } from '@kp/core';

const CoinbaseCredentialsSchema = z.object({
  keyName: z.string().optional(),
  privateKeyPem: z.string().min(1),
});

export async function registerImportRoutes(app: FastifyInstance) {
  app.post('/v1/import/coinbase/v2/accounts', { preHandler: [requireAuth] }, async (req, reply) => {
    const raw = CoinbaseCredentialsSchema.parse((req as any).body ?? {});
    if (app.config.testMode && isCoinbaseV2FixtureCreds(raw)) {
      return reply.send({ accounts: fixtureAccounts() });
    }
    const body = normalizeCoinbaseCredentials(raw);
    try {
      const accounts = await coinbaseListAllAccounts(body);
      return reply.send({ accounts });
    } catch (e) {
      const { status, body: errBody } = classifyCoinbaseError(e);
      return reply.status(status).send(errBody);
    }
  });

  app.post(
    '/v1/import/coinbase/v2/transactions/page',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const schema = z
        .object({
          ...CoinbaseCredentialsSchema.shape,
          accountId: z.string().min(1),
          nextUri: z.string().optional().nullable(),
          limit: z.number().int().min(1).max(100).optional(),
        })
        .strict();
      const parsed = schema.parse((req as any).body ?? {});
      if (app.config.testMode && isCoinbaseV2FixtureCreds(parsed)) {
        const all = fixtureTransactionsByAccount(parsed.accountId);
        const items = all.slice(0, parsed.limit ?? 100);
        return reply.send({ items, nextUri: null });
      }
      const body = normalizeCoinbaseCredentials(parsed);
      try {
        const page = await coinbaseListTransactionsPage(
          body,
          parsed.accountId,
          parsed.nextUri,
          parsed.limit ?? 100,
        );
        return reply.send({ items: page.items, nextUri: page.nextUri });
      } catch (e) {
        const { status, body: errBody } = classifyCoinbaseError(e);
        return reply.status(status).send(errBody);
      }
    },
  );

  app.post(
    '/v1/import/coinbase/v2/transactions/show',
    { preHandler: [requireAuth] },
    async (req, reply) => {
      const schema = z
        .object({
          ...CoinbaseCredentialsSchema.shape,
          accountId: z.string().min(1),
          transactionId: z.string().min(1),
        })
        .strict();
      const parsed = schema.parse((req as any).body ?? {});
      if (app.config.testMode && isCoinbaseV2FixtureCreds(parsed)) {
        const tx = fixtureFindTransaction(parsed.accountId, parsed.transactionId);
        if (!tx) return reply.status(404).send({ error: 'not_found' });
        return reply.send(tx);
      }
      const body = normalizeCoinbaseCredentials(parsed);
      try {
        const tx = await coinbaseShowTransaction(body, parsed.accountId, parsed.transactionId);
        return reply.send(tx);
      } catch (e) {
        const { status, body: errBody } = classifyCoinbaseError(e);
        return reply.status(status).send(errBody);
      }
    },
  );

  app.get('/v1/import/coinbase/v2/exchange-rates', async (req, reply) => {
    const q = (req.query as any) ?? {};
    const currency = typeof q.currency === 'string' ? q.currency : undefined;
    try {
      const rates = await coinbaseGetExchangeRates(currency);
      return reply.send(rates);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'coinbase_proxy_error', message: msg });
    }
  });
}
