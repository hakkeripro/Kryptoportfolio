# Features TODO - Master List

**Paivitetty:** 2026-03-14
**Tarkoitus:** Kaikkien ominaisuuksien seuranta. Feature ID on pysyva tunniste.
**Bugit:** [ISSUE_LOG.md](../ISSUE_LOG.md)
**Backlog:** [BACKLOG.md](../BACKLOG.md)
**ADR:t:** [adr/](../adr/)

---

## ⚡ VAIHE 0: Tekninen velka + siivous (ENNEN uusia featureita)

**Miksi ensin:** Nykyinen koodipohja on hauras ydinpoluilla (sync, alerts, state). Uusien ominaisuuksien rakentaminen hauraalle pohjalle moninkertaistaa tyomäärän myohemmin. Testikattavuus on liian matala AI-kehitykseen — AI tuottaa hauraata koodia ilman testeja.

### T-001: CI pipeline kuntoon ✅
**Prioriteetti:** Kriittinen (kaikki muu nojaa tahan)
**Tyomaara:** 1-2h

- [x] TypeScript type check (`tsc --noEmit`) CI:hin
- [x] ESLint + Prettier setup + CI step
- [x] Vitest coverage-raportti (threshold aluksi 30%)
- [x] `pnpm audit` dependency security check
- [x] Bundle size tracking (size-limit, 500 kB gzip raja)
- [x] `.github/workflows/ci.yml` paivitys

**Valmis kun:** PR ei mene läpi ilman type check + lint + test + audit.

---

### T-002: Hosted API monolith hajotus ✅
**Prioriteetti:** Kriittinen
**Tyomaara:** 2-3h
**Kohde:** `functions/api/[[path]].ts` (1082 rivia → moduuleihin)

- [x] `functions/api/` → erilliset route-tiedostot (auth, sync, alerts, coinbase, coingecko, push, runner)
- [x] `functions/_lib/` → yhteiset palvelut sailyvat + uudet: `pushSender.ts`, `alertEval.ts`
- [x] Poista runtime ALTER TABLE -migraatiot → siirrä `scripts/migrations/`
- [x] Poista in-memory Map cache ilman evictiota → bounded cache (MAX_CACHE_SIZE=200)
- [x] Testaa: `pnpm test:e2e` — 5/6 lapaistava (1 pre-existing bugi)

**Valmis kun:** Yksikaan route-tiedosto ei ole yli 200 rivia. Ei runtime-skeemamuutoksia.

---

### T-003: useAppStore hajotus ✅
**Prioriteetti:** Kriittinen
**Tyomaara:** 2-3h
**Kohde:** `apps/web/src/store/useAppStore.ts` (278 rivia, 5 konseptia)

- [x] `useAuthStore.ts` — login, register, token, email (78 rivia)
- [x] `useVaultStore.ts` — passphrase, vaultReady, vaultSetup, lock/unlock (93 rivia)
- [x] `useSyncStore.ts` — syncNow, lastSyncCursor, deviceId (97 rivia)
- [x] Korjaa: `apiFetch()` JSON.parse try-catch → `apiFetch.ts` (16 rivia)
- [x] Korjaa: `syncNow()` virheenkasittely (ei enaa hiljaisesti epäonnistuva)
- [x] Middleware/koordinointi storeiden valilla: `getState()` cross-store reads
- [x] Testaa: `pnpm test:e2e` lapaistava (5/6, 1 pre-existing bugi)

**Valmis kun:** Yksikaan store-tiedosto ei ole yli 100 rivia. Virheet nakyy kayttajalle.

---

### T-004: API-logiikan duplikaation poisto ✅
**Prioriteetti:** Korkea
**Tyomaara:** 3-4h
**Ongelma:** Auth, sync ja alerts logiikka on kirjoitettu kahdesti (Fastify + Hono) eri tyylilla.

