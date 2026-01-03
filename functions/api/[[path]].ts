import { Hono } from 'hono';
import { z } from 'zod';
import { AlertSchema, MirrorStateSchema, evaluateServerAlert } from '@kp/core';
import { buildPushPayload, type PushSubscription, type PushMessage, type VapidKeys } from '@block65/webcrypto-web-push';
import { json, readJson } from '../_lib/http';
import { getSql, HOSTED_SCHEMA_SQL, type Env } from '../_lib/db';
import { hashPassword, normalizeEmail, newId, requireAuth, signToken } from '../_lib/auth';
import { CoinbaseKeyError, normalizeCoinbaseCredentials } from '../_lib/coinbaseJwt';
import {
  coinbaseGetExchangeRates,
  coinbaseListAllAccounts,
  coinbaseListTransactionsPage,
  coinbaseShowTransaction
} from '../_lib/coinbaseV2Client';

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

// --- Auth ---

const RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8).max(128) });

app.post('/v1/auth/register', async (c) => {
  const body = RegisterSchema.parse(await readJson(c.req.raw));
  const email = normalizeEmail(body.email);
  const sql = getSql(c.env);

  const existing = await sql<{ id: string }[]>`SELECT id FROM users WHERE email = ${email} LIMIT 1`;
  if (existing.length) return json({ error: 'email_taken' }, { status: 409 });

  const userId = newId('usr');
  const passwordHash = await hashPassword(body.password);
  const createdAtISO = new Date().toISOString();

  await sql`INSERT INTO users (id, email, password_hash, created_at_iso) VALUES (${userId}, ${email}, ${passwordHash}, ${createdAtISO})`;

  const token = await signToken(c.env.JWT_SECRET, userId, email);
  return json({ user: { id: userId, email, createdAtISO }, token });
});

app.post('/v1/auth/login', async (c) => {
  const body = RegisterSchema.parse(await readJson(c.req.raw));
  const email = normalizeEmail(body.email);
  const sql = getSql(c.env);

  const rows = await sql<{ id: string; password_hash: string; created_at_iso: string }[]>`
    SELECT id, password_hash, created_at_iso FROM users WHERE email = ${email} LIMIT 1
  `;
  if (!rows.length) return json({ error: 'invalid_credentials' }, { status: 401 });
  const user = rows[0];

  // Import verifyPassword lazily to keep bundle smaller in case auth is unused.
  const { verifyPassword } = await import('../_lib/auth');
  const ok = await verifyPassword(body.password, user.password_hash);
  if (!ok) return json({ error: 'invalid_credentials' }, { status: 401 });

  const token = await signToken(c.env.JWT_SECRET, user.id, email);
  return json({ user: { id: user.id, email, createdAtISO: user.created_at_iso }, token });
});

app.get('/v1/me', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw).catch(() => {
    throw new Error('unauthorized');
  });
  const sql = getSql(c.env);
  const rows = await sql<{ id: string; email: string; created_at_iso: string }[]>`
    SELECT id,email,created_at_iso FROM users WHERE id = ${userId} LIMIT 1
  `;
  return json({ user: rows[0] ?? null });
});

// --- Sync ---

const DeviceSchema = z.object({ deviceId: z.string().min(4), name: z.string().optional() });
const EnvelopeSchema = z.object({
  id: z.string().min(8),
  deviceId: z.string().min(4),
  createdAtISO: z.string().datetime(),
  version: z.coerce.number().int().positive().default(1),
  kdf: z.object({ saltBase64: z.string().min(8), iterations: z.coerce.number().int().positive() }),
  ciphertextBase64: z.string().min(8),
  nonceBase64: z.string().min(8),
  checksum: z.string().optional()
});

app.post('/v1/devices/register', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = DeviceSchema.parse(await readJson(c.req.raw));
  const now = new Date().toISOString();
  const sql = getSql(c.env);

  const existing = await sql<{ id: string }[]>`SELECT id FROM devices WHERE id = ${body.deviceId} LIMIT 1`;
  if (existing.length) {
    await sql`UPDATE devices SET last_seen_at_iso=${now}, name=${body.name ?? null} WHERE id=${body.deviceId}`;
  } else {
    await sql`INSERT INTO devices(id, user_id, name, created_at_iso, last_seen_at_iso)
              VALUES (${body.deviceId}, ${userId}, ${body.name ?? null}, ${now}, ${now})`;
  }
  return json({ ok: true });
});

