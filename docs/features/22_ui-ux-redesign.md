# Feature 22: UI/UX Redesign + Design System

**Status:** ✅ VALMIS (2026-03-15)
**Prioriteetti:** Kriittinen — tehdään ENNEN Feature 13 (Imports) ja Feature 14 (Billing)
**Edellyttää:** Feature 12 valmis, PRODUCT_VISION.md ✅
**Paketti:** `apps/web` (pääosin), `packages/core` (i18n-avaimet)

---

## Tavoite

Muuttaa VaultFolio "developer builds a frontend" -tilasta ammattimaiseksi, luotettavalta näyttäväksi tuotteeksi. Luodaan design system, yksinkertaistetaan navigaatio, toteutetaan branding ja i18n (EN+FI). Tämän jälkeen tuote on valmis esiteltäväksi ja markkinoitavaksi.

## Tyoskentelytapa: Figma first, then code

**Kaikki UI-suunnittelu tehdaan Figmassa ENNEN koodin kirjoittamista.**

1. Suunnittele design system Figmassa: varipaletti, typografia, spacing, komponentit
2. Suunnittele avainruudut: Welcome, Dashboard, Portfolio, Transactions, Taxes, Settings
3. Mobile (375px) + desktop (1440px) breakpoint jokaisesta ruudusta
4. Iteroi Figma MCP:lla (get_design_context, get_screenshot) kunnes design on hyvalla tasolla
5. Toteuta koodi Figma-designin pohjalta — ei improvisoitua UI:ta

**Miksi:** Designin iterointi Figmassa on 10x nopeampaa kuin koodissa. Koodi kirjoitetaan vasta kun visuaalinen suunta on lyoty lukkoon.

---

## Nykytila (ongelmat)

| Ongelma | Vaikutus |
|---------|----------|
| Ei design systemiä — kaikki värit/tyylit kovakoodattu Tailwind-luokkina JSX:ään | Epäyhtenäinen ulkoasu, muutokset vaativat jokaisen tiedoston käsin muokkaamista |
| Tailwind config tyhjä (`extend: {}`) — ei omia tokeneita | Ei branding-kontrollia |
| 17 sivua header-navigaatiossa | Sekava, mobiilissa mahdoton käyttää |
| Ei token-ikoneita (pelkkä teksti) | Halpa vaikutelma |
| Ei i18n:ää — kaikki tekstit kovakoodattu englanniksi | Ei skaalaudu |
| Ei empty state -designia | Uusi käyttäjä ei tiedä mitä tehdä |
| Ei responsiivista mobiili-UX:ää | PWA:n pitäisi tuntua natiivina |
| Logo/branding puuttuu | Ei tunnistettavuutta |

---

## Vaatimukset

### V1: Design System Foundation
- [ ] **V1.1** Tailwind theme config: custom väripaletti (brand, surface, border, text, accent, semantic)
- [ ] **V1.2** CSS-muuttujat (`--color-brand-*`, `--color-surface-*`) → Tailwind pluginin kautta
- [ ] **V1.3** Typography-asteikko: heading (h1-h4), body, caption, mono — Inter-fontti
- [ ] **V1.4** Spacing-asteikko: card padding, section gap, page margin (konsistentti)
- [ ] **V1.5** UI-komponenttikirjasto: Button, Card, Input, Select, Badge, Modal, Drawer, Tabs, Tooltip
- [ ] **V1.6** Ikonisetti: lucide-react (yhtenäinen, tree-shakeable)

### V2: Navigaatio + Layout
- [ ] **V2.1** Shell-uudistus: sidebar (desktop) + bottom tab bar (mobiili)
- [ ] **V2.2** 17 sivua → 5 päänäkymää: Home, Portfolio, Transactions, Taxes, Settings
- [ ] **V2.3** Sekundääriset sivut (Alerts, Assets, Accounts, Account, Imports) alinäkymiksi tai tabeihin
- [ ] **V2.4** Breadcrumb / back-navigaatio syvemmille näkymille
- [ ] **V2.5** Mobile bottom tab bar: ikonit + labelit, aktiivinen tila

