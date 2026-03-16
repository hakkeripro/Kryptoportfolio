import { Hono } from 'hono';
import { json } from '../_lib/http';
import { getSql, HOSTED_SCHEMA_SQL, type Env } from '../_lib/db';

import { auth } from './routes/auth';
import { sync } from './routes/sync';
import { imports } from './routes/imports';
import { coingecko } from './routes/coingecko';
import { push } from './routes/push';
import { alerts } from './routes/alerts';
import { runner } from './routes/runner';
import { billing } from './routes/billing';

type Bindings = Env;

const app = new Hono<{ Bindings: Bindings }>({});

// Minimal CORS support (useful for local dev without the Vite proxy)
app.use('/*', async (c, next) => {
  const origin = c.req.header('origin');
  if (origin) {
    c.header('access-control-allow-origin', origin);
    c.header('access-control-allow-credentials', 'true');
    c.header('access-control-allow-headers', 'authorization, content-type');
    c.header('access-control-allow-methods', 'GET,POST,OPTIONS');
  }
  if (c.req.method === 'OPTIONS') return c.body(null, 204);
  await next();
});

app.get('/health', (c) => json({ ok: true }));

// Expose schema for easy bootstrap (NOT a migration runner; returns SQL only).
app.get('/__schema', (c) => {
  if (String(c.env.TEST_MODE ?? '') !== '1') return json({ error: 'not_found' }, { status: 404 });
  return json({ sql: HOSTED_SCHEMA_SQL });
});

// Mount route modules
app.route('/', auth);
app.route('/', sync);
app.route('/', imports);
app.route('/', coingecko);
app.route('/', push);
app.route('/', alerts);
app.route('/', runner);
app.route('/', billing);

// --- Test-only reset (matches local Fastify API contract) ---
app.post('/__test/reset', async (c) => {
  if (String(c.env.TEST_MODE ?? '') !== '1') return json({ error: 'not_found' }, { status: 404 });
  const sql = getSql(c.env);
  await sql`TRUNCATE TABLE alert_trigger_logs, alert_mirror_state, server_alerts, web_push_subscriptions, expo_push_tokens, sync_envelopes, devices, users RESTART IDENTITY CASCADE`;
  return json({ ok: true });
});

// --- Global error handling ---
app.onError((err, c) => {
  if (err?.message === 'unauthorized') return json({ error: 'unauthorized' }, { status: 401 });
  if (err?.name === 'ZodError') return json({ error: 'bad_request', issues: (err as any).issues }, { status: 400 });
  return json({ error: 'internal_error', message: err?.message ?? String(err) }, { status: 500 });
});

export const onRequest = async (context: any) => {
  const req: Request = context.request;
  const url = new URL(req.url);

  if (url.pathname === '/api') url.pathname = '/';
  if (url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.slice('/api'.length) || '/';
    const rewritten = new Request(url.toString(), req as any);
    return app.fetch(rewritten, context.env, context);
  }

  return app.fetch(req, context.env, context);
};
