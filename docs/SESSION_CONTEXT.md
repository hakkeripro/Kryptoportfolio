# Session Context

Paivitetty: 2026-03-13

## Projektin nykytila

### Valmiit ominaisuudet
- Core: ledger (append-only), Coinbase v2 import, lot engine (FIFO/LIFO/HIFO/AVG), portfolio snapshots, tax engine
- Web: React+Vite PWA, vault setup/unlock, login + E2E sync, Coinbase import stepper, autosync, dashboard/portfolio/transactions, asset mapping (CoinGecko), alerts CRUD + web push
- Local API: Fastify + SQLite
- Hosted: Cloudflare Pages Functions + Neon Postgres + Worker runner (cron)
- CI: GitHub Actions (unit + e2e) — puutteellinen (ei lint/typecheck/coverage)

### Avoimet P0-bugit
- ~~**KP-UI-001:** Vault passphrase ei pysy sessionissa (onboarding)~~ → ✅ korjattu (T-003 store-hajotus + e2e-testi)
- **KP-UI-002:** Price auto-refresh settings key mismatch (`settings` vs `settings_1`)
- **KP-ALERT-001:** Server alerts enable/replace voi tyhjentaa saannot
- **KP-IMPORT-001:** Coinbase JSON key -flow ristiriidassa UI-validoinnin kanssa

### Kriittinen tekninen velka (tunnistettu 2026-03-12)
- ~~`functions/api/[[path]].ts` = 1082-rivinen monolith~~ → ✅ T-002 hajotus valmis
- ~~`useAppStore.ts` = 278-rivinen god-object~~ → ✅ T-003 hajotus valmis
- ~~API-logiikka duplikoitu Fastify ↔ Hono~~ → ✅ T-004 jaettu logiikka `packages/core/src/api/`
- Testikattavuus liian matala (ei coverage-mittausta, ei error path -testeja)
- CI: puuttuu typecheck, lint, coverage, audit, preview deploy

### Seuraava tyovaihe
**→ Feature 12: Auth/Vault UX Redesign** — 🚧 TOTEUTUKSESSA
Core + UI + API valmis. E2E-testit paivitetty. Erilliset E2E-testit kesken.

Seuraavaksi: Feature 12 E2E-testit → Feature 13 (Imports) → Feature 14 (Billing)

---

## Muutosloki

### 2026-03-14 — Feature 12: Auth/Vault UX Redesign (core + UI)
**Luotu:**
- `packages/core/src/utils/passphraseGenerator.ts` — EFF wordlist (~200 sanaa), 5-7 sanan passphrase
- `packages/core/src/utils/passphraseGenerator.test.ts` — 9 unit-testia
- `packages/core/src/api/authCrypto.test.ts` — 3 unit-testia (changePassword)
- `apps/web/src/pages/WelcomePage.tsx` — landing: Sign in, Create account, Use without account
- `apps/web/src/pages/SignupPage.tsx` — rekisterointi: email + password + confirm
- `apps/web/src/pages/SigninPage.tsx` — kirjautuminen: email + password
- `apps/web/src/pages/VaultSetupPage.tsx` — 3-step wizard (passphrase → passkey → done)
- `apps/web/src/pages/AccountPage.tsx` — passkeys + security + data
- `apps/web/src/components/PassphraseGenerator.tsx` — generoi + copy
- `apps/web/src/components/PasskeyCard.tsx` — passkey info/action
- `apps/web/tests-e2e/helpers.ts` — jaetut E2E-apufunktiot (resetApp, signupAndSetupVault)