- [x] Tunnista jaettu bisneslogiikka: auth (hash/verify, JWT), sync (envelope CRUD), alerts (eval)
- [x] Siirrä yhteinen logiikka `packages/core/src/api/` tai uuteen `packages/api-shared/`
- [x] Fastify-routet kutsuvat yhteistä logiikkaa
- [x] Hono-routet kutsuvat yhteistä logiikkaa
- [x] Yhtenaiset virheviestit ja -koodit
- [x] Testaa: `pnpm test` + `pnpm test:e2e`

**Valmis kun:** Bisneslogiikkaa on YKSI versio. Route-handlerit ovat ohuita adaptereita.

---

### T-005: Testikattavuus ydinpoluille ✅
**Prioriteetti:** Korkea
**Tyomaara:** 3-4h

- [x] Lot engine: edge case -testit (tyhjä portfolio, negatiiviset maarat, LIFO, HIFO, AVG_COST, TRANSFER, REWARD)
- [x] Tax engine: skenaariot (pelkat ostot, rewards+disposals, swap chains, multi-year, ZERO/FMV)
- [x] Alert eval: kaikki 6 tyyppia, cooldown, snooze, disabled, puuttuvat kentat
- [x] Ledger: normalisointi, replacement, tombstone, feeInvariants, feeValueBaseOrZero
- [ ] Sync: konfliktiresoluutio, osittainen kirjoitus, concurrent access (siirretty)
- [ ] Vault: setup, unlock, corrupted blob, wrong passphrase (siirretty)
- [x] E2E: virhepolut (vaara salasana, duplikaatti email, tuntematon email)

**Tila:** Core coverage 58.7% (> 50% tavoite). 91 unit-testia, 3 E2E-virhepolkua. Sync/Vault-testit siirretty.

---

### T-006: Web-komponenttien siivous ✅
**Prioriteetti:** Keskitaso
**Tyomaara:** 2-3h

- [x] `SettingsPage.tsx` (574r) → hajota alacomponentteihin (PortfolioSettingsCard, SecurityCard, NotificationsCard, SyncCard, AdvancedCard)
- [x] `PortfolioPage.tsx` (366r) → ekstrahtoi TokenDetailDrawer omaksi komponentiksi
- [x] `DashboardPage.tsx` (349r) → ekstrahtoi `useDashboardData` hook
- [x] DB-kyselyt pois page-komponenteista → custom hookit (`usePortfolioData`, `useDashboardData`)
- [x] Poista `as any` -castit (SettingsPage, PortfolioPage, DashboardPage — korvattu oikeilla tyypeilla)
- [x] App.tsx: lisaa React.lazy() code splitting sivuille

**Toteutus (2026-03-14):**
- SettingsPage: 574r → 61r (logiikka 5 alikomponeenttiin `components/settings/`)
- PortfolioPage: 366r → 150r (TokenDetailDrawer → `components/TokenDetailDrawer.tsx`)
- DashboardPage: 349r → 322r (DB-kysely → `hooks/useDashboardData.ts`; dashboard-refresh-logiikka sailytetty)
- `as any` poistettu SettingsPage/PortfolioPage/DashboardPage kriittisilta poluilta (Settings-tyypin kentat, position-tyypit, lot-tyypit)
- React.lazy() + Suspense kaikille 12 sivulle — Vite code splitting tuottaa erilliset chunkit

---

### T-007: Dexie-indeksit + DB-optimoinnit ✅
**Prioriteetti:** Keskitaso
**Tyomaara:** 1h

- [x] `pricePoints`: compound index `[assetId+timestampISO]`
- [x] `portfolioSnapshots`: compound index tarvittaessa → ei tarvita, `&dayISO` PK riittaa
- [x] Tarkista kaikki kyselyt — indeksit vastaavat kayttoa
- [x] Dexie versio-bump + migraatio (v2 → v3)

**Valmis kun:** Ei full-table-scaneja yleisimmissa kyselyissa.

