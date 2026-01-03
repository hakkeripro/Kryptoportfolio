import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

export type Env = {
  DATABASE_URL: string;
  JWT_SECRET: string;

  // Optional knobs for hosted MVP
  COINGECKO_BASE_URL?: string;
  COINGECKO_DEMO_API_KEY?: string;

  // Push (web)
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;

  // Runner auth (Cloudflare Cron worker -> Pages Functions)
  CRON_SECRET?: string;

  TEST_MODE?: string;
};

let sqlCache: NeonQueryFunction<any> | null = null;

export function getSql(env: Env): NeonQueryFunction<any> {
  if (sqlCache) return sqlCache;
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL_missing');
  sqlCache = neon(env.DATABASE_URL);
  return sqlCache;
}

// --- Schema ---

// Cloudflare Pages does not run migrations automatically.
// This helper exposes the SQL needed to bootstrap Neon/Postgres.
export const HOSTED_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT,
  created_at_iso TEXT NOT NULL,
  last_seen_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_envelopes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  device_id TEXT NOT NULL,
  cursor BIGSERIAL UNIQUE NOT NULL,
  created_at_iso TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  kdf_salt_base64 TEXT NOT NULL DEFAULT '',
  kdf_iterations INTEGER NOT NULL DEFAULT 0,
  ciphertext_base64 TEXT NOT NULL,
  nonce_base64 TEXT NOT NULL,
  checksum TEXT
);

CREATE INDEX IF NOT EXISTS sync_envelopes_user_cursor_idx ON sync_envelopes(user_id, cursor);

-- Push subscriptions (optional)
CREATE TABLE IF NOT EXISTS web_push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription_json TEXT NOT NULL,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  UNIQUE(user_id, endpoint)
);

CREATE TABLE IF NOT EXISTS expo_push_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  created_at_iso TEXT NOT NULL
);

-- Server-side alerts (explicit opt-in; does not decrypt user vault)
CREATE TABLE IF NOT EXISTS server_alerts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_json TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at_iso TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL,
  last_triggered_at_iso TEXT
);

CREATE INDEX IF NOT EXISTS server_alerts_user_idx ON server_alerts(user_id);

CREATE TABLE IF NOT EXISTS alert_mirror_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  state_json TEXT NOT NULL,
  updated_at_iso TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS alert_trigger_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  alert_id TEXT NOT NULL,
  triggered_at_iso TEXT NOT NULL,
  source TEXT NOT NULL,
  context_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS alert_trigger_logs_user_time_idx ON alert_trigger_logs(user_id, triggered_at_iso DESC);

-- Runner telemetry (cron / ping runner)
CREATE TABLE IF NOT EXISTS alert_runner_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_run_at_iso TEXT NOT NULL,
  last_error TEXT,
  last_evaluated INTEGER NOT NULL DEFAULT 0,
  last_triggered INTEGER NOT NULL DEFAULT 0,
  updated_at_iso TEXT NOT NULL
);

-- Web push delivery state (optional; safe to rerun)
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS next_attempt_at_iso TEXT;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS last_success_at_iso TEXT;

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_active_idx ON web_push_subscriptions(user_id, is_active);

`;
