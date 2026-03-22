-- Fix: allow passkey-only users (no password_hash, no google_sub).
-- The app layer validates that at least one auth method exists.
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_auth_method_check;
