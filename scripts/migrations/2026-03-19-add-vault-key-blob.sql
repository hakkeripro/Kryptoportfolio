-- Feature 31: Multi-device Vault
-- Adds encrypted vault key blob so users can auto-unlock on new devices.
-- Zero-knowledge: server stores only AES-GCM ciphertext, never plaintext passphrase.
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_key_blob TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_key_salt TEXT;
