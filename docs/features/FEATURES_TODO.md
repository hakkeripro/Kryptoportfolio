# Features TODO — Master List

**Päivitetty:** 2026-03-19
**Strategia:** Roadmap v2 — beta-valmius → tuote kuntoon → toiminimi → launch → kasvu
**Bugit:** [ISSUE_LOG.md](../ISSUE_LOG.md)

---

## TOTEUTETUT ✅

| Feature | Kuvaus |
|---------|--------|
| T-001..T-008 | Tekninen velka: CI, API-monolith, store-hajotus, duplikaation poisto, testikattavuus, komponenttisiivous, Dexie-indeksit, repo-siivous |
| Feature 01 | Core Domain + Monorepo |
| Feature 02 | Append-Only Ledger |
| Feature 03 | Coinbase Import (API + CSV) |
| Feature 04 | Portfolio + Lot Engine (FIFO/LIFO/HIFO/AVG) |
| Feature 05 | Tax Engine (realized disposals, income events) |
| Feature 06 | Vault + Encryption (WebCrypto zero-knowledge) |
| Feature 07 | Login + E2E Sync (register/login, encrypted envelopes) |
| Feature 08 | Web PWA (React + Vite, Tailwind, Zustand, React Router) |
| Feature 09 | Asset Catalog + CoinGecko Mapping |
| Feature 10 | Alerts + Web Push (CRUD, server eval, VAPID) |
| Feature 11 | Hosted MVP (Cloudflare Pages + Neon Postgres) |
| Feature 12 | Auth/Vault UX Redesign (Welcome, Signup, Signin, VaultSetup, Unlock) |
| Feature 13 | Imports Plugin Registry + Binance + Kraken (API + CSV) |
| Feature 14 | Billing + Feature Gating (infra, Free/Pro plan, GateWall — ei Stripea vielä) |
| Feature 21 | AI-kehitysympäristö + workflow (CLAUDE.md, skillit, konventiot) |
| Feature 22 | UI/UX Redesign + Design System (shadcn/ui, tokens, i18n EN+FI) |
| Feature 23 | Premium UI (Framer Motion, Geist, animated KPI) |
| Feature 24 | Settings + Tax Profile (maa, lot method, HMO) |
| Feature 25 | Finnish Tax Parity (HMO-laskuri, transfer detection, OmaVero guide) |
| Feature 26 | Dashboard + UX Polish (sync status, bannerit, P&L%, alert badge) |
| Feature 27 | Domain + Landing Page (private-ledger.app, SEO, blogi) |

---
---

## TOTEUTUSJONOSSA

> **Järjestys:** Vaihe 0 → Vaihe 1 → Vaihe 2 (toiminimi, hallinnollinen) → Vaihe 3 (launch) → Vaihe 4 (kasvu)

---

## VAIHE 0 — Beta-valmius

*Tavoite: tuote toimii luotettavasti, globaalisti saavutettavissa, riittävä pörssikattavuus*

---

### TASK: KP-TEST-001 korjaus ✅
**Työmäärä:** 15 min

- [x] `settings-tax-profile.spec.ts` — vaihda testi klikkaamaan Finland tai Other (Sweden on `comingSoon: true` → disabled nappi)

---

### TASK: Beta-banneri ✅
**Työmäärä:** 1h

- [x] AppShell: kiinteä infobanneri ylhäällä — "PrivateLedger is currently in beta. Features and data formats may change."
- [x] `apps/landing/`: sama banneri headerin alle
- [ ] Poistetaan Feature 42:ssa (launch)

---

### Feature 31: Multi-device Vault ⬜
**Prioriteetti:** Kriittinen — koko tuotteen suurin UX-ongelma
**Speksi:** Luo `docs/features/31_multi-device-vault.md`

**Ongelma:** Uudella laitteella vault passphrase pitää syöttää uudelleen. Suurin osa käyttäjistä ei muista sitä → dead end.