### V3: Branding + Visual Identity
- [ ] **V3.1** Logo: vault/shield-motif + "VaultFolio" wordmark (SVG)
- [ ] **V3.2** PWA manifest: nimi "VaultFolio", uusi ikoni, theme_color, splash
- [ ] **V3.3** Värimaailma: "Obsidian" dark theme — near-black bg, emerald/teal accent
- [ ] **V3.4** Welcome-sivu redesign: myy hyödyt, ei teknisiä termejä, CTA-painikkeet
- [ ] **V3.5** Favicon + social meta tags (og:image)

### V4: Token Icons + Data Visualization
- [ ] **V4.1** TokenIcon-komponentti: CoinGecko `iconUrl` → `<img>` + letter avatar fallback
- [ ] **V4.2** TokenIcon käytössä: Dashboard, Portfolio, Transactions, Tax, Alerts, Imports
- [ ] **V4.3** Dashboard redesign: KPI-kortit (total value, 24h change, top gainer/loser), allokaatio-donitsi, value chart
- [ ] **V4.4** Chart-teema: design system -värit (ei kovakoodattuja hex-arvoja)

### V5: Empty States + Onboarding Flow
- [ ] **V5.1** Empty state -komponentti: ikoni + otsikko + kuvaus + CTA
- [ ] **V5.2** Dashboard empty: "Add your first exchange" → Imports
- [ ] **V5.3** Portfolio empty: "No holdings yet" → Imports
- [ ] **V5.4** Transactions empty: "Import transactions" → Imports
- [ ] **V5.5** Onboarding progress: "Connect exchange → Review → Done" (visuaalinen ohjaus)

### V6: i18n (EN + FI)
- [ ] **V6.1** react-i18next setup + konfiguraatio
- [ ] **V6.2** Käännöstiedostot: `locales/en.json`, `locales/fi.json`
- [ ] **V6.3** Kaikki UI-tekstit siirretty käännösavaimiksi (sivut + komponentit)
- [ ] **V6.4** Language selector Settings-sivulle
- [ ] **V6.5** Locale-aware formatointi: numerot, päivämäärät, valuutat (date-fns locale)

### V7: Mobile-First Responsive
- [ ] **V7.1** Kaikki sivut toimivat 375px → 1440px viewport-leveydellä
- [ ] **V7.2** Touch-ystävälliset hit targetit (min 44x44px)
- [ ] **V7.3** Swipe-eleet: drawer close, tab navigation
- [ ] **V7.4** PWA: standalone-tila tuntuu natiivina (safe area, status bar)

---

## Tekninen suunnitelma

### Vaihe A: Design System Foundation (V1)

#### Tailwind Config (`apps/web/tailwind.config.cjs`)
```js
module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: 'var(--color-brand)',
          light: 'var(--color-brand-light)',
          dark: 'var(--color-brand-dark)',
        },
        surface: {
          base: 'var(--color-surface-base)',      // page bg
          raised: 'var(--color-surface-raised)',    // card bg
          overlay: 'var(--color-surface-overlay)',  // modal bg
        },
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },
        content: {
          primary: 'var(--color-content-primary)',
          secondary: 'var(--color-content-secondary)',
          tertiary: 'var(--color-content-tertiary)',
          inverse: 'var(--color-content-inverse)',
        },
        semantic: {
          success: 'var(--color-semantic-success)',
          warning: 'var(--color-semantic-warning)',
          error: 'var(--color-semantic-error)',
          info: 'var(--color-semantic-info)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'heading-1': ['1.875rem', { lineHeight: '2.25rem', fontWeight: '700' }],
        'heading-2': ['1.5rem', { lineHeight: '2rem', fontWeight: '600' }],
        'heading-3': ['1.25rem', { lineHeight: '1.75rem', fontWeight: '600' }],
        'heading-4': ['1.125rem', { lineHeight: '1.5rem', fontWeight: '500' }],
        'body': ['0.875rem', { lineHeight: '1.25rem' }],
        'caption': ['0.75rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '0.75rem',
        button: '0.5rem',
        input: '0.5rem',
        badge: '9999px',
      },
      spacing: {
        'page': '1.5rem',       // page padding
        'section': '1.5rem',    // gap between sections
        'card': '1rem',         // card internal padding
      },
    },
  },
  plugins: [],
};
```

