-- Feature 47: WebAuthn / Passkey credentials
-- Each row represents one registered passkey for a user.
-- The vault-key-blob is encrypted with the PRF-derived key so the
-- server never sees the raw vault key.

CREATE TABLE IF NOT EXISTS webauthn_credentials (
  id               TEXT PRIMARY KEY,           -- credential ID (base64url)
  user_id          TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  public_key       TEXT NOT NULL,              -- COSE key (base64url)
  sign_count       INTEGER NOT NULL DEFAULT 0, -- replay protection
  prf_salt         TEXT NOT NULL,              -- 32-byte random salt (base64url)
  vault_key_blob   TEXT,                       -- vault key encrypted with PRF-derived key (JSON)
  device_name      TEXT,                       -- user-provided label, e.g. "MacBook Touch ID"
  created_at_iso   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials(user_id);