app.post('/v1/sync/envelopes', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = EnvelopeSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);

  const existing = await sql<{ cursor: string }[]>`
    SELECT cursor FROM sync_envelopes WHERE id=${body.id} AND user_id=${userId} LIMIT 1
  `;
  if (existing.length) return json({ ok: true, cursor: Number(existing[0].cursor) });

  const inserted = await sql<{ cursor: string }[]>`
    INSERT INTO sync_envelopes(
      id, user_id, device_id, created_at_iso, version,
      kdf_salt_base64, kdf_iterations, ciphertext_base64, nonce_base64, checksum
    ) VALUES (
      ${body.id}, ${userId}, ${body.deviceId}, ${body.createdAtISO}, ${body.version},
      ${body.kdf.saltBase64}, ${body.kdf.iterations}, ${body.ciphertextBase64}, ${body.nonceBase64}, ${body.checksum ?? null}
    )
    RETURNING cursor
  `;

  return json({ ok: true, cursor: Number(inserted[0]?.cursor ?? 0) });
});

app.get('/v1/sync/envelopes', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const q = z
    .object({
      afterCursor: z.coerce.number().int().nonnegative().default(0),
      limit: z.coerce.number().int().min(1).max(500).default(200)
    })
    .parse((c.req.query() as any) ?? {});

  const sql = getSql(c.env);
  const rows = await sql<any[]>`
    SELECT id, device_id, cursor, created_at_iso, version, kdf_salt_base64, kdf_iterations,
           ciphertext_base64, nonce_base64, checksum
    FROM sync_envelopes
    WHERE user_id=${userId} AND cursor > ${q.afterCursor}
    ORDER BY cursor ASC
    LIMIT ${q.limit}
  `;

  return json({
    envelopes: rows.map((r) => ({
      id: r.id,
      deviceId: r.device_id,
      cursor: Number(r.cursor),
      createdAtISO: r.created_at_iso,
      version: Number(r.version ?? 1),
      kdf: { saltBase64: String(r.kdf_salt_base64 ?? ''), iterations: Number(r.kdf_iterations ?? 0) },
      ciphertextBase64: r.ciphertext_base64,
      nonceBase64: r.nonce_base64,
      checksum: r.checksum ?? undefined
    }))
  });
});

// --- Imports (Coinbase v2) ---

const CoinbaseCredentialsSchema = z.object({ keyName: z.string().optional(), privateKeyPem: z.string().min(1) });

function sendCoinbaseError(e: unknown) {
  const msg = e instanceof Error ? e.message : String(e);
  if (
    e instanceof CoinbaseKeyError ||
    msg.startsWith('coinbase_key') ||
    msg.startsWith('coinbase_key_') ||
    msg.includes('DECODER routines')
  ) {
    return { status: 400, body: { error: 'coinbase_key_invalid', message: msg } };
  }
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
            '• machine clock must be correct (JWT nbf/exp are strict).'
          ].join('\n')
        : undefined;
    return { status, body: { error: code, message: msg, ...(hint ? { hint } : {}) } };
  }
  return { status: 502, body: { error: 'coinbase_proxy_error', message: msg } };
}

app.post('/v1/import/coinbase/v2/accounts', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const raw = CoinbaseCredentialsSchema.parse(await readJson(c.req.raw));
  try {
    const norm = await normalizeCoinbaseCredentials(raw);
    const accounts = await coinbaseListAllAccounts({ keyName: norm.keyName, privateKeyPem: norm.privateKeyPem });
    return json({ accounts });
  } catch (e) {
    const { status, body } = sendCoinbaseError(e);
    return json(body, { status });
  }
});

app.post('/v1/import/coinbase/v2/transactions/page', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const schema = z
    .object({
      ...CoinbaseCredentialsSchema.shape,
      accountId: z.string().min(1),
      nextUri: z.string().optional().nullable(),
      limit: z.number().int().min(1).max(100).optional()
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
    const { status, body } = sendCoinbaseError(e);
    return json(body, { status });
  }
});