#### CSS Variables (`src/styles/tokens.css`)
```css
:root {
  /* Brand */
  --color-brand: #10b981;         /* emerald-500 */
  --color-brand-light: #34d399;   /* emerald-400 */
  --color-brand-dark: #059669;    /* emerald-600 */

  /* Surfaces */
  --color-surface-base: #0a0f1a;
  --color-surface-raised: rgba(15, 23, 42, 0.6);  /* slate-900/60 */
  --color-surface-overlay: rgba(15, 23, 42, 0.95);

  /* Borders */
  --color-border: #1e293b;        /* slate-800 */
  --color-border-subtle: #1e293b80;

  /* Content */
  --color-content-primary: #f1f5f9;    /* slate-100 */
  --color-content-secondary: #94a3b8;  /* slate-400 */
  --color-content-tertiary: #64748b;   /* slate-500 */
  --color-content-inverse: #0a0f1a;

  /* Semantic */
  --color-semantic-success: #10b981;
  --color-semantic-warning: #f59e0b;
  --color-semantic-error: #ef4444;
  --color-semantic-info: #3b82f6;
}
```

#### UI-komponenttikirjasto (`src/components/ui/`)

Luodaan pienet, fokusoituneet komponentit:

| Komponentti | Tiedosto | Rivejä (max) | Kuvaus |
|-------------|----------|--------------|--------|
| `Button` | `Button.tsx` | 60 | variant: primary/secondary/ghost/danger, size: sm/md/lg, loading state |
| `Card` | `Card.tsx` | 30 | Wrapper: surface-raised + border + border-radius |
| `Input` | `Input.tsx` | 50 | label, error, icon, type variants |
| `Select` | `Select.tsx` | 40 | Styled native select |
| `Badge` | `Badge.tsx` | 25 | variant: default/success/warning/error, size: sm/md |
| `Modal` | `Modal.tsx` | 80 | Portal-based, overlay, close button, title |
| `Drawer` | `Drawer.tsx` | 80 | Slide-in panel (right), overlay |
| `Tabs` | `Tabs.tsx` | 50 | Tab list + panels, controlled/uncontrolled |
| `Tooltip` | `Tooltip.tsx` | 40 | Hover tooltip |
| `EmptyState` | `EmptyState.tsx` | 30 | icon + title + description + action |
| `TokenIcon` | `TokenIcon.tsx` | 40 | CoinGecko icon + letter fallback |
| `Spinner` | `Spinner.tsx` | 15 | Loading indicator |
| `KpiCard` | `KpiCard.tsx` | 35 | Label + value + delta (change %) |

**Ikonikirjasto:** `lucide-react` — MIT, tree-shakeable, 1500+ ikonia, konsistentti tyyli.

---

### Vaihe B: Navigation + Layout (V2)

#### Nykyinen (17 sivua, header-nav):
```
Dashboard | Portfolio | Transactions | Strategy | Alerts | Imports | Tax | Assets | Accounts | Account | Settings
```

#### Uusi (5 päänäkymää):

**Desktop: sidebar (240px, fixed left)**
```
🏠 Home          → DashboardPage
📊 Portfolio     → PortfolioPage
📜 Transactions  → TransactionsPage (+ Imports tab)
📑 Taxes         → TaxPage
⚙️ Settings      → SettingsPage (+ Account, Security, Notifications, Billing tabs)
```

**Mobile: bottom tab bar (5 tabs)**
```
Home | Portfolio | Txns | Taxes | Settings
```

#### Route-uudistus (`App.tsx`)