**Toteutus (2026-03-14):**
- Dexie v3: compound index `[assetId+timestampISO]` pricePoints-tauluun
- PortfolioPage: ledgerEvents.filter() → where('assetId') + where('type').equals('SWAP') (indeksoitu haku)
- portfolioSnapshots: kaikki kyselyt kayttavat dayISO PK:ta, ei tarvetta compound-indeksille

---

### T-008: Repo-siivous (turha roska pois) ✅
**Prioriteetti:** Keskitaso
**Tyomaara:** 30min

Nama tiedostot ovat vanhentuneita / korvattu uusilla:

- [x] Poista `docs/NEXT_AI_PROMPT.md` → korvattu `CLAUDE.md`:llä
- [x] Poista `docs/AI_HANDOFF.md` → korvattu `CLAUDE.md`:lla + `FEATURES_TODO.md`:lla
- [x] Poista `docs/next-steps.md` → korvattu `FEATURES_TODO.md`:llä + `BACKLOG.md`:lla
- [x] Paivita `docs/README.md` → viittaa uuteen rakenteeseen (CLAUDE.md, FEATURES_TODO, SESSION_CONTEXT)
- [x] Siirrä `docs/known-limitations.md` sisalto relevantteihin feature-spekseihin, sitten poista
- [x] Tarkista `apps/web/src/` kuolleet/tupla-komponentit (KP-MAINT-001), poista
- [x] Paivita `docs/PROJECT_STATE.md` viittaamaan uuteen rakenteeseen

**Valmis kun:** Ei paallekkaisia/vanhentuneita dokumentteja. Yksi selkea polku: CLAUDE.md → FEATURES_TODO → feature-speksit.

---

### Vaiheen 0 yhteenveto

| # | Tehtava | Prioriteetti | Tyomaara | Riippuvuudet |
|---|---------|-------------|----------|-------------|
| T-001 | CI pipeline ✅ | Kriittinen | 1-2h | — |
| T-002 | Hosted API hajotus ✅ | Kriittinen | 2-3h | — |
| T-003 | useAppStore hajotus ✅ | Kriittinen | 2-3h | — |
| T-004 | API-duplikaation poisto ✅ | Korkea | 3-4h | T-002 |
| T-005 | Testikattavuus ✅ | Korkea | 3-4h | T-001 |
| T-006 | Web-komponenttien siivous ✅ | Keskitaso | 2-3h | T-003 |
| T-007 | Dexie-indeksit ✅ | Keskitaso | 1h | — |
| T-008 | Repo-siivous ✅ | Keskitaso | 30min | — |

**Suositeltu jarjestys:** T-001 → T-008 → T-002 → T-003 → T-004 → T-005 → T-007 → T-006

---
---

## TOTEUTETUT

### Feature 01: Core Domain + Monorepo ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-001
**Paketti:** `packages/core`

