import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { ZodError } from 'zod';
import { initDb } from './db/db.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerPushRoutes } from './routes/push.js';
import { registerAlertRoutes } from './routes/alerts.js';
import { registerImportRoutes } from './routes/imports.js';
import { registerCoingeckoRoutes } from './routes/coingecko.js';
import { startAlertRunner } from './runner/alertRunner.js';

const EnvSchema = z.object({
  PORT: z.string().optional(),
  HOST: z.string().optional(),
  JWT_SECRET: z.string().default('dev-secret-change-me'),
  DB_FILE: z.string().default('./data/kp.sqlite'),
  CORS_ORIGIN: z.string().default('*'),
  COINGECKO_BASE_URL: z.string().optional(),
  COINGECKO_DEMO_API_KEY: z.string().optional(),
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),
  ALERT_RUNNER_INTERVAL_SEC: z.string().default('30'),
  TEST_MODE: z.string().optional()
});

const env = EnvSchema.parse(process.env);

const testMode =
  env.TEST_MODE === '1' ||
  env.TEST_MODE === 'true' ||
  env.TEST_MODE === 'yes' ||
  process.env.NODE_ENV === 'test' ||
  process.env.CI === 'true' ||
  process.env.CI === '1' ||
  String(env.DB_FILE ?? '').includes('e2e.sqlite');


const app = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'test' ? 'silent' : 'info'
  }
});

// Normalize validation/auth errors into consistent HTTP responses
app.setErrorHandler((err, _req, reply) => {
  // zod validation
  if (err instanceof ZodError) {
    return reply.status(400).send({ error: 'validation_error', issues: err.issues });
  }

  // jwt/auth errors
  if ((err as any)?.code === 'FST_JWT_NO_AUTHORIZATION_IN_HEADER') {
    return reply.status(401).send({ error: 'unauthorized' });
  }
  if ((err as any)?.code === 'FST_JWT_AUTHORIZATION_TOKEN_INVALID') {
    return reply.status(401).send({ error: 'unauthorized' });
  }

  // default
  reply.send(err);
});

// attach env to instance
app.decorate('config', {
  ...env,
  testMode,
  // Default local port is 8788. (8787 is frequently occupied on Windows by HTTP.sys)
  port: Number(env.PORT ?? '8788'),
  // Bind explicitly to IPv4 localhost by default to avoid Windows `localhost`/IPv6/HTTP.sys surprises.
  // Override with HOST env var if you want 0.0.0.0 for LAN access.
  host: env.HOST ?? '127.0.0.1',
  alertRunnerIntervalSec: Number(env.ALERT_RUNNER_INTERVAL_SEC)
});

app.register(cors, {
  origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(',').map((s) => s.trim()),
  credentials: true
});

app.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

app.register(jwt, {
  secret: env.JWT_SECRET
});

app.decorate('db', await initDb(env.DB_FILE));

app.get('/', async () => ({ name: 'kryptoportfolio-v3-api', health: '/health' }));
app.get('/health', async () => ({ ok: true }));

registerAuthRoutes(app);
registerSyncRoutes(app);
registerPushRoutes(app);
registerAlertRoutes(app);
registerImportRoutes(app);
registerCoingeckoRoutes(app);


// Runner (server-side alerts)
startAlertRunner(app);

if (process.env.NODE_ENV !== 'test') {
  const { port, host } = (app as any).config;
  await app.listen({ port, host });
  app.log.info({ host, port }, 'API listening');
}

export default app;