**Ratkaisu (zero-knowledge säilyy):**
- Vault passphrase salataan PBKDF2-avaimella (johdettu login-salasanasta + per-user salt)
- Salattu blob tallennetaan palvelimelle (`users.vault_key_blob`)
- Uudella laitteella: kirjaudu sisään → blob haetaan → dekryptaus login-salasanalla → vault auki automaattisesti
- Palvelin ei koskaan näe passphrasea selkotekstinä ✓

- [ ] DB-migraatio: `users.vault_key_blob TEXT`, `users.vault_key_salt TEXT`
- [ ] `PUT /v1/vault/key` — tallenna salattu blob (auth required) — Hono + Fastify
- [ ] `GET /v1/vault/key` — hae blob (auth required) — Hono + Fastify
- [ ] `packages/platform-web`: `encryptVaultKeyBlob(passphrase, loginPassword)` + `decryptVaultKeyBlob(blob, loginPassword)` WebCrytolla
- [ ] VaultSetupPage: tallenna blob palvelimelle automaattisesti setup-vaiheessa
- [ ] SigninPage: hae blob → dekryptaa → avaa vault → /home (ei passphrase-promptia)
- [ ] Fallback: jos blob puuttuu (vanhat käyttäjät) → passphrase-syöttö + blob luodaan ja tallennetaan kerralla
- [ ] Passphrase ei näy käyttäjälle normaalisti — vain Settings → Advanced → "Show recovery passphrase"
- [ ] Unit-testit: encryptVaultKeyBlob + decryptVaultKeyBlob + wrong password → throw
- [ ] E2E-testi: uusi laite kirjautuu → vault auki ilman passphrase-syöttöä

---

### Feature 32: Onboarding Simplification ⬜
**Prioriteetti:** Kriittinen — ensivaikutelma
**Edellyttää:** Feature 31

- [ ] SignupWithVaultPage: 2 steppiä max (email + salasana → maa) — vault ja blob generoituvat taustalla hiljaa
- [ ] Passphrase-käsitettä ei näytetä onboardingissa lainkaan
- [ ] VaultSetupPage jää vain "recovery" -polkuun (`/vault/setup?recovery=1`), ei normaali flow
- [ ] Dashboard: "Connect your first exchange" -hero isosti kun ei yhtään importtia (ei pieni banneri)
- [ ] E2E-testi: päivitetty uuteen flowhin

---

### Feature 33: Multi-currency (USD / EUR / GBP) ⬜
**Prioriteetti:** Kriittinen kansainväliselle käyttäjälle

- [ ] `settings.displayCurrency` kenttä Settings-skeemaan (USD, EUR, GBP, SEK — laajennettavissa)
- [ ] Valuuttavalitsin Settings:iin
- [ ] CoinGecko-pyynnöt: `vs_currency` parametri muuttuu valuutan mukaan
- [ ] Dashboard, Portfolio, Tax: kaikki rahasummat valitussa valuutassa
- [ ] Valuutan vaihto päivittää näkymät reaaliaikaisesti (Zustand reactive)
- [ ] Unit-testit: currency display + store

---

### Feature 34: International Mode ⬜
**Prioriteetti:** Korkea — avaa globaalin markkinan

- [ ] `taxCountry === 'FI'` → kaikki tax-ominaisuudet kuten aiemmin
- [ ] `taxCountry !== 'FI'` → Tax-sivu: "Finnish tax calculation included. Your country coming soon." — ei blur-gateä, ei Pro-myyntiä
- [ ] Pro-tilauksia myydään toistaiseksi vain FI-käyttäjille
- [ ] Landing page: "Available worldwide for portfolio tracking. Finnish tax reports included."
- [ ] Settings: maa-valinta selittää mitä ominaisuuksia maa saa

---

### Feature 29: Alert Delivery Diagnostics ⬜
**Prioriteetti:** P1 — ratkaisee KP-ALERT-002