- [x] pnpm monorepo (apps/*, packages/*)
- [x] Zod-skeemat: Asset, Account, LedgerEvent, Price, Portfolio, Tax, Alert, Settings
- [x] UUID + Decimal.js + date-fns -apukirjastot
- [x] TypeScript strict mode, ES2022
- [x] Build pipeline (core → platform-web → apps)

---

### Feature 02: Append-Only Ledger ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-002
**Paketti:** `packages/core`

- [x] LedgerEvent-skeemat (BUY, SELL, SWAP, TRANSFER, REWARD, STAKING_REWARD, AIRDROP, LP/LEND/BORROW)
- [x] Replacement-malli (`replacesEventId`)
- [x] Tombstone-poistot
- [x] Swap-normalisointi (ADR-004)
- [x] Deterministiset kulut (ADR-005)

---

### Feature 03: Coinbase Import ✅
**Status:** ✅ TOTEUTETTU (bugi KP-IMPORT-001)
**ADR:** ADR-012
**Paketti:** `packages/core` + `apps/web`
**Speksi:** [docs/integrations/coinbase.md](../integrations/coinbase.md)

- [x] Coinbase CDP Secret API Key (ES256) -autentikointi
- [x] Import stepper: connect → fetch → preview → resolve issues → commit
- [x] Issue resolution UI (FX / fee value / swap valuation / reward FMV)
- [x] Autosync UI (status, cursor, "Run now")
- [x] Deduplikointi (externalRef)

**Avoimet bugit:** ~~KP-IMPORT-001~~ ✅ korjattu

---

### Feature 04: Portfolio + Lot Engine ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-003, ADR-008
**Paketti:** `packages/core`

- [x] Lot engine: FIFO (default), LIFO, HIFO, AVG_COST
- [x] Veroprofiilit (lot method per tax year)
- [x] Portfolio snapshots: streaming rebuild
- [x] Incremental replace (earliest changed day)
- [x] Dashboard + Portfolio -sivut

---

### Feature 05: Tax Engine ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-013
**Paketti:** `packages/core` + `apps/web`

- [x] Realized disposals per tax year
- [x] Income events (rewards, staking, airdrops)
- [x] Year-end holdings summary
- [x] Tax report -sivu

**Avoimet bugit:** KP-TAX-001 (maakohtaisuus + FI hankintameno-olettama puuttuu)

---

### Feature 06: Vault + Encryption ✅
**Status:** ✅ TOTEUTETTU (bugeja)
**ADR:** ADR-011
**Paketti:** `packages/platform-web`

- [x] WebCrypto vault (zero-knowledge)
- [x] Vault setup + lock/unlock
- [x] Dexie IndexedDB -skeema
- [x] Onboarding flow

**Avoimet bugit:** ~~KP-UI-001~~ ✅ korjattu

---

### Feature 07: Login + E2E Sync ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-011
**Paketti:** `packages/platform-web` + `apps/api`

- [x] Register / Login (email + password)
- [x] Device registration
- [x] E2E encrypted sync envelopes (upload + pull)
- [x] Serveri tallentaa vain ciphertext-kirjekuoria

---

### Feature 08: Web PWA (UI) ✅
**Status:** ✅ TOTEUTETTU
**Paketti:** `apps/web`

- [x] React + Vite PWA (Workbox service worker)
- [x] Tailwind + Zustand + React Router
- [x] Dashboard (portfolio overview)
- [x] Portfolio (holdings)
- [x] Transactions (virtualized list + detail drawer + tombstone delete)
- [x] Settings-sivu
- [x] Accounts-sivu

---

### Feature 09: Asset Catalog + CoinGecko Mapping ✅
**Status:** ✅ TOTEUTETTU
**ADR:** ADR-006, ADR-007
**Paketti:** `packages/core` + `apps/web`

- [x] Asset catalog (`assetCatalog.ts`)
- [x] CoinGecko ID search + manuaalinen linkitys
- [x] "Unmapped assets" -jono
- [x] Price provider cache (ADR-007)

**Avoimet bugit:** KP-UI-002 (auto-refresh settings key), KP-DATA-001 (liikaa manuaalityota)

---

### Feature 10: Alerts + Web Push ✅
**Status:** ✅ TOTEUTETTU (bugeja)
**ADR:** ADR-010, ADR-017
**Paketti:** `packages/core` + `apps/web` + `apps/api` + `apps/runner`

- [x] Alert CRUD UI
- [x] Server alert eval (`serverAlertEval.ts`)
- [x] Mirror state push + trigger log
- [x] Web push subscribe/unsubscribe
- [x] Cloudflare Worker runner (cron 15 min)
- [x] VAPID-avaimet + push-lahetys

**Avoimet bugit:** ~~KP-ALERT-001~~ ✅ korjattu, KP-ALERT-002 (push ei toimi tuotannossa)

---

### Feature 11: Hosted MVP (Cloudflare + Neon) ✅
**Status:** ✅ TOTEUTETTU
**Paketti:** `functions/` + `apps/runner`
**Runbook:** [hosted/PHASE5](../hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md), [hosted/PHASE6](../hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md)

- [x] Cloudflare Pages Functions (Hono)
- [x] Neon Postgres (serverless)
- [x] Skeema: `functions/_lib/db.ts` (`HOSTED_SCHEMA_SQL`)
- [x] Migraatiot: `scripts/migrations/`
- [x] Auth, sync, alerts, coingecko, imports, push -endpointit
- [x] CI: GitHub Actions (unit + build + e2e)

---
---

## VAIHE 1: P0-bugien korjaus

Korjataan FEATURES_TODO Vaiheen 0 jalkeen (tai rinnakkain T-tehtavien kanssa jos bugi estaa kehitysta).
Ks. [ISSUE_LOG.md](../ISSUE_LOG.md) tarkemmat kuvaukset.

- [x] **KP-UI-001:** Vault passphrase session bug ✅ (korjattu T-003 store-hajotuksessa, e2e-testi lisätty)
- [x] **KP-UI-002:** Price auto-refresh settings key (`settings` vs `settings_1`) ✅
- [x] **KP-ALERT-001:** Server alerts enable/replace semantics ✅
- [x] **KP-IMPORT-001:** Coinbase JSON key flow ✅

---
---

## SUUNNITTEILLA (ADR olemassa)

### Feature 12: Auth/Vault UX Redesign 🚧
**Status:** 🚧 TOTEUTUKSESSA (core + UI valmis, E2E-testit kesken)
**ADR:** ADR-018
**Speksi:** [12_auth-vault-ux.md](12_auth-vault-ux.md)
**TODO:** [12_auth-vault-ux_TODO.md](12_auth-vault-ux_TODO.md)
**Edellyttaa:** Vaihe 0 (T-003 ✅) + P0-bugi KP-UI-001 ✅

**Tavoite:** Passkey/WebAuthn + yksi Vault Passphrase per kayttaja (multi-device)

- [x] Route-uudistus: Welcome, Signup, Signin, Vault Setup Wizard, Vault Unlock
- [x] Vault Setup Wizard (passphrase + passkey step + done)
- [x] Vault Unlock redesign (passkey primary, passphrase fallback)
- [x] Account-sivu: passkeys, change password, change vault passphrase
- [x] Offline-only -polku (kaytto ilman tilia)
- [x] PUT /v1/auth/password -endpoint (Fastify + Hono)
- [x] Backward compat: /onboarding → /welcome, /unlock → /vault/unlock
- [x] E2E-testit paivitetty uuteen flowiin
- [ ] Erilliset E2E-testit (auth-signup-flow, auth-signin-flow, auth-offline-flow, account-change-password)
- [ ] Multi-device e2e -testaus (manuaalinen)

**Ratkaisee:** KP-UX-001

---

### Feature 13: Imports Plugin Registry 📋
**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-019
**Playbook:** [EXCHANGE_INTEGRATION_PLAYBOOK.md](../EXCHANGE_INTEGRATION_PLAYBOOK.md)
**Edellyttaa:** Vaihe 0 (T-002 API-hajotus, T-004 duplikaation poisto)

**Tavoite:** Provider grid + wizard -malli, skaalautuu uusille integraatioille

- [ ] Provider registry arkkitehtuuri
- [ ] Provider grid UI (ikonit + statusbadge)
- [ ] Connect wizard (API ensisijainen, CSV toissijainen)
- [ ] Coinbase: migrointi registryyn
- [ ] Binance-provider
- [ ] MEXC-provider
- [ ] Bitvavo-provider
- [ ] Ledger-provider (CSV)
- [ ] MetaMask-provider (CSV/API)

**Ratkaisee:** KP-UI-003, KP-IMPORT-001

---

### Feature 14: Billing + Feature Gating 📋
**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-020

**Tavoite:** Premium-ominaisuudet + Stripe-integraatio

- [ ] Plan-malli: Free / Premium
- [ ] Feature gating (UI + backend)
- [ ] Stripe-integraatio (tai stub)
- [ ] "Upgrade" UI
- [ ] Maksulliset: server alerts (rajoitettu free), strategy advanced, multi-exchange autosync, export/reporting

---
---

## SEURAAVA VAIHE: UI/UX Remontti

### Feature 22: UI/UX Redesign + Design System ✅
**Status:** ✅ VALMIS (2026-03-15)
**Prioriteetti:** Kriittinen — tehdaan ENNEN Feature 13 (Imports) ja Feature 14 (Billing)
**Edellyttaa:** Feature 12 valmis, PRODUCT_VISION.md

**Tavoite:** Tuote naytetaan ja tuntuu luotettavalta, ammattimaiselta ja helppokayttoiselta.

**Toteutettu:**
- [x] Design system: CSS-tokenit, Tailwind config, 14 UI-komponenttia (Button, Card, Input, Select, Badge, Spinner, Modal, Drawer, Tabs, Tooltip, EmptyState, TokenIcon, KpiCard, Logo)
- [x] Token-ikonit (CoinGecko iconUrl + letter avatar fallback)
- [x] Navigaatio: Sidebar (desktop) + BottomTabBar (mobiili), 5 päänäkymää, backward-compat redirectit
- [x] Welcome-sivu: VaultFolio branding, USP-kortit, CTA-painikkeet
- [x] Dashboard redesign: KPI-kortit, allokaatiodonitsi, arvokaavio, top positions
- [x] Kaikki sivut migrated design system -tokeneihin
- [x] Mobile-first: 44px touch targets, swipe-to-close drawer, safe area, standalone PWA
- [x] Branding: Logo (SVG), favicon, PWA manifest, "Obsidian" dark theme
- [x] i18n: react-i18next, EN+FI (~320 käännösavainta), kielivalitsin

**Testit:**
- Unit: 50 testiä (44 UI-komponenttia + 6 i18n locale-validointia)
- E2E: 7 testiä (welcome page, navigation, redirectit, language switch, mobile viewport)

**Huom:** i18n-avaimet on kytketty pääsivuille. Muutamilla sekundäärisivuilla (Imports, Alerts, Assets, Account, Transactions) on vain otsikot käännetty — yksityiskohtaiset käännökset voidaan lisätä jatkokehityksessä.

---
---

## EI TOTEUTETTU (backlogissa)

### Feature 15: Dashboard Alert Popup ❌
**Kuvaus:** Jokaiselle positiolle "⏰" ikoni → "Create alert" modal (price/allocation/P&L)

---

### Feature 16: Pricing/FX Caching ❌
**ADR:** ADR-007 (laajennus)
**Kuvaus:** Smarter cache + backoff, parempi UX puuttuville valuaatioille. "Last price update" UI.

---

### Feature 17: Strategy MVP ❌
**ADR:** ADR-009
**Kuvaus:** Target allocation, drift alert, rebalance suggestions (paper). Ei automaattisia tradeja.

---

### ~~Feature 18: Branding + Token Icons~~ → yhdistetty Feature 22:een
**Kuvaus:** Sisaltyy nyt Feature 22: UI/UX Redesign -kokonaisuuteen.

---

### Feature 19: Native Parity (Expo) ❌
**ADR:** ADR-014
**Kuvaus:** Mobiilisovellus (React Native / Expo) samoilla core-paketeilla. Push + alerts + imports parity.

---

### Feature 20: AI Insights + Trading Bot ❌
**ADR:** ADR-015
**Kuvaus:** "AI insights" (ei toimeksiantoja aluksi). "Auto-trading" vain erillisella opt-inilla + riskivaroitukset + audit log.

---
---

## META

### Feature 21: AI-kehitysymparisto + workflow ✅
**Status:** ✅ TOTEUTETTU
**Toteutettu:** 2026-03-14
**Edellyttaa:** Vaihe 0 valmis (erityisesti T-001 CI, T-008 siivous)
**Speksi:** [docs/features/21_ai-workflow.md](21_ai-workflow.md)

**Tavoite:** Sovitaan miten projektia kehitetaan tasta eteenpäin AI:lla. Dokumentoidaan skillit, MCP:t, toimintatavat ja laatuvaatimukset.

#### Skillit (Claude Code slash-komennot)
- [x] `/spec-feature <nro>` — Luo feature-speksi (vaatimukset, tekninen suunnitelma, testaussuunnitelma)
- [x] `/implement-feature <nro>` — Lataa valmis speksi, aloittaa toteutuksen
- [x] `/fix-bugs` — Lataa ISSUE_LOG, priorisoi ja korjaa jarjestyksessa
- [x] `/generate-feature-summary <speksi>` — Luo CHEAT_SHEET.md + TODO.md feature-speksista
- [x] `/update-session` — Paivittaa SESSION_CONTEXT.md, FEATURES_TODO.md ja bugilistat

#### MCP-integraatiot (arvioitu — ei tarvetta)
- [x] Supabase MCP → ei relevantti (Neon Postgres, ei Supabase)
- [x] Cloudflare MCP → ei tarvetta, `wrangler` CLI riittaa
- [x] GitHub MCP → ei tarvetta, `gh` CLI riittaa
- [x] CoinGecko API → ei tarvetta, testifixturet riittavat
- [x] Arvio: MCP:t lisaavat monimutkaisuutta ilman merkittavaa hyotya

#### CI/CD workflow
- [x] PR-pipeline: lint → typecheck → test (coverage 30%) → build → e2e → audit → bundle size
- [ ] Main merge: deploy staging → smoke test (toteutetaan deploy-featuren yhteydessa)
- [ ] Release tag: deploy production (toteutetaan deploy-featuren yhteydessa)
- [x] Coverage threshold: 30% (vitest config, CI failaa)

#### Laatuvaatimukset (CLAUDE.md:ssa)
- [x] "Jokainen feature vaatii testit ENNEN kuin merkitaan valmiiksi"
- [x] "Yksikaan tiedosto ei saa ylittaa 300 rivia ilman perustelua"
- [x] "Ei `as any` casteja kriittisilla poluilla"
- [x] "Feature-speksi ENNEN koodia" (ei improvisoitua arkkitehtuuria)

#### Kehityksen rytmi (dokumentoitu CLAUDE.md:ssa)
- [x] Yksi feature tai yksi bugikorjaus per AI-sessio
- [x] Session lopussa: `/update-session` + commit
- [x] Session-tyoskentely -osio CLAUDE.md:ssa (aloitus + lopetus -tarkistuslistat)

---
---

## Yhteenveto

| Kategoria | Maara |
|-----------|-------|
| Vaihe 0 (tekninen velka) | 8/8 ✅ |
| P0-bugit | 4/4 ✅ |
| Toteutetut featuret | 12 (01-11, 22) + 21 |
| Toteutuksessa | 1 (12) |
| Suunnitteilla | 2 (13, 14) |
| Backlog | 5 (15-17, 19-20) |
| Avoimet P1-bugit | 5 |
| Avoimet P2/P3-bugit | 4 |

### Toteutusjarjestys

```
VAIHE 0: Tekninen velka ✅ VALMIS
VAIHE 1: P0-bugit ✅ VALMIS
Feature 21: AI-kehitysymparisto ✅ VALMIS
Feature 12: Auth/Vault UX 🚧 (E2E-testit kesken)

→ PRODUCT_VISION.md (tuotteen suunta + kohderyhmä)
→ Feature 22: UI/UX Redesign + Design System
→ Feature 13: Imports Registry
→ Feature 14: Billing
→ Feature 15-20: backlogista prioriteettien mukaan
```
