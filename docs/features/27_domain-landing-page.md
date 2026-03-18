# Feature 27: Domain + Landing Page + Markkinointi

**Status:** 📋 SUUNNITTEILLA
**Paketti:** `apps/landing/` (uusi) + Cloudflare Pages -konfiguraatio
**Prioriteetti:** P1 — kasvun perusta
**Roadmap:** PRODUCT_ROADMAP_2026.md § 1.5, 1.6

---

## Tavoite

Julkaistaan PrivateLedger markkinoille omalla domainilla (`private-ledger.app`).
Erillinen staattinen landing page joka:
- Selittää ZK-arkkitehtuurin konkreettisesti (USP erottaa kilpailijoista)
- Näyttää animoidun dashboard-previewan (laskee kynnystä rekisteröintiin)
- Esittelee hinnoittelun
- Sisältää suomenkielisen SEO-artikkelin (`/blog/`)

Nykyinen PWA siirtyy osoitteeseen `app.private-ledger.app`.

---

## Vaatimukset

### Vaihe 1 — Landing page + domain

- [ ] `apps/landing/` — uusi Vite + React + Tailwind -app monorepoossa
- [ ] Hero-osio: "The only crypto tracker that can't see your data." + CTA-painikkeet
- [ ] ZK-selitys: konkreetti 2–3 lauseen selitys miten se toimii (ei pelkkä slogan)
- [ ] Animoitu dashboard-mockup (Framer Motion, mock-data, ei oikeaa API:a)
- [ ] Feature-highlights: 3–4 USP-korttia (ZK, Finnish tax, Exchange sync, Privacy)
- [ ] Pricing-osio: Free / Pro taulukko (PRODUCT_ROADMAP_2026.md § 1.4 hinnat)
- [ ] Footer: GitHub-linkki, privacy tagline, CTA
- [ ] Meta-tagit: title, description, OG-image, Twitter card
- [ ] `sitemap.xml` + `robots.txt`
- [ ] Mobile-responsive, "Encrypted Luxury" -estetiikka (dark premium, #111111, #FF8400)
- [ ] Cloudflare Pages -deploy: `private-ledger.app` → landing
- [ ] Custom domain: `app.private-ledger.app` → nykyinen PWA

### Vaihe 2 — SEO-artikkeli

- [ ] `/blog/krypto-verotus-suomi-2026` — suomenkielinen sivu landing-appissa
- [ ] Artikkelin runko: Verohallinnon ohje, OmaVero step-by-step, HMO-selitys, PrivateLedger-maininta
- [ ] Oikeat meta-tagit: lang="fi", structured data (Article schema)
- [ ] Linkki appiin relevanteissa kohdissa (ei aggressiivinen)

### Vaihe 3 — Show HN launch

- [ ] Hacker News Show HN -postauksen draft (`docs/launch/show-hn-post.md`)
- [ ] Tekninen ZK-arkkitehtuurikuvaus (2–3 kappaletta) englanninkieliseen postiin
- [ ] Launch checklist (`docs/launch/launch-checklist.md`)

---

## Tekninen suunnitelma

### `apps/landing/` — rakenne

```
apps/landing/
  src/
    main.tsx               # React entry
    App.tsx                # Router (react-router-dom): / ja /blog/*
    pages/
      LandingPage.tsx      # Hero + ZK + Mockup + Features + Pricing + Footer
      BlogArticleFi.tsx    # /blog/krypto-verotus-suomi-2026
    components/
      HeroSection.tsx      # Headline, subheadline, CTA-napit
      ZkExplainerSection.tsx  # ZK selitys + 3-vaiheen kaavio
      DashboardMockup.tsx  # Animoitu portfolio-preview (Framer Motion)
      FeatureCards.tsx     # 4 USP-korttia
      PricingSection.tsx   # Free / Pro vertailutaulukko
      Footer.tsx
    styles/
      globals.css          # Tailwind directives, sama dark theme kuin PWA
  index.html               # Meta-tagit, OG, lang, fonts
  vite.config.ts
  tailwind.config.cjs
  package.json
public/
  robots.txt
  sitemap.xml
  og-image.png            # 1200x630 OG-kuva (staattinen)
```

### `package.json` riippuvuudet

Pienin mahdollinen dependency-joukko:

```json
{
  "dependencies": {
    "react": "^18",
    "react-dom": "^18",
    "react-router-dom": "^6",
    "framer-motion": "^11",
    "lucide-react": "^0.400"
  },
  "devDependencies": {
    "vite": "^5",
    "@vitejs/plugin-react": "^4",
    "tailwindcss": "^3",
    "postcss": "^8",
    "autoprefixer": "^10",
    "typescript": "^5"
  }
}
```

Ei jaeta `@kp/core`:ia tai muita monorepo-paketteja — landing on täysin itsenäinen.

### `DashboardMockup.tsx` — animoitu mockup

Framer Motion -scriptatttu animaatiosekvenssi:

```
Käynnistys (delay 0.5s):
  → Portfolio value counter pyörii ylös: 0 → 14 247,30 €
  → 3 asset-riviä fade-in staggerilla (BTC, ETH, SOL)
  → Price badges: vilkkuu vihreäksi/punaiseksi (random interval)
  → ValueChart: path-animaatio piirtää arvoviivan vasemmalta oikealle
  → KPI-kortit: stagger entrance
  → Alert badge: "🔔 1" ilmestyy sidebar-ikoniin

Loop-animaatio (8s sykli):
  → Luvut päivittyvät pienellä vaihtelulla (±1–3%)
  → Yksi asset vilkkuu "syncing..."
```

Mock-data kovakoodattu komponenttiin — ei API-kutsuja, ei randomia joka renderöinnillä (SSR-compatible).

### SEO-metatagit (`index.html`)

```html
<html lang="fi">
<head>
  <title>PrivateLedger — Kryptoportfolio joka ei näe dataasi</title>
  <meta name="description" content="Zero-knowledge kryptoportfolio. Verolaskenta, exchange-integraatiot ja portfolio-seuranta — kaikki salattu laitteellasi. Palvelimemme ei koskaan näe numeroitasi." />
  <meta property="og:title" content="PrivateLedger" />
  <meta property="og:description" content="The only crypto tracker that can't see your data." />
  <meta property="og:image" content="https://private-ledger.app/og-image.png" />
  <meta property="og:url" content="https://private-ledger.app" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="canonical" href="https://private-ledger.app" />
</head>
```

### Cloudflare Pages -konfiguraatio

Kaksi erillistä Cloudflare Pages -projektia:

| Projekti | Repo/hakemisto | Custom domain |
|---|---|---|
| `privateledger-landing` | `apps/landing/` | `private-ledger.app` |
| `privateledger-app` (nykyinen) | repo root | `app.private-ledger.app` |

**`apps/landing/` build:**
```
Build command:  pnpm --filter @kp/landing build
Output dir:     dist/
```

**Nykyinen app (kryptoportfolio.pages.dev):**
- Lisätään `app.private-ledger.app` custom domainiksi Cloudflare Pages -hallintapaneelissa
- `kryptoportfolio.pages.dev` jää toimimaan (backward compat)
- WelcomePage lisätään "→ app.private-ledger.app" -linkki jos käyttäjä tulee landing pagelta

**`apps/landing/` wrangler.toml** (tai Pages settings):
```toml
name = "privateledger-landing"
pages_build_output_dir = "dist"
```

### Monorepo-integraatio

`pnpm-workspace.yaml` — landing lisätään:
```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'functions'
```

`apps/landing/package.json`:
```json
{
  "name": "@kp/landing",
  "private": true
}
```

Root `package.json` script:
```json
"dev:landing": "pnpm --filter @kp/landing dev",
"build:landing": "pnpm --filter @kp/landing build"
```

### SEO-artikkeli `/blog/krypto-verotus-suomi-2026`

React-komponentti `BlogArticleFi.tsx` — ei CMS, plain TSX-sisältö.

Artikkelin runko:
1. **Johdanto** — kryptoverovelvollisuus Suomessa
2. **Mitä pitää ilmoittaa** — luovutusvoitot, staking-tulot, airdropsit
3. **HMO-olettama** — milloin kannattaa käyttää
4. **OmaVero step-by-step** — kuvat / kaaviot (staattinen tai mocked)
5. **PrivateLedger** — kuinka se auttaa (ei aggressiivinen myyntipuhe)
6. **Usein kysytyt** — FAQ-lista

Structured data:
```json
{
  "@type": "Article",
  "headline": "Krypto verotus Suomessa 2026 — OmaVero step by step",
  "datePublished": "2026-03-XX",
  "author": { "@type": "Organization", "name": "PrivateLedger" },
  "inLanguage": "fi"
}
```

---

## UI-suunnitelma

### Hero-osio

```
┌─────────────────────────────────────────────────────────┐
│  [PrivateLedger logo]                    [Sign in] [Get started →]
│                                                         │
│  The only crypto tracker                               │
│  that can't see your data.                             │
│                                                         │
│  Zero-knowledge architecture: your transactions are     │
│  encrypted on your device before they leave it.         │
│  Our servers store only ciphertext — mathematically     │
│  impossible to decrypt without your passphrase.         │
│                                                         │
│  [→ Start for free]  [See how it works ↓]              │
└─────────────────────────────────────────────────────────┘
```

### Animoitu mockup (dark, premium)

```
┌──────────────────────────────────────────────┐
│  ● synced · just now                         │
│                                              │
│  Portfolio value                             │
│  14 247,30 €  ↑ +3.2% (24h)                │
│                                              │
│  ████████████████████  [chart animating]     │
│                                              │
│  BTC   0.142    6 820 € ↑+2.1%              │
│  ETH   2.50     4 312 € ↑+1.8%              │
│  SOL   45.0     3 115 € ↓-0.4%              │
└──────────────────────────────────────────────┘
```

### ZK-selitysosio (3 vaihetta)

```
1. [🔐] You enter transactions
         "Your data is encrypted with your passphrase
          before it touches the network."

2. [📦] We store an envelope
         "Our server receives an encrypted blob.
          Without your passphrase, it's unreadable —
          even to us."

3. [🔓] You decrypt locally
         "When you open the app, data decrypts
          in your browser. Your key never leaves
          your device."
```

### Pricing-osio

```
          FREE              PRO €4,99/kk
          ────              ─────────────
          Portfolio tracking    ✓ kaikki +
          1 exchange            Kaikki exchanget
          1 vuosi historia      Rajoittamaton historia
          3 hälytystä           Rajattomat hälytykset
          Tax preview           Verolaskennan tulokset
          —                     HMO-laskuri
          —                     OmaVero-opas
          —                     PDF + CSV export

     [Get started free]    [Start Pro trial →]
```

---

## Testaus

**Unit-testit (Vitest):**
- `LandingPage.tsx` renderoituu ilman erroreita
- `PricingSection.tsx` näyttää Free + Pro -sarakkeet
- `DashboardMockup.tsx` renderoituu (snapshot)
- `BlogArticleFi.tsx` renderoituu + sisältää oikeat meta-tagit

**Smoke-testi (manuaalinen tai Playwright):**
- `private-ledger.app/` latautuu, hero-teksti näkyy
- `private-ledger.app/blog/krypto-verotus-suomi-2026` latautuu
- CTA-linkit vievät `app.private-ledger.app/welcome`-sivulle
- Mobile 375px: layout toimii

**Ei E2E-testejä CI:hin** — landing page on staattinen sisältö, yksikkötestit + manuaaliset tarkistukset riittävät.

---

## Riippuvuudet

- Feature 22/23 ✅ — "Encrypted Luxury" -design kielellä on referenssi
- Feature 24/25 ✅ — Pricing ja tax features vakaat ennen markkinointia
- Domain `private-ledger.app` ostettava ennen deployä
- Cloudflare Pages: toinen projekti luotava manuaalisesti

---

## Riskit / rajoitteet

| Riski | Todennäköisyys | Mitigaatio |
|---|---|---|
| `private-ledger.app` on jo varattu | Matala | Tarkista ensin, fallback `.fi` tai `.io` |
| Landing page duplikoi PWA:n WelcomePage -koodia | Matala | Erillinen paketti, jaettu vain design-kieli |
| SEO-artikkeli vanhenee nopeasti (Verohallinto muuttuu) | Keski | Päiväys näkyvissä, "päivitetty: 2026-03-XX" |
| Animaatio raskas mobiililla | Matala | `prefers-reduced-motion` + yksinkertaistettu fallback |

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `apps/landing/` — uusi app
- [ ] `pnpm-workspace.yaml` — landing lisätty
- [ ] `package.json` (root) — `dev:landing` + `build:landing` scriptit
- [ ] Cloudflare Pages: `privateledger-landing` -projekti luotu
- [ ] DNS: `private-ledger.app` → Cloudflare Pages
- [ ] DNS: `app.private-ledger.app` → nykyinen Pages-projekti

### Env-muutokset
Ei uusia env-muuttujia. Landing on täysin staattinen.

### Deploy-ohjeet
1. `pnpm build:landing` — tarkista `apps/landing/dist/`
2. Cloudflare Pages: uusi projekti, `apps/landing/` root, `dist/` output
3. Custom domain `private-ledger.app` lisätään Pages-projektiin
4. `app.private-ledger.app` lisätään olemassa olevaan projektiin
5. DNS TTL: 1h → tarkista propagaatio

---

## Vaiheistus

```
Vaihe 1 (toteutus-session 1):
  → apps/landing/ scaffolding + routing
  → HeroSection + ZkExplainer + FeatureCards + Footer
  → DashboardMockup (Framer Motion)
  → PricingSection
  → Meta-tagit + OG + robots.txt + sitemap.xml
  → Build + Cloudflare Pages deploy
  → Manuaalinen tarkistus: private-ledger.app

Vaihe 2 (toteutus-session 2):
  → BlogArticleFi.tsx (/blog/krypto-verotus-suomi-2026)
  → Structured data (Article schema)
  → Sisältö: HMO + OmaVero + FAQ

Vaihe 3 (launch):
  → docs/launch/show-hn-post.md (EN, tekninen ZK-postaus)
  → docs/launch/launch-checklist.md
  → Show HN julkaistaan manuaalisesti
```
