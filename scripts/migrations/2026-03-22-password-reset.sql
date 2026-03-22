-- Feature 47: Password reset tokens
-- One-time tokens sent via email to allow password recovery.
-- Note: resetting password permanently clears the vault blob (zero-knowledge constraint).

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id            TEXT PRIMARY KEY,           -- 32-byte random hex token
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at_iso TEXT NOT NULL,             -- 1h TTL
  used_at_iso   TEXT                        -- NULL = not yet used
);

CREATE INDEX IF NOT EXISTS password_reset_tokens_user_idx ON password_reset_tokens(user_id);
