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
Ei avoimia P0-bugeja. Kaikki korjattu 2026-03-14.

### Kriittinen tekninen velka (tunnistettu 2026-03-12)
- ~~`functions/api/[[path]].ts` = 1082-rivinen monolith~~ → ✅ T-002 hajotus valmis
- ~~`useAppStore.ts` = 278-rivinen god-object~~ → ✅ T-003 hajotus valmis
- ~~API-logiikka duplikoitu Fastify ↔ Hono~~ → ✅ T-004 jaettu logiikka `packages/core/src/api/`
- Testikattavuus liian matala (ei coverage-mittausta, ei error path -testeja)
- CI: puuttuu typecheck, lint, coverage, audit, preview deploy

### Seuraava tyovaihe
**→ Feature 13: Imports Plugin Registry + Wizard** — seuraava
Feature 22 (UI/UX Redesign) valmis. Feature 12 (Auth/Vault UX) valmis.

Seuraavaksi: Feature 13 (Imports) → Feature 14 (Billing)

---

## Muutosloki

### 2026-03-15 — Feature 22: UI/UX Redesign + Design System (koko feature)
**Phase A: Design System Foundation**
- `apps/web/src/styles/tokens.css` — CSS custom properties (Obsidian dark theme)
- `apps/web/tailwind.config.cjs` — custom theme (colors, fonts, spacing, radii)
- `apps/web/src/components/ui/` — 14 UI-komponenttia (Button, Card, Input, Select, Badge, Spinner, Modal, Drawer, Tabs, Tooltip, EmptyState, TokenIcon, KpiCard, Logo)
- `@fontsource/inter` (400/500/600/700) + `lucide-react` icons

**Phase B: Navigation + Shell**
- `apps/web/src/components/Sidebar.tsx` — desktop sidebar (5 nav items + logo + lock/sync)
- `apps/web/src/components/BottomTabBar.tsx` — mobile bottom tab bar
- `apps/web/src/components/AppShell.tsx` — layout wrapper
- `apps/web/src/app/App.tsx` — route restructure (17→5 views + sub-routes + redirects)
- E2E helpers: `spaNavigate()` for SPA navigation

**Phase C: Branding + Welcome**
- `apps/web/src/pages/WelcomePage.tsx` — redesigned with USP cards + CTA
- `apps/web/public/favicon.svg` — shield/keyhole brand icon
- PWA manifest updates (VaultFolio, theme_color)

**Phase D: Page Redesigns**
- DashboardPage + PortfolioPage fully rewritten with UI components
- Design tokens applied to ALL 15+ pages and 5 settings cards
- `useDashboardRefresh.ts` hook extracted

**Phase E: i18n**
- `apps/web/src/i18n/` — react-i18next config + EN/FI locales (~320 keys)
- Language selector in Settings
- Translations applied to nav, Dashboard, Portfolio, Welcome, Signup, Signin, Tax, Settings

**Phase F: Mobile Polish**
- Swipe-to-close Drawer, 44px touch targets, safe area CSS, PWA standalone meta tags

**Testit lisätty (2026-03-15):**
- `apps/web/src/components/ui/ui-components.test.tsx` — 44 unit-testiä (14 UI-komponenttia)
- `apps/web/src/i18n/i18n.test.ts` — 6 testiä (EN/FI locale key parity)
- `apps/web/tests-e2e/feature22-ui-redesign.spec.ts` — 7 E2E-testiä (welcome, navigation, redirects, mobile, language switch)
- `apps/web/src/pages/SettingsPage.tsx` — language selector test IDs lisätty

**Testitulos:** Build OK, Unit tests 155/155 ✅

---

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
