-- Migrate web_push_subscriptions: add delivery state columns.
-- These columns were previously added at runtime via ALTER TABLE;
-- now they are part of the base CREATE TABLE in HOSTED_SCHEMA_SQL.
-- This migration is idempotent for existing deployments.

ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS failure_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS next_attempt_at_iso TEXT;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE web_push_subscriptions ADD COLUMN IF NOT EXISTS last_success_at_iso TEXT;

CREATE INDEX IF NOT EXISTS web_push_subscriptions_user_active_idx ON web_push_subscriptions(user_id, is_active);