```
/                     → redirect → /home
/home                 → DashboardPage (was /dashboard)
/portfolio            → PortfolioPage
/portfolio/:assetId   → Token detail (was drawer, nyt oma näkymä mobiililla)
/transactions         → TransactionsPage
/transactions/import  → Import wizard (was /imports)
/taxes                → TaxPage
/taxes/:year          → Tax year detail
/settings             → SettingsPage (tabs: general, account, security, notifications, alerts, assets)
/settings/alerts      → Alerts config (was /alerts)
/settings/assets      → Asset mapping (was /assets)
/settings/account     → Account management (was /account)

# Auth (säilyvät)
/welcome              → WelcomePage
/auth/signup          → SignupPage
/auth/signin          → SigninPage
/vault/setup          → VaultSetupPage
/vault/unlock         → UnlockPage

# Backward compat redirects
/dashboard            → /home
/imports              → /transactions/import
/alerts               → /settings/alerts
/assets               → /settings/assets
/account              → /settings/account
/accounts             → /settings (deprecated)
/strategy             → /home (stub → poistetaan)
```

#### Shell-komponenttien hajotus

| Komponentti | Kuvaus | Rivejä |
|-------------|--------|--------|
| `AppShell.tsx` | Layout wrapper: sidebar + main + bottom bar | 50 |
| `Sidebar.tsx` | Desktop sidebar: nav links + brand logo + lock/sync | 60 |
| `BottomTabBar.tsx` | Mobile bottom tabs | 40 |
| `PageHeader.tsx` | Page title + optional actions | 25 |

---

### Vaihe C: Branding (V3)

#### Logo
- SVG logo: vault/shield-motif + "VaultFolio" wordmark
- Vaihtoehto: suunnittele Figma MCP:llä tai käytä yksinkertaista shield-ikonia (lucide `Shield` + custom text)
- Logon tulee toimia: sidebar (full), mobile header (icon only), PWA splash, favicon

#### PWA Manifest päivitys (`vite.config.ts`)
```js
manifest: {
  name: 'VaultFolio',
  short_name: 'VaultFolio',
  description: 'Privacy-first crypto portfolio tracker',
  theme_color: '#0a0f1a',
  background_color: '#0a0f1a',
  display: 'standalone',
  start_url: '/',
  icons: [
    { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
    { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
    { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ]
}
```

#### Welcome Page redesign
- Hero: "The only crypto tracker that never sees your data."
- 3 myyntipistettä (ikonilla): Zero-knowledge encryption, Multi-exchange import, Tax reports
- CTA: "Get Started Free" (primary) + "Sign In" (secondary)
- Ei teknisiä termejä (ei "E2E encryption", "append-only ledger")

---

### Vaihe D: Token Icons + Data Viz (V4)

#### TokenIcon-komponentti
```tsx
// src/components/ui/TokenIcon.tsx
interface TokenIconProps {
  symbol: string;
  iconUrl?: string | null;
  size?: 'sm' | 'md' | 'lg';  // 20px / 28px / 40px
}
```
- `iconUrl` tulee `assetCatalog`:sta (CoinGecko `image` field)
- Fallback: pyöreä badge, ensimmäinen kirjain, väri johdettu symbolista (hash → hue)
- Lazy loading: `loading="lazy"`

#### Dashboard KPI -kortit
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Total Value      │ │ 24h Change      │ │ Top Gainer      │
│ €12,345.67       │ │ +€234 (+1.9%)   │ │ ETH +5.2%       │
│ ▲ vs yesterday   │ │ ▲ green / ▼ red │ │ 🪙 icon          │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

### Vaihe E: i18n (V6)

#### Setup
```bash
pnpm add react-i18next i18next --filter @kp/web
```

#### Rakenne
```
apps/web/
  src/
    i18n/
      index.ts          # i18n config
      locales/
        en.json         # English (default, ~200 avaimia)
        fi.json         # Finnish
```

#### Avainten nimeäminen
```json
{
  "nav.home": "Home",
  "nav.portfolio": "Portfolio",
  "dashboard.totalValue": "Total Value",
  "dashboard.change24h": "24h Change",
  "dashboard.empty.title": "No portfolio data yet",
  "dashboard.empty.description": "Connect an exchange to get started",
  "dashboard.empty.cta": "Add Exchange",
  "common.save": "Save",
  "common.cancel": "Cancel",
  "common.loading": "Loading..."
}
```