app.post('/v1/import/coinbase/v2/transactions/show', async (c) => {
  await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const schema = z
    .object({
      ...CoinbaseCredentialsSchema.shape,
      accountId: z.string().min(1),
      transactionId: z.string().min(1)
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
    const { status, body } = sendCoinbaseError(e);
    return json(body, { status });
  }
});

app.get('/v1/import/coinbase/v2/exchange-rates', async (c) => {
  const currency = c.req.query('currency');
  try {
    const rates = await coinbaseGetExchangeRates(typeof currency === 'string' ? currency : undefined);
    return json(rates);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return json({ error: 'coinbase_proxy_error', message: msg }, { status: 502 });
  }
});

// --- Catalog (CoinGecko proxy) ---

type CacheEntry = { expiresAt: number; value: unknown };
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | null {
  const e = cache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) {
    cache.delete(key);
    return null;
  }
  return e.value;
}

function setCached(key: string, value: unknown, ttlMs: number) {
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
}

function coingeckoBase(env: Env): string {
  return String(env.COINGECKO_BASE_URL ?? 'https://api.coingecko.com/api/v3').replace(/\/$/, '');
}

function coingeckoHeaders(env: Env): Record<string, string> {
  const key = env.COINGECKO_DEMO_API_KEY;
  return key ? { 'x-cg-demo-api-key': String(key) } : {};
}

