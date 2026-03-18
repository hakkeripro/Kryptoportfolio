# Feature 14: Billing + Feature Gating

**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-020
**Paketti:** `packages/core` + `packages/platform-web` + `functions/` + `apps/web`
**Prioriteetti:** P1
**Edellyttää:** Feature 13 (Imports Registry) toteutettu

---

## Tavoite

Lisää freemium-maksumuuri VaultFolioon. **Vain verolaskenta ja veroraportit** ovat premium-ominaisuuksia — kaikki muu (portfolio tracking, alerts, imports, E2E sync) pysyy ilmaisessa tierissä.

MVP-scope: plan-malli + gating-arkkitehtuuri + Upgrade UI. **Ei oikeaa Stripe-maksua** — checkout-flow lisätään myöhemmin erikseen.

### Hinnoittelumalli

| Tier | Hinta | Sisältö |
|------|-------|---------|
| **Free** | 0 | Portfolio tracking, unlimited transactions, alerts, multi-exchange import, E2E sync |
| **Tax** | ~29–49 EUR/vuosi | Verolaskenta (realized gains, income events), tax report export (PDF/CSV), FI hankintameno-olettama |

---

## Vaatimukset

### Funktionaaliset

- [ ] `Plan`-tyyppi: `"free" | "tax"`, voimassaoloaika (`planExpiresAt`)
- [ ] `useFeatureGate(feature)` -hook: palauttaa `{ allowed: boolean, reason: 'plan' | 'ok' }`
- [ ] Gated features: `tax-report-view`, `tax-export-pdf`, `tax-export-csv`
- [ ] Tax-sivulla gate: free-käyttäjä näkee summary-preview, mutta export-napit ja yksityiskohdat blokattu
- [ ] Upgrade Modal: näyttää hinnoittelun + "Coming soon" / waitlist-CTA (ei oikeaa checkoutia)
- [ ] Account/Settings-sivu: näyttää nykyisen planin + upgrade-linkki
- [ ] Backend: plan tallennetaan `users`-tauluun (`plan`, `plan_expires_at`)
- [ ] JWT-token sisältää plan-claimin (`plan: "free" | "tax"`)
- [ ] API tarkistaa plan server-puolella ennen tax-export-endpointtia

### Non-funktionaaliset

- [ ] Plan-tieto ei ole sensitiivistä → ei salata, selkotekstinä DB:ssä (zero-knowledge ei koske tätä)
- [ ] Offline-only -käyttäjillä plan = `"free"` aina (ei serveriä → ei billingiä)
- [ ] Gating-logiikka on **yksi paikka** (`useFeatureGate`) — ei hajautettuja tarkistuksia ympäri koodia
- [ ] Upgrade Modal on **ei-tunkeileva**: ei blokkaa käyttöä, näytetään vain gated-toiminnon kohdalla

---

## Tekninen suunnitelma

### Domain (`packages/core`)

**Uusi tiedosto:** `packages/core/src/billing/planTypes.ts`

```typescript
export type Plan = 'free' | 'tax';

export interface PlanInfo {
  plan: Plan;
  planExpiresAt: string | null; // ISO 8601, null = ei voimassaoloa
}

export type GatedFeature =
  | 'tax-report-view'
  | 'tax-export-pdf'
  | 'tax-export-csv';

export function isFeatureAllowed(plan: Plan, feature: GatedFeature): boolean;
```

`isFeatureAllowed` on puhdas funktio — testattava ilman Reactia.

**Gating-säännöt:**

| Feature | Free | Tax |
|---------|------|-----|
| `tax-report-view` | Preview (summary) | Täysi näkymä |
| `tax-export-pdf` | ❌ | ✅ |
| `tax-export-csv` | ❌ | ✅ |

---

### Platform (`packages/platform-web`)

**Muutos:** `packages/platform-web/src/db/webDb.ts`

- Lisää `planCache`-taulu (Dexie): `{ plan: Plan, planExpiresAt: string | null, syncedAt: string }`
- Käytetään offline-välimuistina: plan haetaan loginissa, tallennetaan paikallisesti
- Dexie versio-bump v3 → v4 + migraatio

---

### API (`apps/api` + `functions/`)

**DB-migraatio (hosted, Neon):**

```sql
ALTER TABLE users ADD COLUMN plan TEXT NOT NULL DEFAULT 'free';
ALTER TABLE users ADD COLUMN plan_expires_at TIMESTAMPTZ;
```