**Muutettu:**
- `packages/core/src/api/authCrypto.ts` — lisatty `changePassword()`
- `packages/core/src/api/index.ts` + `packages/core/src/index.ts` — uudet exportit
- `apps/web/src/vault/passkey.ts` — lisatty `listPasskeyWraps()`, `removePasskeyWrap()`
- `apps/api/src/routes/auth.ts` + `functions/api/routes/auth.ts` — `PUT /v1/auth/password`
- `apps/api/src/services/auth.ts` + `functions/_lib/auth.ts` — re-export changePassword
- `apps/web/src/store/useAuthStore.ts` — `changePassword()` action
- `apps/web/src/store/useVaultStore.ts` — `changePassphrase()` action
- `apps/web/src/app/App.tsx` — uudet reitit + backward compat redirectit
- `apps/web/src/components/RequireUnlocked.tsx` — `/welcome` + `/vault/unlock`
- `apps/web/src/components/Shell.tsx` — "Account" nav-linkki
- `apps/web/src/pages/UnlockPage.tsx` — paremmat virheviestit
- 6 E2E-testia paivitetty uuteen auth flowiin (shared helpers.ts)

**Testitulos:** Unit 103/103 ✅, Build OK

---

### 2026-03-12 — AI-kehitysympariston pystytys + kriittinen arvio
**Luotu:**
- `CLAUDE.md` — projektin AI-ohjeet (monorepo-rakenne, komennot, kriittiset polut, tyoskentelytavat)
- `docs/CODING_CONVENTIONS.md` — koodauskaytannot (TypeScript, Zod, nimeaminen, ledger, testaus)
- `docs/SESSION_CONTEXT.md` — sessioseuranta
- `docs/features/FEATURES_TODO.md` — master feature list (01-21) + Vaihe 0 tekninen velka (T-001..T-008)
- `docs/features/FEATURE_TEMPLATE.md` — pohja uusille feature-spekseille
- Claude Code memory system (user, project, feedback)

**Analyysi tehty:**
- Koodin laatuarvio (store, pages, API, tests, CI)
- Tunnistettu 8 teknisen velan tehtavaa (Vaihe 0)
- Tunnistettu vanhentuneet dokumentit (AI_HANDOFF, NEXT_AI_PROMPT, next-steps)
- Feature 21: AI-kehitysymparisto + workflow suunniteltu (skillit, MCP:t, CI/CD, laatuvaatimukset)

### 2026-03-13 — T-004: API-logiikan duplikaation poisto
**Luotu:**
- `packages/core/src/api/` — jaettu API-bisneslogiikka (7 tiedostoa):
  - `authCrypto.ts` — PBKDF2 hash/verify, normalizeEmail, newId (yhtenaistetty bcryptjs → PBKDF2)
  - `authJwt.ts` — JWT sign/verify jose-kirjastolla (yhtenaistetty @fastify/jwt → jose)
  - `apiErrors.ts` — Coinbase-virheluokittelu (jaettu)
  - `syncSchemas.ts` — Device/Envelope Zod-skeemat + mapEnvelopeRow
  - `alertSchemas.ts` — Enable/MirrorState/TriggerLog-skeemat + isAlertInCooldown + mapTriggerLogRow
  - `coingeckoProxy.ts` — Bounded cache, response-normalisointi, test-stubit
  - `pushSchemas.ts` — WebPush/Expo Zod-skeemat

**Muutettu:**
- `apps/api/src/services/auth.ts` — re-export @kp/core (bcryptjs poistettu)
- `apps/api/src/services/authHooks.ts` — delegoi JWT @kp/core:lle (@fastify/jwt poistettu)
- `apps/api/src/server.ts` — poistettu @fastify/jwt rekisterointi
- `apps/api/src/routes/*.ts` — kaikki 6 routea kayttavat jaettuja moduuleja
- `apps/api/src/services/serverAlerts.ts` — kayttaa isAlertInCooldown @kp/core:sta
- `functions/_lib/auth.ts` — re-export @kp/core
- `functions/_lib/alertEval.ts` — kayttaa isAlertInCooldown (puuttunut cooldown lisatty Hono-puolelle!)
- `functions/api/routes/*.ts` — kaikki 6 routea kayttavat jaettuja moduuleja

**Testitulos:** Unit 15/15 ✅, E2E 5/6 ✅ (1 pre-existing bugi: alerts trigger log)
