# PrivateLedger — Product Roadmap 2026

**Päivitetty:** 2026-03-19
**Versio:** Roadmap v2 — strateginen uudelleenarviointi

---

## TUOTEVISION TIIVISTELMÄ

**PrivateLedger on yksityisyyteen ensimmäisenä perustuva kryptoportfolion hallinta- ja verolaskentasovellus.**

- **USP:** Zero-knowledge -arkkitehtuuri — palvelin ei koskaan näe käyttäjän dataa selkotekstinä. Ainoa kilpailija joka tämän teknisesti toteuttaa.
- **Kohderyhmä:** Kuka tahansa maailmassa portfolion seurantaan. Suomalaiset verolaskentaan.
- **Ansaintamalli:** Freemium — portfolio-seuranta ilmaiseksi, veroraporttien export (CSV + PDF) Pro-tilauksen takana.

---

## KILPAILUTILANNE

| Kilpailija | Vahvuus | Heikkous vs. PrivateLedger |
|------------|---------|---------------------------|
| kryptoverotus.fi | 130+ integraatiota, HMO, OmaVero | Ei privacy, data kolmansille osapuolille, kallis (€49–€399/v) |
| Divly | Paras Pohjoismaat-tuki | Ei ZK, ruotsalainen (FI-tuki puutteellinen) |
| Koinly | 350+ integraatiota, vahva SEO | Ei ZK, kallis, ei FI-erityistuki |
| CoinStats | Erinomainen UX, globaali kattavuus | Ei ZK, ei verolaskenta |

**Erottautumistekijä:** ZK-arkkitehtuuri + FI-verolaskenta (HMO, lompakkokohtainen FIFO, OmaVero) + kilpailukykyinen hinta.

---

## NYKYTILA (2026-03-19)

### Valmis
- Core: ledger (append-only), lot engine, tax engine, vault (zero-knowledge), E2E sync
- Pörssit: Coinbase, Binance, Kraken (API + CSV)
- Tax: FIFO/LIFO/HIFO/AVG, HMO-laskuri, transfer detection, OmaVero guide
- UI: Premium dark design system (shadcn/ui, Framer Motion), i18n EN+FI
- Infra: Cloudflare Pages + Neon Postgres + Worker (cron), CI/CD, 260 testiä
- Billing infra: Free/Pro plan, GateWall — **Stripea ei vielä**
- Landing page: private-ledger.app, SEO, FI blogi

### Kesken / Puuttuu
- **Multi-device vault**: uudella laitteella pitää syöttää passphrase uudelleen → kriittinen UX-ongelma
- **Stripe**: maksaminen ei ole mahdollista — "Join waitlist" nappi ainoana toimintona
- **Tax export**: CSV/PDF-koodi on olemassa mutta gated ilman ostamisen mahdollisuutta
- **Push-ilmoitukset**: infra on, tuotannossa ei toimi (KP-ALERT-002)
- **Pörssikattavuus**: 3/10 tavoitellusta beta-integraatiosta valmis
- **Multi-currency**: vain EUR tällä hetkellä

---

## STRATEGINEN PÄÄTÖS: JÄRJESTYS

```
Kaikki kuntoon → toiminimi → Stripe + launch
```

Toiminimi ja Stripe ovat toiseksi- ja viimeinen vaihe. Ensin tuote on oltava oikeasti hyvä.
Tähän asti jokainen käyttäjä voi tulla seuraamaan portfolioaan ilmaiseksi (beta).
Tax-ominaisuudet vain FI-käyttäjille toistaiseksi.

---

## VAIHE 0 — Beta-valmius

**Tavoite:** Tuote toimii luotettavasti. Kuka tahansa mistä maasta vain voi seurata portfoliotaan. Riittävä pörssikattavuus jotta palvelu kiinnostaa.

| # | Feature | Kriittisyys |
|---|---------|------------|
| – | Beta-banneri (AppShell + landing) | Välitön |
| – | KP-TEST-001 korjaus | Välitön |
| F31 | Multi-device Vault — passphrase näkymättömäksi | **Kriittisin** |
| F32 | Onboarding Simplification (2-step, vault taustalla) | Kriittinen |
| F33 | Multi-currency USD/EUR/GBP | Kriittinen |
| F34 | International Mode (portfolio-only ei-FI käyttäjille) | Korkea |
| F29 | Alert Delivery Diagnostics + fix | P1 |
| F35 | Exchange Coverage: Northcrypto, Coinmotion, Bybit, OKX, Ledger | Kriittinen |
| F36 | Wallet-osoite Import (Ethereum + Bitcoin) | Korkea |
| F37 | Import FetchPanel → Drawer | P2 UX |

**Beta-vaiheen pörssikattavuus (tavoite 10):**
Coinbase ✅ · Binance ✅ · Kraken ✅ · Northcrypto · Coinmotion · Bybit · OKX · Ledger Live · Ethereum Wallet · Bitcoin Wallet

---

## VAIHE 1 — Tuote kuntoon

**Tavoite:** Tax export toimii. UX on CoinStats-tasoa. Landing page puhuttelee kansainvälistä käyttäjää.

| # | Feature | Kriittisyys |
|---|---------|------------|
| F38 | Tax Export CSV + PDF (FI only, Pro-gated) | **Kriittinen** — tämä on myytävä tuote |
| F30 | Asset Mapping Auto-suggest | P1 |
| F39 | Dashboard UX v2 (sparklines, hero-widget, CoinStats-taso) | Korkea |
| F40 | Landing Page v2 (kansainvälinen positiointi, kiinteä hinta) | Korkea |