**Uudet endpointit:**

| Metodi | Polku | Kuvaus |
|--------|-------|--------|
| `GET` | `/v1/billing/plan` | Palauttaa käyttäjän nykyisen planin |
| `POST` | `/v1/billing/activate` | Aktivoi plan (admin/manual, ei Stripe vielä) |

**JWT-muutos:** Lisää `plan` claim tokeniin loginissa + refresh:issä.

**Tax export -endpoint (tuleva, Feature 05 laajennus):**
- `GET /v1/tax/export?year=2024&format=pdf` — vaatii `plan === 'tax'`, muuten 403

**API-tarkistus (middleware):**

```typescript
// functions/_lib/requirePlan.ts
export function requirePlan(requiredPlan: Plan): MiddlewareFn;
```

---

### Web (`apps/web`)

**Uusi hook:** `apps/web/src/hooks/useFeatureGate.ts`

```typescript
export function useFeatureGate(feature: GatedFeature): {
  allowed: boolean;
  reason: 'ok' | 'plan' | 'offline';
  openUpgrade: () => void;
}
```

- Lukee planin `useAuthStore` / `planCache`
- `openUpgrade()` avaa UpgradeModal

**Uusi komponentti:** `apps/web/src/components/billing/UpgradeModal.tsx`

```
┌─────────────────────────────────────────────────┐
│  // TAX_REPORT                                  │
│                                                 │
│  Veroraportti — Premium                         │
│                                                 │
│  ┌──────────────────────────────────────────┐   │
│  │  Tax Plan   ~29–49 EUR / vuosi           │   │
│  │  ✓ Verolaskenta (FIFO/LIFO/HIFO/AVG)   │   │
│  │  ✓ PDF + CSV export                     │   │
│  │  ✓ FI hankintameno-olettama             │   │
│  │  ✓ Multi-year history                   │   │
│  └──────────────────────────────────────────┘   │
│                                                 │
│  [  Ilmoittaudu odotuslistalle  ]  [Sulje]      │
│                                                 │
│  Julkaisemme täyden maksuominaisuuden           │
│  pian. Jätä sähköpostisi niin ilmoitamme.       │
└─────────────────────────────────────────────────┘
```

**Muokattu sivu:** `apps/web/src/pages/TaxPage.tsx`

- Free-käyttäjä: näkee year selector + summary row (total gains/losses, income)
- Klikki "Export PDF" / "Export CSV" → `openUpgrade()`
- Yksityiskohtainen transaction-taulukko piilotettu `GateWall`-komponentilla

**Uusi komponentti:** `apps/web/src/components/billing/GateWall.tsx`

```typescript
// Wrap gated content
<GateWall feature="tax-report-view" preview={<TaxSummary />}>
  <TaxFullReport />
</GateWall>
```

**Store-muutos:** `apps/web/src/store/useAuthStore.ts`

- Lisää `plan: Plan` + `planExpiresAt: string | null`
- `fetchPlan()` action: GET `/v1/billing/plan` → päivittää storen + planCache

**Account-sivu** (`AccountPage.tsx`):

- "Billing" -osio: nykyinen plan + voimassaoloaika
- Upgrade-linkki free-käyttäjille

---

## UI-suunnitelma

### Tax-sivu: free vs. premium

**Free-käyttäjä:**
```
// TAX_REPORT                          [2024 ▼]

 Total Realized Gains    +2 340,00 €
 Total Income             +180,00 €
 Disposals                        12

 ┌─ Premium required ──────────────────────┐
 │  Yksityiskohtainen raportti + export    │
 │  vaatii Tax-tilauksen.                  │
 │  [  Katso hinnoittelu  ]               │
 └─────────────────────────────────────────┘

 [Export PDF ●]  [Export CSV ●]
       ↑ nämä avaavat UpgradeModalin
```

**Premium-käyttäjä:**
- Täysi transaction-taulukko näkyvissä
- Export-napit toimivat normaalisti

### Account-sivu: billing-osio

```
// BILLING

 Plan          Free
 Expires       —

 [  Päivitä Tax-tilaukseen  ]
```

---

## Testaus

### Unit-testit (`packages/core`)

- `isFeatureAllowed('free', 'tax-export-pdf')` → `false`
- `isFeatureAllowed('tax', 'tax-export-pdf')` → `true`
- `isFeatureAllowed('free', 'tax-report-view')` → preview allowed
- Expiry: `plan_expires_at` mennyt → treated as `free`

