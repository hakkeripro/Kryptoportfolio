# Session Context

Paivitetty: 2026-03-20

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

**Strateginen uudelleenarviointi tehty 2026-03-19.** Roadmap v2 kirjoitettu.

Järjestys: Vaihe 0 (beta-valmius) → Vaihe 1 (tuote kuntoon) → Vaihe 2 (toiminimi) → Vaihe 3 (launch: Stripe + beta pois)

**Vaihe 0 — aloitetaan:**
1. ~~TASK: KP-TEST-001 korjaus~~ ✅
2. ~~TASK: Beta-banneri~~ ✅
3. ~~Feature 31: Multi-device Vault~~ ✅ (2026-03-19)
4. Feature 32: Onboarding Simplification
5. Feature 33: Multi-currency (USD/EUR/GBP)
6. Feature 34: International Mode (portfolio-only ei-FI käyttäjille)
7. Feature 29: Alert Delivery Diagnostics
8. Feature 35: Exchange Coverage (Northcrypto, Coinmotion, Bybit, OKX, Ledger Live)
9. Feature 36: Wallet-osoite Import (Ethereum + Bitcoin)
10. Feature 37: Import FetchPanel → Drawer

Ks. `docs/features/FEATURES_TODO.md` ja `docs/PRODUCT_ROADMAP_2026.md`

**Manuaaliset deployment-tehtävät (käyttäjän mukaan DNS jo tehty):**
- Cloudflare Pages: `privateledger-landing` projekti (build: `pnpm --filter @kp/landing build`, output: `dist/`)
- OG-kuva (`apps/landing/public/og-image.png`, 1200×630px) — tehdään launchia varten (Feature 42)

---

## Muutosloki

### 2026-03-20 — Feature 46: Google OAuth + Transparent PIN Vault

**Uudet tiedostot:**
- `scripts/migrations/2026-03-20-google-oauth.sql` — `password_hash` nullable, `google_sub` UNIQUE + CHECK constraint
- `apps/web/src/lib/googleOAuth.ts` — PKCE-helper (`initiateGoogleOAuth`)
- `apps/web/src/pages/OAuthCallbackPage.tsx` — OAuth callback + PIN setup/enter + vault reset
- `apps/web/tests-e2e/auth-google-oauth.spec.ts` — 6 E2E-testiä (ensirekisteröinti, palaava käyttäjä, väärä PIN, vault reset, email_taken_password, access_denied)

**Muutetut tiedostot:**
- `functions/_lib/db.ts` — `HOSTED_SCHEMA_SQL` päivitetty (password_hash nullable, google_sub), `Env` type: GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET
- `functions/api/routes/auth.ts` — `POST /v1/auth/oauth/google` (Google token exchange + userinfo + create/find user)
- `functions/api/routes/vault-key.ts` — `DELETE /v1/vault/key`
- `apps/api/src/db/db.ts` — users-taulu nullable passwordHash, googleSub kolumni, ensureColumn
- `apps/api/src/routes/auth.ts` — mock `POST /v1/auth/oauth/google` (E2E-testejä varten)
- `apps/api/src/routes/vault-key.ts` — `DELETE /v1/vault/key`
- `apps/web/src/store/useAuthStore.ts` — `authMethod` field + `loginWithGoogle` + `setupOAuthVault` + `unlockWithPin` + `resetVault`
- `apps/web/src/app/App.tsx` — `/auth/callback` reitti lisätty
- `apps/web/src/pages/SigninPage.tsx` — "Continue with Google" -nappi
- `apps/web/src/pages/SignupPage.tsx` — "Continue with Google" -nappi
- `apps/web/src/pages/UnlockPage.tsx` — auth-method haarautuminen (PIN vs salasana)

**Testit:** 266 unit-testiä ✅ (kaikki läpäisty). E2E: 6 uutta testiä (ei ajettu — vaatii dev-serverin).

**Deploy-muistio:**
1. Aja DB-migraatio: `DATABASE_URL="..." pnpm migrate:run`
2. Lisää Cloudflare Pages env: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VITE_GOOGLE_CLIENT_ID`
3. Luo Google Cloud Console OAuth 2.0 -client, redirect URI: `https://app.vaultfolio.fi/auth/callback`

---

### 2026-03-19 — Feature 31: Multi-device Vault

