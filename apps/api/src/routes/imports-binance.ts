import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../services/authHooks.js';
import {
  binanceVerifyKey,
  binanceFetchTrades,
  binanceFetchDeposits,
  binanceFetchWithdrawals,
  binanceFetchDust,
} from '../services/binanceClient.js';
import {
  isBinanceTestCreds,
  fixtureVerify,
  fixtureTrades,
  fixtureDeposits,
  fixtureWithdrawals,
} from '../services/binanceV1Fixture.js';

const CredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export async function registerBinanceImportRoutes(app: FastifyInstance) {
  app.post('/v1/import/binance/verify', { preHandler: [requireAuth] }, async (req, reply) => {
    const { apiKey, apiSecret } = CredsSchema.parse((req as any).body ?? {});
    if (app.config.testMode && isBinanceTestCreds(apiKey, apiSecret)) {
      return reply.send(fixtureVerify());
    }
    try {
      const result = await binanceVerifyKey({ apiKey, apiSecret });
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'binance_proxy_error', message: msg });
    }
  });

  app.post('/v1/import/binance/trades', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({ ...CredsSchema.shape, symbol: z.string().min(1), startTime: z.number().optional() })
      .parse((req as any).body ?? {});
    if (app.config.testMode && isBinanceTestCreds(body.apiKey, body.apiSecret)) {
      return reply.send({ trades: fixtureTrades(body.symbol) });
    }
    try {
      const trades = await binanceFetchTrades(
        { apiKey: body.apiKey, apiSecret: body.apiSecret },
        body.symbol,
        body.startTime,
      );
      return reply.send({ trades });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'binance_proxy_error', message: msg });
    }
  });

  app.post('/v1/import/binance/deposits', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({ ...CredsSchema.shape, startTime: z.number().optional() })
      .parse((req as any).body ?? {});
    if (app.config.testMode && isBinanceTestCreds(body.apiKey, body.apiSecret)) {
      return reply.send({ deposits: fixtureDeposits() });
    }
    try {
      const deposits = await binanceFetchDeposits(
        { apiKey: body.apiKey, apiSecret: body.apiSecret },
        body.startTime,
      );
      return reply.send({ deposits });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'binance_proxy_error', message: msg });
    }
  });

  app.post('/v1/import/binance/withdrawals', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({ ...CredsSchema.shape, startTime: z.number().optional() })
      .parse((req as any).body ?? {});
    if (app.config.testMode && isBinanceTestCreds(body.apiKey, body.apiSecret)) {
      return reply.send({ withdrawals: fixtureWithdrawals() });
    }
    try {
      const withdrawals = await binanceFetchWithdrawals(
        { apiKey: body.apiKey, apiSecret: body.apiSecret },
        body.startTime,
      );
      return reply.send({ withdrawals });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'binance_proxy_error', message: msg });
    }
  });

  app.post('/v1/import/binance/dust', { preHandler: [requireAuth] }, async (req, reply) => {
    const { apiKey, apiSecret } = CredsSchema.parse((req as any).body ?? {});
    if (app.config.testMode && isBinanceTestCreds(apiKey, apiSecret)) {
      return reply.send({ userAssetDribblets: [] });
    }
    try {
      const dust = await binanceFetchDust({ apiKey, apiSecret });
      return reply.send(dust);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'binance_proxy_error', message: msg });
    }
  });
}
