import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth } from '../services/authHooks.js';
import { krakenVerifyKey, krakenFetchLedgers } from '../services/krakenClient.js';
import { isKrakenTestCreds, fixtureVerify, fixtureLedgers } from '../services/krakenV1Fixture.js';

const CredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export async function registerKrakenImportRoutes(app: FastifyInstance) {
  app.post('/v1/import/kraken/verify', { preHandler: [requireAuth] }, async (req, reply) => {
    const { apiKey, apiSecret } = CredsSchema.parse((req as any).body ?? {});
    if (app.config.testMode && isKrakenTestCreds(apiKey, apiSecret)) {
      return reply.send(fixtureVerify());
    }
    try {
      const result = await krakenVerifyKey({ apiKey, apiSecret });
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'kraken_proxy_error', message: msg });
    }
  });

  app.post('/v1/import/kraken/ledgers', { preHandler: [requireAuth] }, async (req, reply) => {
    const body = z
      .object({
        ...CredsSchema.shape,
        offset: z.number().int().min(0).default(0),
        start: z.number().optional(),
      })
      .parse((req as any).body ?? {});
    if (app.config.testMode && isKrakenTestCreds(body.apiKey, body.apiSecret)) {
      return reply.send(fixtureLedgers(body.offset));
    }
    try {
      const result = await krakenFetchLedgers(
        { apiKey: body.apiKey, apiSecret: body.apiSecret },
        body.offset,
        body.start,
      );
      return reply.send(result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return reply.status(502).send({ error: 'kraken_proxy_error', message: msg });
    }
  });
}
