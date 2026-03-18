# PrivateLedger — Product Vision

**Created:** 2026-03-14
**Status:** APPROVED

---

## One-liner

**"The only crypto portfolio tracker that never sees your data."**

---

## What is PrivateLedger?

PrivateLedger is a privacy-first crypto portfolio tracker and tax reporting tool. All user data is encrypted locally before it ever leaves the device — the server stores only ciphertext. Zero-knowledge architecture means not even the PrivateLedger team can access your portfolio, transactions, or tax reports.

Free portfolio tracking. Paid tax exports. Your data stays yours.

---

## Target audience

**Primary:** Privacy-conscious crypto investors (international)
- People who distrust centralized portfolio trackers with their financial data
- Security-minded individuals (already use password managers, VPNs, E2E messaging)
- HODLers and moderate traders (not HFT/day-traders)

**Secondary:** Crypto investors who need tax reporting
- Annual tax filing is a concrete, recurring "job to be done"
- Willingness to pay for a tool that solves this correctly

**Not targeting (anti-goals):**
- Day traders who need millisecond data feeds
- DeFi power users (on-chain analytics, yield farming dashboards)
- Institutional/enterprise portfolio management

---

## Jobs to be done (equal priority)

### 1. Portfolio tracking (daily engagement)
> "How much do I have, how is it performing, and do I need to act?"

- Total portfolio value in base currency
- Asset allocation breakdown with token icons
- P&L tracking (realized + unrealized)
- Price alerts (threshold, percentage change)
- Multi-exchange aggregated view

### 2. Tax reporting (annual conversion to revenue)
> "Generate my crypto tax report without uploading my data to a third party."

- Capital gains/losses per tax year
- Income events (staking rewards, airdrops)
- Year-end holdings summary
- Exportable tax report (PDF/CSV)
- First supported jurisdiction: Finland (hankintameno-olettama option)
- Designed to scale to additional countries

---

## Unique selling proposition (USP)

### Zero-knowledge privacy

**What it means:**
- All data encrypted on-device with user's Vault Passphrase
- Server stores only encrypted blobs (ciphertext envelopes)
- No analytics, no tracking, no data mining
- Even PrivateLedger cannot see your portfolio

**Why it matters:**
- No other crypto portfolio tracker offers true zero-knowledge
- Koinly, CoinTracker, CoinStats, Delta — all require you to trust them with your financial data
- Post-breach world: users increasingly want control over sensitive data

**How we communicate it:**
- Not "we don't sell your data" (every company says this)
- Instead: "We CAN'T see your data. It's encrypted before it leaves your device."
- Technical proof: open architecture, auditable encryption

---

## Pricing model

### Freemium + tax export

| Tier | Price | Includes |
|------|-------|----------|
| **Free** | 0 | Portfolio tracking, unlimited transactions, alerts, multi-exchange import, E2E sync |
| **Tax Report** | ~29-49 EUR/year | Tax report export (PDF/CSV), per tax year. Finland first, more countries later. |

**Why this model:**
- Free tier is generous → builds trust and user base
- Tax report is the natural conversion point (concrete annual need)
- Lower friction than monthly subscription for privacy-focused audience
- Competitive: Koinly charges 49-279 EUR/year, CoinTracker 59-199 USD/year

**Future premium options (v2+):**
- Server-side alerts (limited in free)
- Priority exchange support
- Strategy/rebalance tools
- Multi-year tax bundles

---

## Internationalization (i18n)

### From day one: EN + FI

| Aspect | Approach |
|--------|----------|
| **UI language** | English (default) + Finnish. Language switcher in settings. |
| **i18n framework** | react-i18next (or similar). All user-facing strings externalized. |
| **Tax jurisdictions** | Finland first. Architecture supports adding countries (tax rules as plugins). |
| **Currency** | User-selectable base currency (EUR default, USD, GBP, etc.) |
| **Date/number formats** | Locale-aware formatting |

**Scaling plan:** Add languages as user demand grows (DE, ES, FR likely next based on crypto adoption).

---

## Visual identity

