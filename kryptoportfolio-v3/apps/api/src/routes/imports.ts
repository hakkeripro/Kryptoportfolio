import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../services/authHooks.js';
import {
  coinbaseListAllAccounts,
  coinbaseListTransactionsPage,
  coinbaseShowTransaction,
  coinbaseGetExchangeRates
} from '../services/coinbaseV2Client.js';
import { CoinbaseKeyError, normalizeCoinbaseCredentials } from '../services/coinbaseJwt.js';
import {
  fixtureAccounts,
  fixtureFindTransaction,
  fixtureTransactionsByAccount,
  isCoinbaseV2FixtureCreds
} from '../services/coinbaseV2Fixture.js';

// Allow `keyName` to be omitted if the user pastes the downloaded JSON key file.
const CoinbaseCredentialsSchema = z.object({
  keyName: z.string().optional(),
  privateKeyPem: z.string().min(1)
});


function sendCoinbaseError(reply: any, e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);

  // Key/PEM issues are user input problems -> 400, not 502.
  if (
    e instanceof CoinbaseKeyError ||
    msg.startsWith('coinbase_key') ||
    msg.startsWith('coinbase_key_') ||
    // OpenSSL decoder errors mean the PEM could not be parsed.
    msg.includes('DECODER routines')
  ) {
    return reply.status(400).send({ error: 'coinbase_key_invalid', message: msg });
  }

  // If Coinbase returned a status, surface it.
  const m = msg.match(/coinbase_error\s+(\d{3})/);
  if (m) {
    const status = Number(m[1]);
    const code = status === 401 ? 'coinbase_unauthorized' : 'coinbase_error';
    const hint =
      status === 401
        ? [
            'Coinbase returned 401 Unauthorized.',
            'Most common causes:',
            '• keyName must be the FULL "organizations/.../apiKeys/..." value (not the short Key ID).',
            '• signature algorithm must be ECDSA (ES256) and the private key must be the downloaded EC key (PEM).',
            '• permission must include View (read-only) for the selected portfolio.',
            '• machine clock must be correct (JWT nbf/exp are strict).',
            '• if you later enable IP allowlist, include the PUBLIC IP of your API server.'
          ].join('\n')
        : undefined;

    return reply.status(status).send({ error: code, message: msg, ...(hint ? { hint } : {}) });
  }

  // Fallback: proxy error.
  return reply.status(502).send({ error: 'coinbase_proxy_error', message: msg });
}
export async function registerImportRoutes(app: FastifyInstance) {
  // Coinbase App (v2) — accounts
  app.post('/v1/import/coinbase/v2/accounts', { preHandler: [requireAuth] }, async (req, reply) => {
    const raw = CoinbaseCredentialsSchema.parse((req as any).body ?? {});
    if (app.config.TEST_MODE && isCoinbaseV2FixtureCreds(raw)) {
      return reply.send({ accounts: fixtureAccounts() });
    }
    const body = normalizeCoinbaseCredentials(raw);
    try {
      const accounts = await coinbaseListAllAccounts(body);
      return reply.send({ accounts });
    } catch (e) {
      return sendCoinbaseError(reply, e);
    }
  });

  // Coinbase App (v2) — paged transactions for one account
  app.post('/v1/import/coinbase/v2/transactions/page', { preHandler: [requireAuth] }, async (req, reply) => {
    const schema = z
      .object({
        ...CoinbaseCredentialsSchema.shape,
        accountId: z.string().min(1),
        nextUri: z.string().optional().nullable(),
        limit: z.number().int().min(1).max(100).optional()
      })
      .strict();
    const parsed = schema.parse((req as any).body ?? {});
    if (app.config.TEST_MODE && isCoinbaseV2FixtureCreds(parsed)) {
      const all = fixtureTransactionsByAccount(parsed.accountId);
      // Ignore pagination in the fixture; respect limit.
      const items = all.slice(0, parsed.limit ?? 100);
      return reply.send({ items, nextUri: null });
    }
    const body = normalizeCoinbaseCredentials(parsed);
    try {
      const page = await coinbaseListTransactionsPage(body, parsed.accountId, parsed.nextUri, parsed.limit ?? 100);
      return reply.send({ items: page.items, nextUri: page.nextUri });
    } catch (e) {
      return sendCoinbaseError(reply, e);
    }
  });

  // Coinbase App (v2) — show one transaction (raw JSON)
  app.post('/v1/import/coinbase/v2/transactions/show', { preHandler: [requireAuth] }, async (req, reply) => {
    const schema = z
      .object({
        ...CoinbaseCredentialsSchema.shape,
        accountId: z.string().min(1),
        transactionId: z.string().min(1)
      })
      .strict();
    const parsed = schema.parse((req as any).body ?? {});
    if (app.config.TEST_MODE && isCoinbaseV2FixtureCreds(parsed)) {
      const tx = fixtureFindTransaction(parsed.accountId, parsed.transactionId);
      if (!tx) return reply.status(404).send({ error: 'not_found' });
      return reply.send(tx);
    }
    const body = normalizeCoinbaseCredentials(parsed);
    try {
      const tx = await coinbaseShowTransaction(body, parsed.accountId, parsed.transactionId);
      return reply.send(tx);
    } catch (e) {
      return sendCoinbaseError(reply, e);
    }
  });

  // Public FX helper (used for base currency conversion on import)
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