- [ ] AlertsPage: diagnostiikkaosio — VAPID asetettu? Push subscription aktiivinen? Server rules count?
- [ ] "Send test notification" -nappi
- [ ] `POST /v1/push/test` endpoint (Hono + Fastify): lähettää testiviesti tilatulle subscriptiolle
- [ ] Selkeät virheilmoitukset puuttuvista edellytyksistä (ei VAPID, ei subscription, vaatii HTTPS)
- [ ] Jos tuotannossa ei saada toimimaan → feature piilotetaan beta-bannerilla
- [ ] Unit-testi: push/test endpoint
- [ ] E2E-testi: diagnostiikkaosio näkyy

---

### Feature 35: Exchange Coverage — Beta-kattaus ⬜
**Prioriteetti:** Kriittinen — ilman riittävää kattavuutta palvelu ei kiinnosta

Lisättävät mapperit `packages/core/src/import/` + UI + backend:

| Provider | Tyyppi | Huomio |
|----------|--------|--------|
| Northcrypto | CSV | FIN-FSA säännelty, Suomen #1 |
| Coinmotion | CSV | Suomi |
| Bybit | CSV (API vaihe 4:ssä) | EU:n kasvava #2 Binancen jälkeen |
| OKX | CSV | Globaali top-5 |
| Ledger Live | CSV export | Suosituin hardware wallet |

- [ ] Northcrypto: CSV mapper (`northcryptoLedger.ts`) + asset map + UI + testit (min. 10 testiä)
- [ ] Coinmotion: CSV mapper (`coinmotionLedger.ts`) + asset map + UI + testit
- [ ] Bybit: CSV mapper (`bybitStatement.ts`) + asset map + UI + testit
- [ ] OKX: CSV mapper (`okxStatement.ts`) + asset map + UI + testit
- [ ] Ledger Live: CSV mapper (`ledgerLive.ts`) + UI + testit
- [ ] providerRegistry.ts: coming-soon → active per provider
- [ ] E2E: fixture-pohjainen per provider

---

### Feature 36: Wallet-osoite Import ⬜
**Prioriteetti:** Korkea — Web3-segmentti, avaa ison käyttäjäryhmän

- [ ] Ethereum-osoite (julkinen): `GET /v1/wallet/ethereum/:address` → Etherscan API → LedgerEvent-mappausta
- [ ] ERC-20 token-siirrot mukaan (USDT, USDC, yleisimmät)
- [ ] Bitcoin-osoite: Blockstream API → LedgerEvent-mappausta
- [ ] UI: WalletAddressForm (osoite-input + tarkistussumman validointi + import preview)
- [ ] ProviderCard: "Ethereum Wallet" + "Bitcoin Wallet" registryyn
- [ ] API-avain tallennetaan env:iin (ei käyttäjän vault — julkisia API:ja)
- [ ] Unit-testit: osoitevalidointi + tx-mappausta
- [ ] E2E: fixture-pohjainen

---

### Feature 37: Import FetchPanel → Drawer ⬜
**Prioriteetti:** P2 UX — siirretty Feature 26 backlogista

- [ ] ConnectForm + FetchPanel renderöidään Sheet/Drawer-komponentissa inlinen sijaan
- [ ] ProviderCard: klikkaus avaa Drawerin
- [ ] Sivu ei kasva kun useampi pörssi yhdistetty
- [ ] Drawer sulkeutuu onnistuneen importin jälkeen (success state)

---

## VAIHE 1 — Tuote kuntoon

*Tavoite: tax export toimii, UX on CoinStats-tasoa, landing page kansainvälinen*

---

### Feature 38: Tax Export CSV + PDF ⬜
**Prioriteetti:** Kriittinen — tämä on se mitä Pro-käyttäjä ostaa
**FI only**

- [ ] CSV: Verohallinnon formaatti — päivä, tyyppi, asset, määrä, hankintahinta €, myyntihinta €, voitto/tappio €
- [ ] PDF: react-pdf (ei print-window) — PrivateLedger branding, verovuosi, yhteenveto + taulukkko
- [ ] Filename: `privateledger-veroraportti-2025.csv` / `.pdf`
- [ ] Download-napit TaxPage:lla (Pro-gated, UpgradeModal → Checkout)
- [ ] Unit-testit: CSV-formaatin kenttien validointi + edge caset (ei myyntejä, vain tuloja)