#### Formatointi
- `date-fns/locale/fi` ja `date-fns/locale/enUS`
- `Intl.NumberFormat` valuutta- ja lukuformatointi
- Settings-sivu: kielivalitsin (EN/FI)

---

## UI-suunnitelma

### Figma-työskentely
PRODUCT_VISION.md määrää "Figma first, then code". Suositeltava prosessi:
1. Suunnittele design system Figmassa (värit, typografia, komponentit)
2. Suunnittele avainruudut: Welcome, Dashboard, Portfolio, Tax, Settings
3. Mobile breakpoint jokaisesta
4. Hyödynnä Figma MCP:tä design-to-code työskentelyssä
5. Implementoi code-side design system ensin, sitten ruudut

### Avainruutujen kuvaus

#### Welcome (unauthenticated)
- Tumma tausta, gradient-korostus ylhäältä
- Logo + tagline keskellä
- 3 USP-korttia (Privacy, Portfolio, Taxes) — ikonilla
- "Get Started Free" (brand-painike) + "Sign In" (ghost)
- Footer: minimaali (privacy policy, terms)

#### Dashboard / Home
- PageHeader: "Home" + last sync timestamp
- KPI-rivi: 3 korttia (Total Value, 24h Change, Top/Bottom performer)
- Allokaatio-donitsi (Recharts) + legenda token-ikoneilla
- Portfolio value chart (30d line chart)
- Viimeisimmät tapahtumat (3-5 kpl) + "View all" link
- Active alerts summary (jos on)

#### Portfolio
- PageHeader: "Portfolio" + sort/filter controls
- Holdings list: TokenIcon + nimi + määrä + arvo + P&L (%) + mini sparkline
- Klikkaus → Token detail (drawer desktop, full page mobile)
- Token detail: hinta, holdingt per account, tapahtumahistoria, lot breakdown

#### Transactions
- Tabs: "All Transactions" | "Import"
- All: virtuaalinen lista + päivämäärä/tyyppi/summa + search/filter
- Import: provider grid → connect wizard (Feature 13 laajentaa)

#### Taxes
- Vuosivalitsin (tabs/dropdown)
- Summary: capital gains, losses, net, income events count
- Realized disposals lista
- Income events lista
- Export CTA (premium — Feature 14)

#### Settings
- Tabs: General | Account | Security | Notifications | Alerts | Assets
- General: language, base currency, lot method, theme
- Account: email, change password
- Security: passkeys, vault passphrase
- Notifications: web push toggle, test notification
- Alerts: alert rules list + create/edit
- Assets: unmapped queue + CoinGecko linking

---

## Toteutusjarjestys (vaiheittain)

```
Vaihe A: Design System Foundation          (V1)        ~4h
  → tokens.css, tailwind.config, UI-komponentit, lucide-react, Inter-fontti

Vaihe B: Navigation + Shell                (V2)        ~3h
  → AppShell, Sidebar, BottomTabBar, route-uudistus, redirectit

Vaihe C: Branding + Welcome                (V3)        ~2h
  → Logo (SVG), PWA manifest, Welcome page redesign, favicon

Vaihe D: Page Redesign                     (V3+V4+V5)  ~6h
  → Dashboard, Portfolio, Transactions, Tax, Settings
  → TokenIcon, EmptyState, KpiCard käyttöönotto
  → Figma MCP iterointia tarvittaessa

Vaihe E: i18n                              (V6)        ~3h
  → react-i18next setup, käännöstiedostot, kaikki UI-tekstit avaimiksi

Vaihe F: Mobile Polish                     (V7)        ~2h
  → Responsive tarkistus, touch targets, PWA standalone
```

**Yhteensä arviolta:** ~20h (4-5 AI-sessiota)

---

## Testaus