### Dark + premium ("Obsidian")

**Inspiration:** 1Password, Linear, Raycast — tools that feel safe, fast, and premium.

**Principles:**
- Dark background (near-black, not pure #000)
- Subtle gradients and glass effects for depth
- Accent color: emerald/teal (trust + crypto association)
- High contrast text for readability
- Token icons everywhere (CoinGecko + fallback letter avatars)
- Minimal chrome, generous whitespace
- Typography: clean sans-serif (Inter or similar)

**Brand elements:**
- Logo: vault/shield motif + "PrivateLedger" wordmark
- PWA icon: recognizable at small sizes
- Brand gradient: dark-to-emerald (subtle)

---

## Design process

### Figma first, then code

1. **Figma MCP** for design iteration with AI assistance
2. Design system in Figma: colors, typography, spacing, components
3. Key screens: Welcome, Dashboard, Portfolio, Tax Report, Settings
4. Mobile-first responsive (PWA must feel native)
5. Export to code: shadcn/ui or custom components based on Figma designs

---

## Platform

| Aspect | v1 | Future |
|--------|-----|--------|
| **Web** | React + Vite PWA (mobile-first responsive) | — |
| **Mobile** | PWA (installable, offline-capable) | Native app (Expo/React Native) |
| **Backend** | Cloudflare Pages Functions + Neon Postgres | Scale as needed |
| **Sync** | E2E encrypted envelopes | Multi-device seamless |

---

## Navigation (simplified)

Current: 17 pages → Target: 5-6 primary views

| Primary nav | Contains |
|-------------|----------|
| **Home** | Dashboard (portfolio overview, charts, alerts, quick actions) |
| **Portfolio** | Holdings, positions, token details |
| **Transactions** | Ledger, imports, exchange connections |
| **Taxes** | Tax reports by year, export, jurisdiction settings |
| **Settings** | Account, security (passkeys), preferences, language, billing |

Secondary (within pages): Alerts config, asset mapping, accounts, strategy.

---

## Competitive landscape

| Competitor | Privacy | Tax | Price | PrivateLedger advantage |
|-----------|---------|-----|-------|---------------------|
| **Koinly** | No (cloud data) | Yes (many countries) | 49-279 EUR/yr | Zero-knowledge. Koinly sees everything. |
| **CoinTracker** | No (cloud data) | Yes | 59-199 USD/yr | Zero-knowledge. Lower price. |
| **Delta** | Partial (optional) | Limited | Free/Premium | True E2E encryption, tax reports |
| **CoinStats** | No | Limited | Free/Premium | Zero-knowledge |
| **Excel/manual** | Yes (local) | Manual | Free | Automated imports, calculations, alerts |

**Key differentiator:** PrivateLedger is the ONLY tool that combines automated portfolio tracking + tax reporting with true zero-knowledge encryption.

---

## Anti-goals (what PrivateLedger is NOT)

- **Not a trading platform** — no order execution, no trading bot (maybe v3+)
- **Not a DeFi dashboard** — no on-chain analytics, no yield farming
- **Not a social platform** — no sharing, no leaderboards, no public portfolios
- **Not a news/research tool** — no market analysis, no recommendations
- **Not an accounting tool** — tax reports are summaries, not full bookkeeping

---

## Success metrics (v1 launch)

| Metric | Target |
|--------|--------|
| Registered users (3 months) | 500+ |
| Free → Tax Report conversion | 5-10% |
| App Store / review score | 4.5+ |
| Tax report accuracy (user-reported) | 95%+ |
| Zero security incidents | 0 |

---

## Roadmap summary

```
NOW:     Feature 12 finish (Auth/Vault UX)
NEXT:    PRODUCT_VISION.md ✅ (this document)
         Feature 22: UI/UX Redesign (Figma → code, design system, i18n)
         Feature 13: Imports Registry (multi-exchange)
         Tax engine: FI hankintameno-olettama + export
         Feature 14: Billing (Stripe, freemium)
LATER:   More countries/jurisdictions
         Native mobile app
         Strategy tools
         Additional languages
```