---

### Feature 30: Asset Mapping Auto-suggest ⬜
**Prioriteetti:** P1 — ratkaisee KP-DATA-001

- [ ] `GET /v1/coingecko/search?q=` proxy (Hono + Fastify)
- [ ] UnmappedAssetsQueue: "Suggested: BTC → bitcoin" + hyväksy yhdellä klikkauksella
- [ ] Fuzzy match client-puolella ensin (assetCatalog symbol) — ei API-kutsua jos löytyy suoraan
- [ ] Manuaalinen override säilyy (haku + confirm)
- [ ] Unit-testit: auto-suggest logiikka
- [ ] E2E-testi: unmapped asset näyttää ehdotuksen

---

### Feature 39: Dashboard UX v2 ⬜
**Prioriteetti:** Korkea — ensivaikutelma tuotteesta
**Inspiraatio:** CoinStats UX

- [ ] Kokonaisarvo + 24h muutos iso ja etusijalla — nykyistä visuaalisesti vahvempi
- [ ] Per-asset sparkline-kaaviot (7D) position-listassa (lightweight-charts tai recharts)
- [ ] "Connect your first exchange" hero-widget koko leveyteen kun ei importtia
- [ ] Portfolio allocation donut päivitetty (selkeämmät labelit)
- [ ] Performance: liveQuery optimointi jos sparkline hidastaa

---

### Feature 40: Landing Page v2 ⬜
**Prioriteetti:** Korkea — kansainvälinen positiointi

- [ ] Headline: "Privacy-first crypto portfolio tracker" (ei FI-first)
- [ ] Subheadline: "Works worldwide. Finnish tax reports included."
- [ ] Exchange-logot hero-osiossa (kaikki 10 betaan tulevaa)
- [ ] Kiinteä hinnoittelu näkyviin (ei "~29–49€")
- [ ] Beta-banneri koordinoitu Feature 42:n kanssa (poistetaan launchia varten)

---

## VAIHE 2 — Toiminimi (hallinnollinen)

> **PRH.fi rekisteröinti, ~75€.** Tehdään kun Vaihe 0 + Vaihe 1 on valmis.
> Vaihe 3 (Stripe) alkaa vasta kun Y-tunnus on saatu.

---

## VAIHE 3 — Launch

---

### Feature 41: Stripe Integration ⬜
**Prioriteetti:** Kriittinen — ilman tätä ei tuloja
**Edellyttää:** Toiminimi (Y-tunnus)

- [ ] Stripe business-tili (Y-tunnus + FI pankkitili)
- [ ] `POST /v1/billing/checkout` — luo Checkout Session, redirect Stripeen (Hono + Fastify)
- [ ] `POST /v1/billing/portal` — Stripe Customer Portal (cancel, update, invoice)
- [ ] Webhook `customer.subscription.created/updated/deleted` → päivittää `users.plan` + `plan_expires_at`
- [ ] DB-migraatio: `users.stripe_customer_id TEXT`
- [ ] Hinnoittelu: **2,99 €/kk tai 24,99 €/vuosi** (FI Pro — muut maat myöhemmin)
- [ ] UpgradeModal: "Join waitlist" → oikea Stripe Checkout -linkki
- [ ] AccountPage: nykyinen plan + voimassaoloaika + "Manage subscription" → Stripe Portal
- [ ] Unit-testit: webhook handler (created/updated/deleted)
- [ ] E2E-testi: upgrade flow Stripe test modessa

---

### Feature 42: Launch — Beta Off ⬜
**Edellyttää:** Feature 41 valmis + toiminimi rekisteröity