### Unit testit (Vitest)
- [x] UI-komponentit: Button renderöi oikein variant/size-yhdistelmillä (44 testiä, kaikki 14 komponenttia)
- [x] TokenIcon: fallback letter avatar kun iconUrl puuttuu, img error handling
- [x] i18n: avaimet löytyvät molemmista kielistä, ei puuttuvia avaimia (6 testiä)
- [ ] Formatointi: valuutat, päivämäärät, prosentit oikeilla locale-asetuksilla (siirretty jatkoon)

### E2E testit (Playwright)
- [x] Navigation: 5 päänäkymää toimivat sidebar-navigaatiolla
- [x] Backward-compat redirectit (vanhat URL:t → uudet)
- [x] Mobile viewport: bottom tab bar näkyy, sidebar piilossa
- [x] Welcome page: branding, USP-kortit, CTA-painikkeet navigoivat oikein
- [x] Language switch: EN ↔ FI vaihto Settings-sivulta, sidebar-labelit päivittyvät

### Visuaalinen tarkistus
- [ ] Figma MCP screenshot-vertailu avainruuduista (manuaalinen)
- [ ] 375px, 768px, 1440px viewport-leveydet

---

## Riippuvuudet

| Riippuvuus | Status | Vaikutus |
|-----------|--------|----------|
| Feature 12 (Auth/Vault UX) | 🚧 E2E-testit kesken | Auth-sivut (welcome, signup, signin, vault) pitää olla valmiit ennen redesignia |
| PRODUCT_VISION.md | ✅ Valmis | Värimaailma, branding, navigaatio, kohderyhmä |
| Figma MCP | ✅ Konfiguroitu | Design-iterointia varten |

---

## Uudet riippuvuudet (npm)

| Paketti | Versio | Syy | Koko |
|---------|--------|-----|------|
| `lucide-react` | ^0.460 | Ikonisetti (tree-shakeable) | ~5 kB (käytetyt ikonit) |
| `react-i18next` | ^15 | i18n framework | ~10 kB |
| `i18next` | ^24 | i18n core | ~15 kB |
| `@fontsource/inter` | ^5 | Inter-fontti (self-hosted) | ~100 kB (latin subset) |

**Bundle impact:** ~30 kB gzip lisäys (ikonit + i18n). Nykyraja 500 kB — pitäisi mahtua.

---

## Riskit / rajoitteet

| Riski | Todennäköisyys | Mitigaatio |
|-------|---------------|------------|
| Design system laajenee liian suureksi | Keskitaso | Aloita minimillä (13 komponenttia), lisää tarpeen mukaan |
| i18n-avaimia paljon (~200) | Matala | Käännöstiedostot voivat olla aluksi EN-only, FI lisätään vaiheittain |
| Vanhat URL:t rikkoutuvat | Matala | Redirect-reitti jokaiselle vanhalle polulle |
| Bundle size ylittää 500 kB | Matala | Tree-shaking (lucide), code splitting (lazy), fontti subset |
| Logo/branding vaatii graafista suunnittelua | Keskitaso | Käytetään Figma MCP:tä + yksinkertainen shield-ikoni alkuun |
| Sivujen redesign rikkoo olemassa olevan toiminnallisuuden | Keskitaso | Vaiheittainen migraatio, E2E-testit jokaisen vaiheen jälkeen |

---

## Ratkaisee bugit/issueita

| ID | Kuvaus | Miten |
|----|--------|-------|
| KP-UI-003 | Imports-sivu sekamelska | Transactions/Import tab + provider grid |
| KP-UI-004 | Token ikonit puuttuvat | TokenIcon-komponentti |
| KP-BRAND-001 | Logo + värimaailma epäyhtenäisiä | Design system + branding |
| KP-DATA-001 | Asset mapping UX | Settings/Assets tab + parannettu UX (osittain) |

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] Tiedostot: täytetään toteutuksen jälkeen

### Env-muutokset
- Ei uusia ympäristömuuttujia

### Deploy-ohjeet
- Normaali Cloudflare Pages deploy
- Vanhat URL:t toimivat redirect-reittien ansiosta
- PWA: service worker päivittyy automaattisesti (auto-update)