**Uudet tiedostot:**
- `packages/platform-web/src/vault/vaultKeyBlob.ts` — `encryptVaultKeyBlob` + `decryptVaultKeyBlob` (PBKDF2/AES-GCM, zero-knowledge)
- `packages/platform-web/src/vault/vaultKeyBlob.test.ts` — 6 unit-testiä
- `scripts/migrations/2026-03-19-add-vault-key-blob.sql` — DB-migraatio
- `apps/api/src/routes/vault-key.ts` — Fastify `GET/PUT /v1/vault/key`
- `functions/api/routes/vault-key.ts` — Hono `GET/PUT /v1/vault/key`
- `apps/web/tests-e2e/multi-device-vault.spec.ts` — 3 E2E-testiä

**Muutetut tiedostot:**
- `packages/platform-web/src/index.ts` — `vaultKeyBlob.js` export lisätty
- `functions/_lib/db.ts` — `HOSTED_SCHEMA_SQL`: `vault_key_blob` + `vault_key_salt` kolumnit
- `apps/api/src/db/db.ts` — `ensureColumn`: `vaultKeyBlob` + `vaultKeySalt`
- `apps/api/src/server.ts` — rekisteröi `vault-key` route
- `functions/api/[[path]].ts` — rekisteröi `vaultKey` Hono-route
- `apps/web/src/store/useAuthStore.ts` — `signInAndUnlockVault` + `uploadVaultKeyBlob` + `changePassword` re-enkryptaa blobin
- `apps/web/src/pages/SigninPage.tsx` — käyttää `signInAndUnlockVault`; fallback passphrase-lomake jos blob puuttuu
- `apps/web/src/pages/SignupWithVaultPage.tsx` — `uploadVaultKeyBlob` automaattisesti signup-vaiheen lopussa
- `apps/web/src/pages/AccountPage.tsx` — `RecoveryPassphraseSection` (Show/Hide)

**Testit:** 266 unit-testiä ✅ (173 core + 10 landing + 6 platform-web + 2 api + 75 web)

**Deploy-muistio:** Aja `DATABASE_URL="..." pnpm migrate:run` Neon-kantaan ennen julkaisua.

---

### 2026-03-18 — Feature 27: Domain + Landing Page + Markkinointi

**Uudet tiedostot:**
- `apps/landing/` — uusi itsenäinen Vite+React+Tailwind app (@kp/landing)
  - `src/pages/LandingPage.tsx` — pääsivu (Hero + DashboardMockup + ZK + Features + Pricing + Footer)
  - `src/pages/BlogArticleFi.tsx` — `/blog/krypto-verotus-suomi-2026` (FI SEO-artikkeli, structured data)
  - `src/components/HeroSection.tsx` — hero + nav, ZK-tagline, CTA
  - `src/components/ZkExplainerSection.tsx` — 3-askel ZK-selitys + koodiesimerkki
  - `src/components/DashboardMockup.tsx` — Framer Motion animoitu portfolio-preview (mock-data)
  - `src/components/FeatureCards.tsx` — 4 USP-korttia
  - `src/components/PricingSection.tsx` — Free/Pro taulukko + vertailutaulukko
  - `src/components/Footer.tsx` — CTA-banneri + linkit
  - `src/landing.test.tsx` — 10 unit-testiä (kaikki läpi)
  - `index.html` — meta-tagit, OG, Twitter Card, canonical, lang="fi"
  - `public/robots.txt` + `public/sitemap.xml` + `public/favicon.svg`
- `docs/launch/show-hn-post.md` — Show HN -postauksen draft (EN)
- `docs/launch/launch-checklist.md` — DNS + Cloudflare + OG-kuva + Show HN launch steps

