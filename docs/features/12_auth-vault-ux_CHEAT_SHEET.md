# Feature 12: Auth/Vault UX Redesign - Cheat Sheet

## Database / Migrations
- **Ei DB-skeemamuutoksia** — vault blob + passkey wrap sailyvat nykyisilla formaateilla
- Ei uusia migraatioita

## API Endpoints
- `PUT /v1/auth/password` — vaihda salasana (JWT auth, `{currentPassword, newPassword}`)
- Lisattava: Fastify (`apps/api/src/routes/auth.ts`) + Hono (`functions/api/routes/auth.ts`)

## Core (packages/core)
- `src/utils/passphraseGenerator.ts` — generoi 5-7 sanan passphrase (EFF wordlist subset ~200)
- `src/api/authCrypto.ts` — lisaa `changePassword(currentPw, newPw, storedHash)`

## Platform (packages/platform-web)
- `apps/web/src/vault/passkey.ts` — lisaa `listPasskeyWraps()`, `removePasskeyWrap(credId)`

## Stores (apps/web/src/store)
- `useAuthStore.ts` — lisaa `changePassword(current, new)` action
- `useVaultStore.ts` — lisaa `changePassphrase(current, new)` action (re-encrypt vault blob)

## New Pages (apps/web/src/pages)
- `WelcomePage.tsx` (~80r) — CTA: Sign in, Create account, Use without account, passphrase info drawer
- `SignupPage.tsx` (~90r) — email + password + confirm, ohjaa vault setupiin
- `SigninPage.tsx` (~70r) — email + password, ohjaa vault unlock/setupiin
- `VaultSetupPage.tsx` (~150r) — Wizard: Step 1 passphrase → Step 2 passkey → Done
- `AccountPage.tsx` (~120r) — Passkeys + Security + Data -osiot

## New Components (apps/web/src/components)
- `PassphraseGenerator.tsx` (~40r) — generoi + nayta + copy-to-clipboard
- `PasskeyCard.tsx` (~50r) — passkey info/action (Unlock, Setup, Account)

## Modified Files
- `app/App.tsx` — uudet reitit, poista /onboarding (redirectaa)
- `pages/UnlockPage.tsx` — kaksi korttia (passkey + passphrase), microcopy
- `components/RequireUnlocked.tsx` — ohjaa `/welcome` (ei `/onboarding`)
- `components/Shell.tsx` — lisaa "Account" navigaatiolinkki

## Routing
```
/welcome              → WelcomePage (public)
/auth/signup           → SignupPage (public)
/auth/signin           → SigninPage (public)
/vault/setup           → VaultSetupPage (auth TAI offline)
/vault/unlock          → UnlockPage (vaatii vault blob)
/account               → AccountPage (vaatii unlocked vault)
/onboarding            → redirect → /welcome
```

## Flows
- **Uusi:** /welcome → /auth/signup → /vault/setup (3 step) → /dashboard
- **Palaava (sama laite):** /welcome → /auth/signin → /vault/unlock (passkey) → /dashboard
- **Palaava (uusi laite):** /welcome → /auth/signin → /vault/unlock (passphrase) → /dashboard
- **Offline:** /welcome → "Use without account" → /vault/setup → /dashboard

## Key Business Rules
- Passphrase validointi: vahintaan kentat tasmaa + "I saved it" checkbox
- Password validointi: vahintaan 8 merkkia, reaaliaikainen virheviesti
- Passkey on laitekohtainen — poistaminen yhdelta ei vaikuta toiseen
- Vault passphrase vaihto = re-encrypt vault blob (O(1), vain avainmateriaali)
- Nykyinen hmac-secret/PRF passkey -toteutus sailyy, lisataan fallback-viesti
- sessionStorage passphrase setupin jalkeen (ei tarvitse syottaa heti uudelleen)