app.get('/v1/catalog/coingecko/search', async (c) => {
  const query = z.string().min(1).max(80).parse(c.req.query('query'));

  const cacheKey = `search:${query.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return json(cached as any);

  const url = `${coingeckoBase(c.env)}/search?query=${encodeURIComponent(query)}`;
  const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(c.env) } });
  if (!r.ok) return json({ error: 'coingecko_proxy_error', status: r.status }, { status: 502 });
  const raw = (await r.json()) as any;

  const coins = Array.isArray(raw?.coins)
    ? raw.coins.map((c: any) => ({
        id: String(c.id ?? ''),
        name: String(c.name ?? ''),
        symbol: String(c.symbol ?? ''),
        market_cap_rank: typeof c.market_cap_rank === 'number' ? c.market_cap_rank : null,
        thumb: c.thumb ? String(c.thumb) : null,
        large: c.large ? String(c.large) : null
      }))
    : [];

  const out = { coins };
  setCached(cacheKey, out, 10 * 60_000);
  return json(out);
});

app.get('/v1/prices/coingecko/simple', async (c) => {
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

  const url = `${coingeckoBase(c.env)}/simple/price?ids=${encodeURIComponent(
    ids.join(',')
  )}&vs_currencies=${encodeURIComponent(vs)}&include_last_updated_at=true`;
  const r = await fetch(url, { headers: { accept: 'application/json', ...coingeckoHeaders(c.env) } });
  if (!r.ok) return json({ error: 'coingecko_proxy_error', status: r.status }, { status: 502 });
  const raw = (await r.json()) as any;

  const prices: Record<string, number> = {};
  const lastUpdatedAt: Record<string, number> = {};
  for (const id of ids) {
    const entry = raw?.[id];
    const p = entry?.[vs];
    if (typeof p === 'number') prices[id] = p;
    const lu = entry?.last_updated_at;
    if (typeof lu === 'number') lastUpdatedAt[id] = lu;
  }

  const out = { vsCurrency: vs, prices, lastUpdatedAt };
  setCached(cacheKey, out, 30_000);
  return json(out);
});

// --- Push (web) ---

const WebPushSubscribeSchema = z.object({ subscription: z.record(z.any()) });
const WebPushUnsubscribeSchema = z.object({ endpoint: z.string().url() });

function isWebPushConfigured(env: Env): boolean {
  return !!(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY);
}

function getVapid(env: Env): VapidKeys {
  return {
    subject: String(env.VAPID_SUBJECT ?? 'mailto:admin@example.com'),
    publicKey: String(env.VAPID_PUBLIC_KEY ?? ''),
    privateKey: String(env.VAPID_PRIVATE_KEY ?? '')
  };
}

function backoffNextAttemptISO(nowISO: string, failureCount: number): string {
  // Exponential backoff: 1m, 2m, 4m, ... capped to 24h
  const baseMs = 60_000;
  const ms = Math.min(baseMs * Math.pow(2, Math.max(0, failureCount)), 24 * 60 * 60_000);
  return new Date(new Date(nowISO).getTime() + ms).toISOString();
}

async function sendWebPushToUser(
  sql: any,
  env: Env,
  userId: string,
  message: PushMessage
): Promise<{ ok: boolean; attempted: number; delivered: number; deactivated: number; failed: number }> {
  if (!isWebPushConfigured(env)) return { ok: true, attempted: 0, delivered: 0, deactivated: 0, failed: 0 };

  const nowISO = new Date().toISOString();
  const rows = await sql<
    {
      id: string;
      endpoint: string;
      subscription_json: string;
      failure_count: number;
      next_attempt_at_iso: string | null;
    }[]
  >`
    SELECT id, endpoint, subscription_json, failure_count, next_attempt_at_iso
    FROM web_push_subscriptions
    WHERE user_id=${userId} AND is_active=TRUE
      AND (next_attempt_at_iso IS NULL OR next_attempt_at_iso <= ${nowISO})
    ORDER BY updated_at_iso DESC
    LIMIT 50
  `;

  let attempted = 0;
  let delivered = 0;
  let deactivated = 0;
  let failed = 0;

  const vapid = getVapid(env);

  for (const r of rows) {
    attempted++;
    let sub: PushSubscription;
    try {
      sub = JSON.parse(String(r.subscription_json)) as PushSubscription;
    } catch {
      failed++;
      await sql`
        UPDATE web_push_subscriptions
        SET is_active=FALSE, last_error=${'invalid_subscription_json'}, updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
      deactivated++;
      continue;
    }

    try {
      const payload = await buildPushPayload(message, sub, vapid);
      const res = await fetch(sub.endpoint, payload as any);

      if (res.status >= 200 && res.status < 300) {
        delivered++;
        await sql`
          UPDATE web_push_subscriptions
          SET failure_count=0,
              next_attempt_at_iso=NULL,
              last_error=NULL,
              last_success_at_iso=${nowISO},
              updated_at_iso=${nowISO}
          WHERE id=${r.id} AND user_id=${userId}
        `;
        continue;
      }

      // 404/410 are typical for expired subscriptions
      if (res.status === 404 || res.status === 410) {
        deactivated++;
        await sql`
          UPDATE web_push_subscriptions
          SET is_active=FALSE,
              failure_count=failure_count+1,
              next_attempt_at_iso=NULL,
              last_error=${'expired_' + String(res.status)},
              updated_at_iso=${nowISO}
          WHERE id=${r.id} AND user_id=${userId}
        `;
        continue;
      }

      failed++;
      const nextISO = backoffNextAttemptISO(nowISO, (r.failure_count ?? 0) + 1);
      await sql`
        UPDATE web_push_subscriptions
        SET failure_count=failure_count+1,
            next_attempt_at_iso=${nextISO},
            last_error=${'http_' + String(res.status)},
            updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
    } catch (e: any) {
      failed++;
      const nextISO = backoffNextAttemptISO(nowISO, (r.failure_count ?? 0) + 1);
      await sql`
        UPDATE web_push_subscriptions
        SET failure_count=failure_count+1,
            next_attempt_at_iso=${nextISO},
            last_error=${String(e?.message ?? e)},
            updated_at_iso=${nowISO}
        WHERE id=${r.id} AND user_id=${userId}
      `;
    }
  }

  return { ok: true, attempted, delivered, deactivated, failed };
}

app.get('/v1/push/web/vapidPublicKey', async (c) => {
  const enabled = isWebPushConfigured(c.env);
  return json({ enabled, publicKey: enabled ? c.env.VAPID_PUBLIC_KEY : null });
});

app.post('/v1/push/web/subscribe', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = WebPushSubscribeSchema.parse(await readJson(c.req.raw));

  const sub = body.subscription as any;
  const endpoint = String(sub?.endpoint ?? '');
  if (!endpoint) return json({ error: 'invalid_subscription' }, { status: 400 });

  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  const existing = await sql<{ id: string }[]>`
    SELECT id FROM web_push_subscriptions WHERE user_id=${userId} AND endpoint=${endpoint} LIMIT 1
  `;

  if (existing.length) {
    await sql`
      UPDATE web_push_subscriptions
      SET subscription_json=${JSON.stringify(sub)}, updated_at_iso=${nowISO}, is_active=TRUE
      WHERE id=${existing[0].id} AND user_id=${userId}
    `;
  } else {
    await sql`
      INSERT INTO web_push_subscriptions(id,user_id,endpoint,subscription_json,created_at_iso,updated_at_iso,is_active)
      VALUES (${newId('wps')}, ${userId}, ${endpoint}, ${JSON.stringify(sub)}, ${nowISO}, ${nowISO}, TRUE)
    `;
  }

  return json({ ok: true });
});

app.post('/v1/push/web/unsubscribe', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = WebPushUnsubscribeSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  await sql`DELETE FROM web_push_subscriptions WHERE user_id=${userId} AND endpoint=${body.endpoint}`;
  return json({ ok: true });
});

app.post('/v1/push/web/test', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);

  if (!isWebPushConfigured(c.env)) {
    return json({ ok: false, error: 'push_not_configured' }, { status: 400 });
  }

  const payload = {
    title: 'Kryptoportfolio',
    body: 'Test notification',
    url: '/alerts',
    data: { kind: 'TEST' }
  };

  const msg: PushMessage = { data: JSON.stringify(payload), options: { ttl: 60 } };
  const r = await sendWebPushToUser(sql, c.env, userId, msg);
  return json({ ok: true, ...r });
});


// --- Server alerts ---

const EnableServerAlertsSchema = z.object({
  alerts: z.array(AlertSchema),
  state: MirrorStateSchema
});

const MirrorStateBodySchema = z.object({ state: MirrorStateSchema });

function getRunnerBearer(req: Request): string | null {
  const h = req.headers.get('authorization') ?? '';
  const m = /^Bearer\s+(.+)$/i.exec(h);
  return m ? m[1] : null;
}

function requireRunner(env: Env, req: Request): void {
  const secret = String(env.CRON_SECRET ?? '');
  if (!secret) throw new Error('unauthorized');
  const bearer = getRunnerBearer(req);
  if (!bearer || bearer !== secret) throw new Error('unauthorized');
}

async function evalAlerts(
  sql: any,
  env: Env,
  userId: string,
  state: any,
  source: string
): Promise<{ ok: boolean; evaluated: number; triggered: number }> {
  const rows = await sql<
    { id: string; alert_json: string; is_enabled: boolean; last_triggered_at_iso: string | null }[]
  >`
    SELECT id, alert_json, is_enabled, last_triggered_at_iso
    FROM server_alerts
    WHERE user_id=${userId} AND is_enabled=TRUE
  `;

  let evaluated = 0;
  let triggered = 0;

  for (const row of rows) {
    let alert: any;
    try {
      alert = AlertSchema.parse(JSON.parse(String(row.alert_json)));
      if (row.last_triggered_at_iso) alert.lastTriggeredAtISO = row.last_triggered_at_iso;
      alert.isEnabled = !!row.is_enabled;
    } catch {
      continue;
    }

    evaluated++;
    const res = evaluateServerAlert(alert, state);
    if (!res.triggered) continue;

    triggered++;
    const trigISO = String(state.nowISO ?? new Date().toISOString());

    try {
      await sql`
        UPDATE server_alerts
        SET last_triggered_at_iso=${trigISO}, updated_at_iso=${new Date().toISOString()}
        WHERE id=${row.id} AND user_id=${userId}
      `;
    } catch {}

    try {
      await sql`
        INSERT INTO alert_trigger_logs(id,user_id,alert_id,triggered_at_iso,source,context_json)
        VALUES (${newId('tr')}, ${userId}, ${row.id}, ${trigISO}, ${source}, ${JSON.stringify(res.context)})
      `;
    } catch {}
  }

  if (triggered > 0) {
    const notif = {
      title: 'Kryptoportfolio alert',
      body: triggered === 1 ? '1 alert triggered' : `${triggered} alerts triggered`,
      url: '/alerts',
      data: { count: triggered, source }
    };

    const msg: PushMessage = { data: JSON.stringify(notif), options: { ttl: 60 } };
    try {
      await sendWebPushToUser(sql, env, userId, msg);
    } catch {}
  }

  return { ok: true, evaluated, triggered };
}

app.post('/v1/alerts/server/enable', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = EnableServerAlertsSchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  // Preserve last_triggered_at_iso for cooldown continuity.
  const existing = await sql<{ id: string; last_triggered_at_iso: string | null }[]>`
    SELECT id, last_triggered_at_iso FROM server_alerts WHERE user_id=${userId}
  `;
  const lastById = new Map(existing.map((r) => [String(r.id), r.last_triggered_at_iso] as const));

  // Replace the full set (append-only is not needed server-side here; user vault remains local).
  await sql`DELETE FROM server_alerts WHERE user_id=${userId}`;

  for (const a of body.alerts) {
    const lastISO = (a as any).lastTriggeredAtISO ?? lastById.get(String(a.id)) ?? null;
    await sql`
      INSERT INTO server_alerts(id, user_id, alert_json, is_enabled, created_at_iso, updated_at_iso, last_triggered_at_iso)
      VALUES (${String(a.id)}, ${userId}, ${JSON.stringify({ ...a, lastTriggeredAtISO: lastISO })}, ${!!a.isEnabled}, ${String(
        a.createdAtISO
      )}, ${String(a.updatedAtISO)}, ${lastISO})
      ON CONFLICT (id) DO UPDATE SET
        alert_json = EXCLUDED.alert_json,
        is_enabled = EXCLUDED.is_enabled,
        updated_at_iso = EXCLUDED.updated_at_iso,
        last_triggered_at_iso = EXCLUDED.last_triggered_at_iso
      WHERE server_alerts.user_id = EXCLUDED.user_id
    `;
  }

  await sql`
    INSERT INTO alert_mirror_state(user_id, state_json, updated_at_iso)
    VALUES (${userId}, ${JSON.stringify(body.state)}, ${nowISO})
    ON CONFLICT (user_id)
    DO UPDATE SET state_json = EXCLUDED.state_json, updated_at_iso = EXCLUDED.updated_at_iso
  `;

  const r = await evalAlerts(sql, c.env, userId, body.state, 'enable');
  return json({ ok: true, ...r });
});

app.post('/v1/alerts/server/state', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const body = MirrorStateBodySchema.parse(await readJson(c.req.raw));
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  await sql`
    INSERT INTO alert_mirror_state(user_id, state_json, updated_at_iso)
    VALUES (${userId}, ${JSON.stringify(body.state)}, ${nowISO})
    ON CONFLICT (user_id)
    DO UPDATE SET state_json = EXCLUDED.state_json, updated_at_iso = EXCLUDED.updated_at_iso
  `;

  const r = await evalAlerts(sql, c.env, userId, body.state, 'state');
  return json({ ok: true, ...r });
});

app.get('/v1/alerts/server/status', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);

  const cnt = await sql<{ total: string; enabled: string }[]>`
    SELECT COUNT(*)::text as total, SUM(CASE WHEN is_enabled THEN 1 ELSE 0 END)::text as enabled
    FROM server_alerts WHERE user_id=${userId}
  `;
  const ms = await sql<{ updated_at_iso: string }[]>`
    SELECT updated_at_iso FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
  `;
  const rs = await sql<
    { last_run_at_iso: string; last_error: string | null; last_evaluated: number; last_triggered: number }[]
  >`
    SELECT last_run_at_iso, last_error, last_evaluated, last_triggered
    FROM alert_runner_state
    WHERE user_id=${userId}
    LIMIT 1
  `;

  return json({
    enabled: Number(cnt[0]?.enabled ?? 0),
    total: Number(cnt[0]?.total ?? 0),
    mirrorUpdatedAtISO: ms[0]?.updated_at_iso ?? null,
    runnerLastRunAtISO: rs[0]?.last_run_at_iso ?? null,
    runnerLastError: rs[0]?.last_error ?? null,
    runnerLastEvaluated: rs[0]?.last_evaluated ?? null,
    runnerLastTriggered: rs[0]?.last_triggered ?? null
  });
});

app.post('/v1/alerts/server/run', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const sql = getSql(c.env);
  const nowISO = new Date().toISOString();

  const stateRow = await sql<{ state_json: string }[]>`
    SELECT state_json FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
  `;

  if (!stateRow.length) {
    try {
      await sql`
        INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
        VALUES (${userId},${nowISO},NULL,0,0,${nowISO})
        ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
      `;
    } catch {}
    return json({ ok: true, evaluated: 0, triggered: 0 });
  }

  let state: any;
  try {
    state = MirrorStateSchema.parse(JSON.parse(String(stateRow[0].state_json)));
  } catch {
    try {
      await sql`
        INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
        VALUES (${userId},${nowISO},${'invalid_state'},0,0,${nowISO})
        ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${'invalid_state'}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
      `;
    } catch {}
    return json({ ok: false, error: 'invalid_state' }, { status: 400 });
  }

  const res = await evalAlerts(sql, c.env, userId, state, 'cron');

  try {
    await sql`
      INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
      VALUES (${userId},${nowISO},NULL,${res.evaluated ?? 0},${res.triggered ?? 0},${nowISO})
      ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=${res.evaluated ?? 0}, last_triggered=${res.triggered ?? 0}, updated_at_iso=${nowISO}
    `;
  } catch {}

  return json(res);
});

app.post('/v1/alerts/server/runAll', async (c) => {
  requireRunner(c.env, c.req.raw);
  const sql = getSql(c.env);

  const limit = z.coerce.number().int().min(1).max(1000).default(200).parse(c.req.query('limit') ?? 200);
  const nowISO = new Date().toISOString();

  const users = await sql<{ user_id: string }[]>`
    SELECT DISTINCT s.user_id
    FROM server_alerts s
    JOIN alert_mirror_state m ON m.user_id=s.user_id
    WHERE s.is_enabled=TRUE
    LIMIT ${limit}
  `;

  let usersOk = 0;
  let usersErrored = 0;
  let evaluatedTotal = 0;
  let triggeredTotal = 0;

  for (const u of users) {
    const userId = String(u.user_id);

    const stateRow = await sql<{ state_json: string }[]>`
      SELECT state_json FROM alert_mirror_state WHERE user_id=${userId} LIMIT 1
    `;
    if (!stateRow.length) continue;

    let state: any;
    try {
      state = MirrorStateSchema.parse(JSON.parse(String(stateRow[0].state_json)));
    } catch {
      usersErrored++;
      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},${'invalid_state'},0,0,${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${'invalid_state'}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
        `;
      } catch {}
      continue;
    }

    try {
      const res = await evalAlerts(sql, c.env, userId, state, 'cron');
      evaluatedTotal += res.evaluated ?? 0;
      triggeredTotal += res.triggered ?? 0;
      usersOk++;

      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},NULL,${res.evaluated ?? 0},${res.triggered ?? 0},${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=NULL, last_evaluated=${res.evaluated ?? 0}, last_triggered=${res.triggered ?? 0}, updated_at_iso=${nowISO}
        `;
      } catch {}
    } catch (e: any) {
      usersErrored++;
      try {
        await sql`
          INSERT INTO alert_runner_state(user_id,last_run_at_iso,last_error,last_evaluated,last_triggered,updated_at_iso)
          VALUES (${userId},${nowISO},${String(e?.message ?? e)},0,0,${nowISO})
          ON CONFLICT (user_id) DO UPDATE SET last_run_at_iso=${nowISO}, last_error=${String(e?.message ?? e)}, last_evaluated=0, last_triggered=0, updated_at_iso=${nowISO}
        `;
      } catch {}
    }
  }

  return json({ ok: true, users: users.length, usersOk, usersErrored, evaluatedTotal, triggeredTotal });
});

app.get('/v1/alerts/server/log', async (c) => {
  const { userId } = await requireAuth(c.env.JWT_SECRET, c.req.raw);
  const limit = z.coerce.number().int().min(1).max(200).default(50).parse(c.req.query('limit') ?? 50);
  const sql = getSql(c.env);
  const rows = await sql<{ id: string; alert_id: string; triggered_at_iso: string; source: string; context_json: string }[]>`
    SELECT id, alert_id, triggered_at_iso, source, context_json
    FROM alert_trigger_logs
    WHERE user_id=${userId}
    ORDER BY triggered_at_iso DESC
    LIMIT ${limit}
  `;
  return json({
    triggers: rows.map((r) => ({
      id: r.id,
      alertId: r.alert_id,
      triggeredAtISO: r.triggered_at_iso,
      source: r.source,
      context: (() => {
        try {
          return JSON.parse(String(r.context_json ?? '{}'));
        } catch {
          return {};
        }
      })()
    }))
  });
});


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
  // zod errors
  if (err?.name === 'ZodError') return json({ error: 'bad_request', issues: (err as any).issues }, { status: 400 });
  return json({ error: 'internal_error', message: err?.message ?? String(err) }, { status: 500 });
});

export const onRequest = async (context: any) => {
  // Cloudflare Pages may mount this function under "/api" and strip the prefix (mountPath),
  // or pass the original pathname through. Make routing work in both cases.
  const req: Request = context.request;
  const url = new URL(req.url);

  if (url.pathname === '/api') url.pathname = '/';
  if (url.pathname.startsWith('/api/')) {
    url.pathname = url.pathname.slice('/api'.length) || '/';
    // Cloudflare Workers runtime supports `new Request(url, request)` to preserve method/headers/body.
    const rewritten = new Request(url.toString(), req as any);
    return app.fetch(rewritten, context.env, context);
  }

  return app.fetch(req, context.env, context);
};