- [ ] Beta-banneri poistetaan (AppShell + landing page)
- [ ] Landing page final: kiinteä hinnoittelu, ei beta-mainintaa, exchange-logot
- [ ] OG-kuva (`apps/landing/public/og-image.png`, 1200×630px)
- [ ] DNS tarkistus: `private-ledger.app` + `app.private-ledger.app`
- [ ] Cloudflare Pages: landing-projekti tuotannossa
- [ ] Smoke test tuotannossa ennen markkinointia
- [ ] Show HN -postaus (`docs/launch/show-hn-post.md`)

---

## VAIHE 4 — Kasvu (post-launch)

*Järjestys tarkentuu käyttäjäpalautteen perusteella*

---

### Feature 43: Multi-country Tax ⬜
**Järjestys:** Ruotsi → Saksa → Hollanti (EU-first)

- [ ] Tax engine: maakohtaiset säännöt (lot method default, verokannat, raporttirakenne)
- [ ] Tax Profile: lisää maita Settings:iin (SE, DE, NL...)
- [ ] Export: maakohtainen CSV-formaatti per maa
- [ ] Pro myytäville maille avautuu

---

### Feature 44: Lisää Pörssejä ⬜
Käyttäjäpalautteen mukaan priorisoituna:

- [ ] Bitstamp (API)
- [ ] Bitfinex (CSV)
- [ ] Gate.io (CSV)
- [ ] Bybit API (Feature 35:stä oli CSV — tässä vaiheessa API)
- [ ] Solana-lompakko (Solana Beach / Helius API)

---

### Feature 28: AI Transaction Classification ⬜

- [ ] Tuntemattomien / epäselvien transaktioiden luokittelu (Claude API, client-side kutsu)
- [ ] ZK-yhteensopiva: data ei kulje PrivateLedger-palvelimen kautta
- [ ] Käyttäjän opt-in ennen jokaista AI-kutsua
- [ ] Ehdotus + käyttäjä hyväksyy/hylkää

---

### Feature 45: OmaVero XML Export ⬜

- [ ] Verohallinnon virallinen XML-formaatti (ilmoittaminen.fi)
- [ ] Suora lataus — ei copy-paste
- [ ] Pro-gated (FI)

---

### Feature 19: Native iOS/Android ⬜ (backlog)
**ADR:** ADR-014
**Edellyttää:** Web-versio vakaa ja kannattava

- [ ] React Native / Expo — käyttää samoja @kp/core -paketteja
- [ ] Push notifications natiivisti
- [ ] Biometria vault-unlockiin

---

### Feature 20: AI Insights ⬜ (backlog)
**ADR:** ADR-015

- [ ] Portfolio-analyysi (ei automaattisia kauppoja)
- [ ] "What-if" skenaariot verolaskentaan
- [ ] Erillinen opt-in + audit log

---

## Avoimet bugit

| ID | Kuvaus | Prioriteetti | Linkitetty featureen |
|----|--------|-------------|----------------------|
| KP-ALERT-002 | Push-ilmoitukset eivät toimi tuotannossa | P1 | Feature 29 |
| KP-DATA-001 | Asset mapping vaatii liikaa manuaalityötä | P1 | Feature 30 |
| KP-TEST-001 | settings-tax-profile E2E klikkaa disabled Swedeä | P3 | TASK yllä |
| KP-UX-002 | Import FetchPanel inline — ei skaalaudu | P2 | Feature 37 |

---

## Yhteenveto

| Vaihe | Sisältö | Tavoite |
|-------|---------|---------|
| **Vaihe 0** | TASK×2, F31, F32, F33, F34, F29, F35, F36, F37 | Beta toimii globaalisti, 10 integraatiota |
| **Vaihe 1** | F38, F30, F39, F40 | Tax export toimii, UX polished, landing kansainvälinen |
| **Vaihe 2** | — | Toiminimi PRH (hallinnollinen) |
| **Vaihe 3** | F41, F42 | Stripe live + beta pois = launch |
| **Vaihe 4** | F43, F44, F28, F45, F19, F20 | Kasvu: muut maat, AI, native |