---

## VAIHE 2 — Toiminimi

**PRH.fi rekisteröinti (~75€).** Tehdään kun Vaihe 0 + 1 on valmis.
Vaihe 3 alkaa vasta kun Y-tunnus on saatu (Stripe vaatii business-tilin).

---

## VAIHE 3 — Launch

**Tavoite:** Stripe live, beta pois, tuote julkisesti maksullinen.

| # | Feature | Kriittisyys |
|---|---------|------------|
| F41 | Stripe Integration (Checkout + webhook + Portal) | **Kriittinen** |
| F42 | Launch — Beta Off (banneri pois, landing final, Show HN) | **Kriittinen** |

**Hinnoittelu launch-hetkellä:**
- Free: portfolio-seuranta, 3 pörssiä, alertit — kaikille, kaikkialta
- Pro: tax export CSV + PDF, HMO-laskuri, OmaVero guide — **2,99 €/kk tai 24,99 €/vuosi** (FI only toistaiseksi)

---

## VAIHE 4 — Kasvu (post-launch)

*Järjestys tarkentuu käyttäjäpalautteen perusteella. Alla suuntaa-antava.*

| # | Feature | Perustelut |
|---|---------|-----------|
| F43 | Multi-country Tax (SE → DE → NL) | Pro avautuu uusille markkinoille |
| F44 | Lisää pörssejä (Bitstamp, Bitfinex, Gate.io, Bybit API, Solana wallet) | Kattavuus kilpailijoiden tasolle |
| F28 | AI Transaction Classification (Claude API, client-side, opt-in) | Erottautumistekijä, ZK-yhteensopiva |
| F45 | OmaVero XML Export (suora Verohallintoon) | FI Pro premium-ominaisuus |
| F19 | Native iOS/Android (React Native + Expo) | Vasta kun web vakaa + kannattava |
| F20 | AI Insights (portfolio-analyysi, ei automaattisia kauppoja) | Pitkän aikavälin erottautuminen |

---

## HINNOITTELUSTRATEGIA

### Launch (FI Pro only)
| Taso | Hinta | Sisältö |
|------|-------|---------|
| Free | 0 € | Portfolio-seuranta, 10 pörssiä, alertit, multi-device |
| Pro | 2,99 €/kk tai 24,99 €/vuosi | + Tax export CSV/PDF, HMO-laskuri, OmaVero guide |

### Kasvu (kun muut maat mukana)
| Taso | Hinta | Sisältö |
|------|-------|---------|
| Free | 0 € | Portfolio-seuranta globaalisti |
| Pro | maakohtainen | Tax reports per maa, lokaalisti relevantti hinta |

**Positiointi kilpailijoihin:** kryptoverotus.fi veloittaa €49–€399/verovuosi. Me 24,99 €/vuosi + privacy-first. Selkeä value proposition.

---

## UX-FILOSOFIA

**Inspiraatio:** CoinStats UX — yksinkertainen onboarding, pörssit ja lompakot etusijalla, data heti näkyvissä.

**Erottautuminen CoinStatsista:** Privacy. Kaikki data salataan laitteella. Palvelin näkee vain ciphertext-kirjekuoria. Tämä ei saa aiheuttaa kitka — zero-knowledge on arkkitehtuurinen päätös, ei käyttöliittymäkonsepti.

**UX-periaatteet:**
1. Passphrase ei näy käyttäjälle onboardingissa — vault generoituu taustalla
2. Uusi laite = kirjaudu sisään → kaikki data siellä (ei passphrase-promptia)
3. "Connect your exchange" on ensimmäinen ja tärkein toiminto uudelle käyttäjälle
4. Tax-raportti on se asia josta maksetaan — sen pitää olla selkeä ja helppo ladata

---

## INTEGRAATIOKATTAVUUS — TAVOITTEET

| Vaihe | Integraatioiden määrä | Tärkeimmät lisäykset |
|-------|-----------------------|----------------------|
| Beta (Vaihe 0) | 10 | + Northcrypto, Coinmotion, Bybit, OKX, Ledger Live, ETH wallet, BTC wallet |
| Launch (Vaihe 3) | 10 | Sama kuin beta |
| Kasvu (Vaihe 4) | 15+ | + Bitstamp, Bitfinex, Gate.io, Solana wallet, Bybit API |
| Pitkä tähtäin | 30+ | Kilpailija Koinlylle integraatiomäärässä |

---

## AVOIMET RISKIT

| Riski | Todennäköisyys | Vaikutus | Mitigaatio |
|-------|---------------|----------|-----------|
| Multi-device vault -muutos rikkoo olemassa olevat käyttäjät | Matala | Korkea | Backward-compat fallback + migraatiopath |
| Push notifications ei saada toimimaan tuotannossa | Keski | Keski | Diagnostiikka-UI + feature piilotetaan tarvittaessa |
| Northcrypto/Coinmotion CSV-formaatti muuttuu | Keski | Matala | Mapper + testit, nopea korjaus |
| Stripe-integraatio vaatii enemmän compliance-työtä kuin odotettiin | Matala | Korkea | Toiminimi ensin, Stripe test mode kehityksessä |
| Kilpailija kopioi ZK-arkkitehtuurin | Matala | Matala | Tekninen etumatka + käyttäjäluottamus rakentuu ajan myötä |