**Muutetut tiedostot:**
- `package.json` (root) — `dev:landing` + `build:landing` scriptit
- `pnpm-workspace.yaml` — ei muutosta (apps/* kattaa landing automaattisesti)

**Testit:** 10 landing unit-testiä ✅, Build OK ✅ (344 kB gzip 108 kB)

---

### 2026-03-18 — Feature 26: Dashboard + UX Polish

**Uudet tiedostot:**
- `apps/web/src/store/useImportSuccessStore.ts` — uusi store import success -banneria varten
- `apps/web/src/hooks/useAlertBadgeCount.ts` — laskee katsomattomat triggeroituneet hälytykset
- `apps/web/src/pages/SignupWithVaultPage.tsx` — yhdistetty signup + vault + maa-valinta

**Muutetut tiedostot:**
- `apps/web/src/store/useSyncStore.ts` — lastSyncAtISO + lastSyncError + try/catch
- `apps/web/src/components/Sidebar.tsx` — poistettu btn-sync-now, passiivinen sync-status, alert badge
- `apps/web/src/hooks/useDashboardData.ts` — ledgerEventCount + recentPricePoints
- `apps/web/src/pages/DashboardPage.tsx` — import success/setup/partial data -bannerit, Get Started widget, 24h-sarake
- `apps/web/src/components/DashboardCharts.tsx` — 90D + period delta
- `apps/web/src/pages/PortfolioPage.tsx` — P&L% per positio, sort-valikko pnl-vaihtoehdolla
- `apps/web/src/pages/VaultSetupPage.tsx` — passkey-step poistettu (3 steppiä)
- `apps/web/src/app/App.tsx` — /auth/signup → SignupWithVaultPage
- `apps/web/src/pages/AlertsPage.tsx` — acknowledgeTriggered() mount-effectissä
- `packages/core/src/domain/alert.ts` — triggeredAtISO + acknowledgedAtISO optional-kentät

**Testit:** 250/250 ✅ (173 core + 2 api + 75 web), Build OK ✅

---

### 2026-03-18 — Feature 13 Vaihe 2: Binance + Kraken providerit

**Uudet tiedostot:**
- `packages/core/src/import/binanceStatement.ts` — Binance Statement CSV -mapper (parsinta + event mapping)
- `packages/core/src/import/binanceTrades.ts` — Binance API-vastauksen mapper (trades, deposits, withdrawals)
- `packages/core/src/import/binanceAssetMap.ts` — Binance symbol → CoinGecko ID (70+ symbolia)
- `packages/core/src/import/krakenLedger.ts` — Kraken Ledger-entry mapper (trade pairing refidillä, asset normalisointi)
- `packages/core/src/import/krakenAssetMap.ts` — Kraken asset-koodi normalisointi (XXBT→BTC, XETH→ETH jne.)
- `packages/core/src/import/index.ts` — re-export kaikki mapperit
- `apps/api/src/services/binanceHmac.ts` + `binanceClient.ts` + `binanceV1Fixture.ts` — Binance HMAC-proxy (local)
- `apps/api/src/services/krakenHmac.ts` + `krakenClient.ts` + `krakenV1Fixture.ts` — Kraken HMAC-proxy (local)
- `apps/api/src/routes/imports-binance.ts` + `imports-kraken.ts` — Fastify-routet
- `functions/_lib/binanceHmac.ts` + `krakenHmac.ts` — Web Crypto HMAC (Cloudflare Workers)
- `functions/api/routes/binance.ts` + `kraken.ts` — Hono-routet
- `apps/web/src/integrations/binance/` — vault, api, sync, import, plugin (5 tiedostoa)
- `apps/web/src/integrations/kraken/` — vault, api, sync, import, plugin (5 tiedostoa)
- `apps/web/src/components/imports/BinanceConnectForm.tsx` + `BinanceFetchPanel.tsx` + `BinanceCsvUploadForm.tsx`
- `apps/web/src/components/imports/KrakenConnectForm.tsx` + `KrakenFetchPanel.tsx`
- `apps/web/src/components/imports/CapabilityChoiceScreen.tsx` — API vs CSV -valintanäyttö (Binance)

**Muutetut tiedostot:**
- `apps/web/src/integrations/importPlugin.ts` — capability-based redesign (ApiCapability, CsvCapability)
- `apps/web/src/integrations/coinbase/coinbasePlugin.ts` — migraatio `api:` -capabilityyn
- `apps/web/src/integrations/providerRegistry.ts` — binancePlugin + krakenPlugin; coming-soon lista päivitetty
- `apps/web/src/components/imports/ProviderCard.tsx` — capability branching + CapabilityChoiceScreen + logot
- `apps/web/src/components/imports/ProviderGrid.tsx` — `plugin.api.*` käyttö
- `apps/api/src/server.ts` — rekisteröi Binance + Kraken routet
- `functions/api/[[path]].ts` — rekisteröi binance + kraken Hono-routet
- `packages/core/src/index.ts` — `./import/index.js` export (korvaa `./import/coinbaseV2.js`)
- `packages/core/src/portfolio/lotEngine.ts` — tyyppikorjaus (`acquiredAtISO?` matched-tyyppeihin)
- `apps/web/src/integrations/providerRegistry.test.ts` — päivitetty capability-mallille
- `apps/web/src/integrations/coinbase/coinbasePlugin.test.ts` — päivitetty `api!.*` kutsuihin

**Uudet testit:**
- `packages/core/src/import/binanceStatement.test.ts` — 12 testiä (CSV-parsinta, operaatioiden mappaus)
- `packages/core/src/import/binanceTrades.test.ts` — 12 testiä (symbol split, API trades/deposits/withdrawals)
- `packages/core/src/import/krakenLedger.test.ts` — 15 testiä (trade pairing, normalisointi, deduplicate)

**Testit:** 147 → 173 core-testiä, 250 yhteensä (kaikki läpi) ✅, Build OK ✅

---

### 2026-03-17 — Feature 25 Vaihe 2: Wallet-level FIFO + Transfer Detection

**Uudet tiedostot:**
- `packages/core/src/tax/transferDetection.ts` — `detectSelfTransfers()`: greedy matching, dust-toleranssi (0.5%), aikaikkuna (2h), eri account -tarkistus, high/medium confidence
- `packages/core/src/tax/transferDetection.test.ts` — 7 unit-testiä (kaikki läpi)

**Muutetut tiedostot:**
- `packages/core/src/portfolio/lotEngine.ts` — `LotEngineOptions` (walletLevelFifo + selfTransferMatches), wallet-key logiikka, self-transfer cost basis -siirto incoming-lotille
- `packages/core/src/tax/taxEngine.ts` — `enableTransferDetection` option, yhdistää transfer detection + wallet-level FIFO Finland-profiilille
- `packages/core/src/index.ts` — `transferDetection` export
- `packages/core/src/__tests__/lotEngine.test.ts` — 3 uutta testiä (walletLevelFifo, _global fallback, self-transfer cost basis)
- `apps/web/src/pages/TaxPage.tsx` — `enableTransferDetection: isFinland` generate-kutsuun

**Testit:** 137 → 147 core-testiä (kaikki läpi), 205 yhteensä ✅

### 2026-03-17 — Feature 25 Vaihe 1: Finnish Tax Parity

**Uudet tiedostot:**
- `packages/core/src/tax/hmoCalculator.ts` — HMO-laskuri (applyHmo), 20%/40%, omistusaika-laskenta lotsMatched.acquiredAtISO:sta
- `packages/core/src/__tests__/hmoCalculator.test.ts` — 7 unit-testiä (kaikki läpi)
- `apps/web/src/components/ui/BlurOverlay.tsx` — blur-efekti free-käyttäjille (CSS filter, ei DOM-piilotus)
- `apps/web/src/components/tax/OmaVeroGuide.tsx` — OmaVero-täyttöopas Pro-käyttäjille + copy-painikkeet

**Muutetut tiedostot:**
- `packages/core/src/domain/portfolio.ts` — DisposalLotMatch: `acquiredAtISO?: IsoString` lisätty
- `packages/core/src/portfolio/lotEngine.ts` — takeFromLot välittää `acquiredAtISO`, lotsMatched-mapissa
- `packages/core/src/domain/tax.ts` — HmoAdjustment + HmoResult skeema, TaxYearReport: hmoEnabled/hmoTotalSavingBase/hmoAdjustments
- `packages/core/src/tax/taxEngine.ts` — `hmoEnabled` optio GenerateTaxReportOptions, kutsuu applyHmo()
- `packages/core/src/billing/planTypes.ts` — GatedFeature: `hmo-calculator` + `omavero-guide` (Pro-only)
- `apps/web/src/components/ui/index.ts` — BlurOverlay export
- `apps/web/src/pages/TaxPage.tsx` — HMO-toggle (Finland-profiili), BlurOverlay KPI+disposals, OmaVero-osio, HMO-säästöbanneri
- `apps/web/src/pages/TransactionsPage.tsx` — issue filter napit (All/Issues/Missing value/Unmatched transfer)

**Testit:** 130 → 137 testiä (kaikki läpi)

### 2026-03-17 — Feature 24: Settings siivous + Tax Profile

**Uudet tiedostot:**
- `apps/web/src/components/settings/TaxProfileCard.tsx` — korvaa PortfolioSettingsCard; taxCountry, lotMethod (FI: locked FIFO), hmoEnabled toggle (vain FI)
- `apps/web/src/components/settings/IntegrationsCard.tsx` — auto-refresh + sync + linkki ImportsPage:lle
- `apps/web/src/components/settings/DangerZoneCard.tsx` — export JSON + delete account placeholder
- `apps/web/src/components/settings/TaxProfileCard.test.tsx` — 5 unit-testiä
- `apps/web/src/components/settings/DangerZoneCard.test.tsx` — 4 unit-testiä
- `apps/web/tests-e2e/settings-tax-profile.spec.ts` — 4 E2E-testiä

**Muutettu:**
- `packages/core/src/domain/settings.ts` — TaxCountry enum + taxCountry/hmoEnabled optional kentät
- `packages/core/src/domain/settings.test.ts` — 6 testiä (taxCountry/hmoEnabled + backward compat)
- `apps/web/src/pages/SettingsPage.tsx` — 5-osion rakenne (Account/Tax Profile/Notifications/Integrations/Danger Zone)
- `apps/web/src/pages/VaultSetupPage.tsx` — country step lisätty (step 0), 4 askelta yhteensä
- `apps/web/tests-e2e/helpers.ts` — signupAndSetupVault + setupVaultOffline: skip country step

**Testitulos:** Unit 188/188 ✅ (117 core + 2 api + 69 web)

---

### 2026-03-16 — Feature 14: Billing + Feature Gating

**Uudet tiedostot:**
- `packages/core/src/billing/planTypes.ts` — Plan, PlanInfo, GatedFeature, isFeatureAllowed (pure fn)
- `packages/core/src/billing/index.ts` — re-export
- `packages/core/src/billing/planTypes.test.ts` — 9 unit-testiä
- `functions/api/routes/billing.ts` — GET /v1/billing/plan + POST /v1/billing/activate (Hono)
- `apps/api/src/routes/billing.ts` — samat endpointit (Fastify)
- `scripts/migrations/2026-03-16-add-user-plan.sql` — Neon migraatio
- `apps/web/src/hooks/useFeatureGate.ts` — useFeatureGate hook
- `apps/web/src/components/billing/UpgradeModal.tsx` — UpgradeModal + UpgradeTeaser
- `apps/web/src/components/billing/GateWall.tsx` — GateWall komponentti
- `apps/web/src/components/billing/billing.test.tsx` — 8 unit-testiä

**Muutettu:**
- `packages/core/src/index.ts` — lisätty `./billing/index.js` export
- `packages/core/src/api/authJwt.ts` — plan claim JWT:hen (signToken + AuthPayload)
- `functions/_lib/db.ts` — HOSTED_SCHEMA_SQL: plan + plan_expires_at kolumnit
- `functions/api/routes/auth.ts` — login/register palauttaa plan, JWT sisältää plan
- `functions/api/[[path]].ts` — rekisteröi billing route
- `apps/api/src/db/db.ts` — ensureColumn: plan + planExpiresAt users-tauluun
- `apps/api/src/routes/auth.ts` — login/register palauttaa plan
- `apps/api/src/services/authHooks.ts` — signToken hyväksyy plan-parametrin
- `apps/api/src/server.ts` — rekisteröi billing route
- `packages/platform-web/src/db/webDb.ts` — planCache Dexie v4
- `apps/web/src/store/useAuthStore.ts` — plan + planExpiresAt + fetchPlan()
- `apps/web/src/pages/TaxPage.tsx` — GateWall + UpgradeModal export-napeille
- `apps/web/src/pages/AccountPage.tsx` — BillingSection

**Testitulos:** Unit 172/172 ✅ (112 core + 2 api + 60 web), Build OK

---

### 2026-03-16 — Feature 13: Imports Plugin Registry (Vaihe 1)

**Uudet tiedostot:**
- `packages/core/src/imports/providerTypes.ts` — ProviderDescriptor, AuthMethod, ProviderStatus tyypit
- `packages/core/src/imports/index.ts` — re-export
- `apps/web/src/integrations/importPlugin.ts` — ImportPlugin interface, ImportContext, ConnectFormProps, FetchPanelProps
- `apps/web/src/integrations/providerRegistry.ts` — PROVIDER_REGISTRY + COMING_SOON_PROVIDERS
- `apps/web/src/integrations/coinbase/coinbasePlugin.ts` — Coinbase plugin (wrappaa vault/sync/import)
- `apps/web/src/components/imports/CoinbaseConnectForm.tsx` — extracted connect form (~110r)
- `apps/web/src/components/imports/CoinbaseFetchPanel.tsx` — extracted fetch/preview/issues/done (~300r)
- `apps/web/src/components/imports/ProviderCard.tsx` — provider card UI + coming-soon card (~130r)
- `apps/web/src/components/imports/ProviderGrid.tsx` — grid + inline FetchPanel (~60r)
- `apps/web/src/components/imports/ImportWizard.tsx` — Sheet-kuori (reserved for Phase 2)
- `apps/web/src/integrations/providerRegistry.test.ts` — 4 unit-testiä
- `apps/web/src/integrations/coinbase/coinbasePlugin.test.ts` — 4 unit-testiä
- `apps/web/tests-e2e/imports-provider-grid.spec.ts` — E2E: grid + coming-soon cards

**Muutettu:**
- `packages/core/src/index.ts` — lisätty `./imports/index.js` export
- `apps/web/src/pages/ImportsPage.tsx` — refaktoroitu 1007r → 25r (käyttää ProviderGrid)

**Testitulos:** Unit 52/52 ✅, Build OK

---

### 2026-03-16 — Feature 23: Premium UI — shadcn/ui + Framer Motion + release

**Commitit:**
- `feat(web): premium UI overhaul — shadcn/ui + Framer Motion (Feature 23)` — kaikki sivut
- `feat(web): auth pages + PortfolioPage — Framer Motion + shadcn Select fix`
- `fix(ci): passphrase duplicate-word bug + Prettier formatting`
- `fix(e2e): remove Framer Motion opacity-0 initial state from auth pages`
- `fix(web): remove AppShell page transition animation to fix E2E tests`
- `fix(web): show currency unit in KpiCard AnimatedNumber to fix E2E test`

**Toteutettu:**
- shadcn/ui asennettu (Card, Button, Input, Select, Dialog, Sheet, Table, Tabs, Badge, Tooltip jne.)
- Geist-fontti + JetBrains Mono + Framer Motion animaatiot
- Obsidian dark theme (shadcn CSS variables)
- KpiCard animated number counter (useSpring/useTransform)
- Dashboard: stagger entrance, hover effects, AllocationBars, ValueChart
- Transactions, Tax, Alerts, Import, Settings — kaikki sivut päivitetty
- Auth: WelcomePage (orb + stagger), VaultSetupPage (step indicator), UnlockPage (error shake)

**Bugifixit:**
- passphraseGenerator: deduplicate-logiikan while-loop (oli `idx+1` yksi retry)
- AppShell: poistettu `AnimatePresence mode="wait"` + `motion.main y:8` — Playwright E2E stability
- KpiCard: lisätty `unit` prop — currency näkyy AnimatedNumber-kentässä

**Release:**
- CI: 17/17 E2E-testiä ✅, kaikki 5 CI-jobbia vihreä
- Tuotanto: `https://kryptoportfolio.pages.dev/api/health` → `{"ok":true}`
- Deployttu: `main` → Cloudflare Pages automaattisesti

---

### 2026-03-16 — Feature 22: Pencil Design Mockup Implementation (all pages)
**Pencil-suunnitelmien toteutus kaikille sivuille:**
- `UnlockPage.tsx` — keskitetty kortti + Logo, passphrase-lomake, "Remember me" checkbox, passkey linkkinä
- `VaultSetupPage.tsx` — Logo + step indicator, kaikki tekstit i18n-avaimilla, Obsidian-tyylittely
- `TransactionsPage.tsx` — taulukkomuoto (Date/Type/Asset/Amount/Price/Total), type-badget, haku + suodatus, collapsible lomake
- `TaxPage.tsx` — 3 KPI-korttia (KpiCard), disposals-taulukko token-ikoneilla, year/method/profile valitsimet headerissa
- `AlertsPage.tsx` — hälytyskortteja toggle-kytkimillä, TokenIcon, collapsible luontilomake, server-paneeli
- `SettingsPage.tsx` — ryhmitetyt osiot (Vault & Security, Preferences, Danger Zone), section-otsikot
- `ImportsPage.tsx` — step indicator (1-2-3), exchange-kortti checkmark-tilalla, CSV upload -alue, design token -värit

**Poistettu hardcoded-värit:** `bg-red-50`, `bg-green-50`, `bg-amber-50`, `text-red-800`, `text-green-800` → design token -luokat (`semantic-error/success`, `brand`, `surface-*`)

**E2E-korjaus:** `alerts-server.spec.ts` — lisätty `btn-refresh-server-status`, korjattu server delivery -viesti

**Testitulos:** Build OK, Unit 155/155 ✅, E2E 16/16 ✅ (1 skipped pre-existing)

---

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
- PWA manifest updates (PrivateLedger, theme_color)

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