### Unit-testit (`apps/web`)

- `useFeatureGate('tax-export-pdf')` kun plan=free → `{ allowed: false, reason: 'plan' }`
- `useFeatureGate('tax-export-pdf')` kun plan=tax → `{ allowed: true, reason: 'ok' }`
- `GateWall` renderöi preview kun free, children kun premium

### E2E-testit (`apps/web/e2e`)

- `billing-gate.spec.ts`:
  - Free-käyttäjä: Tax-sivu näyttää summary, ei yksityiskohtia
  - Free-käyttäjä: "Export PDF" klikkaus → UpgradeModal avautuu
  - Free-käyttäjä: `/v1/tax/export` → 403
  - (Mock) Premium-käyttäjä: Tax-sivu näyttää täyden raportin, export toimii

---

## Riippuvuudet

- **Feature 13** (Imports Registry) — toteutettava ensin järjestyksessä
- **KP-TAX-001** (FI hankintameno-olettama + PDF/CSV export) — tax export ei ole vielä toiminnallinen, mutta gating voidaan toteuttaa ensin stub-tilassa. Export-toiminto lisätään kun KP-TAX-001 korjattu.
- **Feature 12** (Auth/Vault UX) ✅ — JWT ja auth-flow valmis, plan claim lisätään päälle

---

## Riskit / rajoitteet

| Riski | Todennäköisyys | Hallinta |
|-------|---------------|----------|
| "Premium creep" — gating leviää epäselvänä ympäri koodia | Korkea | Yksi `useFeatureGate` hook, ei manuaalisia plan-tarkistuksia |
| Käyttäjä manipuloi clientin plan-tilaa | Matala | API tarkistaa plan JWT:stä ennen export-endpointtia |
| Tax export ei valmis feature-14 julkaisussa | Korkea | UpgradeModal + gating valmiina, export = stub. Ei blokoi. |
| JWT plan-claim vanhenee (käyttäjä päivittää planin) | Matala (stub-vaiheessa) | `fetchPlan()` + token refresh loginissa. Stripe-vaiheessa webhook. |

---

## Toteutuksen vaiheet

### Vaihe 1 (MVP — tämä feature)

1. `planTypes.ts` + `isFeatureAllowed` (core)
2. DB-migraatio: `users.plan` + `users.plan_expires_at`
3. JWT: plan claim loginiin + refreshiin
4. `GET /v1/billing/plan` -endpoint
5. `planCache` Dexieen (platform-web)
6. `useAuthStore`: plan-kenttä + `fetchPlan()`
7. `useFeatureGate` hook
8. `UpgradeModal` + `GateWall` komponentit
9. `TaxPage` gating: summary free, full premium
10. `AccountPage`: billing-osio
11. Testit

### Vaihe 2 (myöhemmin, erillinen feature)

- Stripe Checkout session
- Webhook: plan-päivitys maksusuorituksen jälkeen
- Receipt email
- Subscription management (cancel, renew)

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/core/src/billing/planTypes.ts`
- [ ] `packages/platform-web/src/db/webDb.ts` (planCache, v4)
- [ ] `functions/_lib/db.ts` (HOSTED_SCHEMA_SQL: plan-kentät)
- [ ] `scripts/migrations/YYYY-MM-DD-add-user-plan.sql`
- [ ] `functions/api/auth.ts` (JWT plan claim)
- [ ] `functions/api/billing.ts` (uusi route-tiedosto)
- [ ] `apps/api/src/routes/billing.ts` (Fastify dev-API)
- [ ] `apps/web/src/store/useAuthStore.ts`
- [ ] `apps/web/src/hooks/useFeatureGate.ts`
- [ ] `apps/web/src/components/billing/UpgradeModal.tsx`
- [ ] `apps/web/src/components/billing/GateWall.tsx`
- [ ] `apps/web/src/pages/TaxPage.tsx`
- [ ] `apps/web/src/pages/AccountPage.tsx`

### Env-muutokset

Vaihe 1: ei uusia env-muuttujia.
Vaihe 2 (Stripe): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_ID_TAX`.

### Deploy-ohjeet

1. Aja DB-migraatio: `DATABASE_URL="..." pnpm migrate:run`
2. Deploy Cloudflare Pages (JWT-muutos + billing-endpoint)
3. Tarkista: `GET /v1/billing/plan` palauttaa `{ plan: "free" }` uusille käyttäjille
