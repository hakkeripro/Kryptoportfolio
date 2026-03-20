-- Feature 46: Google OAuth
-- password_hash ei enää pakollinen (OAuth-käyttäjillä ei ole salasanaa)
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- Google OAuth sub-claim (UNIQUE; NULL email+salasana -käyttäjillä)
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;

-- Tili vaatii vähintään yhden auth-metodin
ALTER TABLE users ADD CONSTRAINT IF NOT EXISTS users_auth_method_check
  CHECK (password_hash IS NOT NULL OR google_sub IS NOT NULL);
