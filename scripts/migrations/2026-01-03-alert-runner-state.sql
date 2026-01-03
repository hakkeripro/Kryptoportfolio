-- Phase 6: server alerts runner state
-- Safe to run multiple times.

CREATE TABLE IF NOT EXISTS alert_runner_state (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  last_run_at_iso TEXT NOT NULL,
  last_error TEXT,
  last_evaluated INTEGER NOT NULL DEFAULT 0,
  last_triggered INTEGER NOT NULL DEFAULT 0,
  updated_at_iso TEXT NOT NULL
);
