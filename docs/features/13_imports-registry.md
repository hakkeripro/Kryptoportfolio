# Feature 13: Imports Plugin Registry

**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-019
**Paketti:** `packages/core` + `apps/web` + `apps/api` + `functions/`
**Prioriteetti:** P1
**Playbook:** `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md`

---

## Tavoite

Nykyinen `ImportsPage.tsx` on 1 000-riviinen monoliitti joka on sidottu suoraan Coinbase-integraatioon. Uusia pörssejä on mahdoton lisätä rikkomatta UI:ta.

Tavoite: **provider registry -arkkitehtuuri** jossa:
- UI rakentuu dynaamisesti rekisteröidyistä provideresta (provider grid)
- Jokainen provider on itsenäinen plugin (connect form + fetch + vault)
- Yhteinen wizard-kuori hoitaa stepperin ja virheenkäsittelyn
- Uuden providerin lisääminen on ennustettava, dokumentoitu prosessi

---

## Vaiheistus

| Vaihe | Sisältö | Laajuus |
|-------|---------|---------|
| **Vaihe 1 (MVP)** | Registry-arkkitehtuuri + Coinbase migrointi + provider grid UI | Tämä sessio |
| **Vaihe 2** | Binance-provider (HMAC API) + MEXC-provider | Seuraava sessio |
| **Vaihe 3** | Bitvavo-provider + Ledger CSV + MetaMask-osoitetuonti | Backlog |

---

## Vaatimukset — Vaihe 1 (MVP)

### Arkkitehtuuri
- [ ] `ProviderDescriptor` -tyyppi `packages/core/src/imports/providerTypes.ts`:ssa
- [ ] `ImportPlugin` -interface web-kerroksessa (`apps/web/src/integrations/importPlugin.ts`)
- [ ] `providerRegistry.ts` — staattinen lista provideresta + niiden plugin-instanssit
- [ ] Jokainen provider rekisteröi: id, nimi, ikoni, authMethod, status, ConnectForm, fetch-funktiot, vault-funktiot

### Provider Grid UI
- [ ] `ImportsPage.tsx` refaktoroitu: näyttää vain provider gridin dynaamisesti rekisteristä
- [ ] Jokainen provider-kortti näyttää: ikoni, nimi, status-badge (connected / available / coming-soon)
- [ ] Klikkaus ei-kytkettyyn provideriin → avaa connect wizard (Sheet-komponentti)
- [ ] Kytketty provider-kortti näyttää "Connected ✓" + Disconnect-nappi

### Connect Wizard (Sheet)
- [ ] Yhteinen `ImportWizard.tsx` -kuori: stepper (Connect → Preview → Done)
- [ ] Provider tarjoaa `ConnectForm`-komponentin (rendered inside wizard)
- [ ] Provider tarjoaa `FetchPanel`-komponentin (fetch controls + autosync status)
- [ ] Wizard hoitaa: loading state, error display, step transitions

### Coinbase migrointi registryyn
- [ ] `coinbasePlugin.ts` — toteuttaa `ImportPlugin`-interfacen
- [ ] Kaikki Coinbase-logiikka siirtyy pluginiin (ei muutoksia coinbaseSync/Vault/Import -tiedostoihin)
- [ ] Vanhan `ImportsPage.tsx` Coinbase-koodi poistetaan
- [ ] `data-testid` -attribuutit säilyvät identtisinä (E2E-testit eivät riko)

### Coming Soon -providerit (placeholder)
- [ ] Binance-kortti gridissä: status `coming-soon`, ei klikkauksia
- [ ] MEXC-kortti gridissä: status `coming-soon`

---

## Vaatimukset — Vaihe 2 (Binance + MEXC)

> Dokumentoitu tässä suunnittelua varten, toteutetaan erikseen.

### Binance-provider
- [ ] Backend proxy: `apps/api/src/routes/imports-binance.ts` + `functions/api/binance.ts`
- [ ] Auth: HMAC-SHA256 (api key + secret)
- [ ] Endpoints: `/sapi/v1/capital/deposit/hisrec`, `/sapi/v1/capital/withdraw/history`, `/api/v3/myTrades`
- [ ] Mapper `packages/core/src/import/binanceV1.ts` → `LedgerEvent[]`
- [ ] Web: `apps/web/src/integrations/binance/` (vault, sync, import, plugin)
- [ ] E2E: `TEST_MODE` fixture + Playwright-testi

### MEXC-provider
- [ ] Samanlainen rakenne kuin Binance (HMAC-SHA256)
- [ ] Endpoints: `/api/v3/myTrades`, deposit/withdraw history

---

## Tekninen suunnitelma — Vaihe 1

### packages/core/src/imports/providerTypes.ts (uusi)

```ts
export type AuthMethod = 'api-key' | 'csv' | 'address' | 'oauth';
export type ProviderStatus = 'connected' | 'available' | 'coming-soon' | 'error';

export interface ProviderDescriptor {
  id: string;               // 'coinbase', 'binance', ...
  name: string;             // 'Coinbase'
  authMethods: AuthMethod[];
  category: 'exchange' | 'wallet' | 'csv';
  docUrl?: string;          // link to setup guide
}
```

> `ProviderDescriptor` pysyy puhtaana (ei React-riippuvuuksia). Ikonit + UI-komponentit ovat web-kerroksessa.

### apps/web/src/integrations/importPlugin.ts (uusi)

```ts
import type { ProviderDescriptor } from '@kp/core';

export interface ImportContext {
  passphrase: string;
  token: string;
  apiBase: string;
}

export interface ImportPlugin {
  descriptor: ProviderDescriptor;
  /** React component: connect form (rendered inside wizard) */
  ConnectForm: React.FC<ConnectFormProps>;
  /** React component: fetch panel (rendered when connected) */
  FetchPanel: React.FC<FetchPanelProps>;
  /** Load vault config (check if connected) */
  isConnected: (passphrase: string) => Promise<boolean>;
  /** Clear vault config on disconnect */
  disconnect: () => Promise<void>;
}

export interface ConnectFormProps {
  ctx: ImportContext;
  onConnected: () => void;
}

export interface FetchPanelProps {
  ctx: ImportContext;
}
```

### apps/web/src/integrations/providerRegistry.ts (uusi)

```ts
import type { ImportPlugin } from './importPlugin';
import { coinbasePlugin } from './coinbase/coinbasePlugin';

export const PROVIDER_REGISTRY: ImportPlugin[] = [
  coinbasePlugin,
  // Vaihe 2:
  // binancePlugin,
  // mexcPlugin,
];

// Coming-soon -placeholderit (ei pluginia, vain descriptori)
import type { ProviderDescriptor } from '@kp/core';
export const COMING_SOON_PROVIDERS: ProviderDescriptor[] = [
  { id: 'binance', name: 'Binance', authMethods: ['api-key'], category: 'exchange' },
  { id: 'mexc', name: 'MEXC', authMethods: ['api-key'], category: 'exchange' },
  { id: 'bitvavo', name: 'Bitvavo', authMethods: ['api-key'], category: 'exchange' },
  { id: 'ledger', name: 'Ledger Live', authMethods: ['csv'], category: 'wallet' },
  { id: 'metamask', name: 'MetaMask', authMethods: ['address'], category: 'wallet' },
];
```

### apps/web/src/integrations/coinbase/coinbasePlugin.ts (uusi)

```ts
// Wrappaa olemassa olevat coinbaseVault/Sync/Import -funktiot ImportPlugin-interfaceen.
// EI muutoksia coinbaseVault.ts, coinbaseSync.ts, coinbaseImport.ts -tiedostoihin.

export const coinbasePlugin: ImportPlugin = {
  descriptor: { id: 'coinbase', name: 'Coinbase', authMethods: ['api-key'], category: 'exchange' },
  ConnectForm: CoinbaseConnectForm,
  FetchPanel: CoinbaseFetchPanel,
  isConnected: async (passphrase) => { ... },
  disconnect: clearCoinbaseIntegration,
};
```

### apps/web/src/components/imports/ (uusi kansio)

| Tiedosto | Vastuu | Max rivit |
|----------|--------|-----------|
| `ProviderGrid.tsx` | Provider grid + coming-soon -kortit | 100 |
| `ProviderCard.tsx` | Yksittäinen provider-kortti + status badge | 80 |
| `ImportWizard.tsx` | Sheet-kuori + stepper (Connect/Preview/Done) | 120 |
| `CoinbaseConnectForm.tsx` | Coinbase credentials + connect-logiikka | 120 |
| `CoinbaseFetchPanel.tsx` | Fetch controls + autosync status + preview + issues | 300 |

> `CoinbaseFetchPanel.tsx` on poikkeus 300-rivin rajaan (monimutkainen issue-resolution UI).
> Jaetaan tarvittaessa `CoinbasePreviewPanel.tsx` + `CoinbaseIssuesPanel.tsx`.

### apps/web/src/pages/ImportsPage.tsx (refaktorointi)

Nykyinen 1 007-riviinen sivu korvataan ~80-rivisellä:
```tsx
export default function ImportsPage() {
  return (
    <motion.div className="space-y-section" {...pageTransition}>
      <PageHeader title="Import Transactions" />
      <ProviderGrid />   {/* Dynaamisesti registrystä */}
    </motion.div>
  );
}
```

### Reititys

Ei uusia reittejä — wizard avautuu `Sheet`-komponenttina `/imports`-sivulla.
Tämä on yksinkertaisempi kuin uudet `/imports/:id` -reitit ja toimii E2E-testeissä paremmin.

---

## UI-suunnitelma

### Provider Grid

```
// IMPORT SOURCES

┌─────────────────────────────────────────┐
│ 🔵 Coinbase          ✓ Connected        │
│ Cryptocurrency Exchange · API Key       │
│                      [Disconnect]       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ 🟡 Binance           Coming Soon        │
│ Cryptocurrency Exchange · API Key       │
└─────────────────────────────────────────┘
┌─────────────────────────────────────────┐
│ 🔵 MEXC              Coming Soon        │
└─────────────────────────────────────────┘
```

- 2-kolumni grid (desktop), 1-kolumni (mobile)
- Status badge: `bg-semantic-success/10 text-semantic-success` (connected), `bg-white/[0.06] text-white/40` (coming-soon)
- Connected-kortti: `border-[#FF8400]/50` oranssi reunus kuten nykyisin
- Klikkaus connected-kortissa → avaa FetchPanel Sheet-na

### Import Wizard (Sheet)

```
┌──────────────────────────────────────────────────┐
│  ← Coinbase Import                           [X]  │
│                                                   │
│  1 Connect  →  2 Preview  →  3 Done               │
│                                                   │
│  [ConnectForm / FetchPanel / DonePanel]            │
└──────────────────────────────────────────────────┘
```

Sheet-koko: `max-w-2xl` (desktop), full-screen (mobile).

---

## Testaus

### Unit testit (vitest)

- [ ] `providerRegistry.test.ts` — registry palauttaa oikeat providerit, jokainen plugin toteuttaa interfacen
- [ ] `coinbasePlugin.test.ts` — `isConnected()` palauttaa false kun vault on tyhjä
- [ ] `importPlugin.types.test.ts` — TypeScript type-check (compile-time vain)

> Coinbase import/sync/vault -yksikkötestit ovat jo olemassa (T-005 jäljiltä). Ei tarvita uusia.

### E2E testit (playwright)

Vanhat Coinbase-E2E-testit on kirjoitettu `data-testid` -attribuutteihin jotka **säilyvät identtisinä** refaktoroinnissa:

| Testid | Sijainti refaktoroinnin jälkeen |
|--------|--------------------------------|
| `btn-coinbase-connect` | `CoinbaseConnectForm.tsx` |
| `btn-coinbase-disconnect` | `ProviderCard.tsx` |
| `btn-import-run` | `CoinbaseFetchPanel.tsx` |
| `btn-import-run-all` | `CoinbaseFetchPanel.tsx` |
| `btn-import-commit` | `CoinbaseFetchPanel.tsx` (PreviewPanel) |
| `panel-import-preview` | `CoinbaseFetchPanel.tsx` |
| `badge-coinbase-connected` | `ProviderCard.tsx` |
| `form-coinbase-keyname` | `CoinbaseConnectForm.tsx` |
| `form-coinbase-privatekey` | `CoinbaseConnectForm.tsx` |

- [ ] Olemassa olevat Coinbase E2E-testit läpäisevät muuttumattomina refaktoroinnin jälkeen
- [ ] Uusi E2E: `imports-provider-grid.spec.ts` — provider grid näyttää Coinbase + coming-soon kortit

---

## Riippuvuudet

- T-002 ✅ (API-hajotus)
- T-004 ✅ (duplikaation poisto)
- Feature 22 ✅ (design system — Sheet-komponentti käytettävissä)
- Feature 23 ✅ (shadcn/ui — käytetään komponentteja)

---

## Riskit / rajoitteet

| Riski | Todennäköisyys | Lieventäminen |
|-------|---------------|--------------|
| E2E-testit hajoavat `data-testid` -muutoksista | Matala | Säilytetään kaikki nykyiset testid:t identtisinä |
| `ImportsPage.tsx` refaktorointi rikkoo autosync-logiikan | Keskitaso | Autosync-event dispatch (`kp_coinbase_autosync_run_now`) säilyy CoinbaseFetchPanel:issa |
| Sheet ei toimi E2E:ssä (visibility) | Matala | Sheet renderöidään portaaliin, Playwright odottaa `visible` statusta |
| Plugin interface liian tiukka uusille providerereille | Matala | Interface on tarkoituksella minimaalinen; laajennettavissa |

---

## Tiedostomuutokset (Vaihe 1)

### Uudet tiedostot
- `packages/core/src/imports/providerTypes.ts`
- `packages/core/src/imports/index.ts` (re-export)
- `apps/web/src/integrations/importPlugin.ts`
- `apps/web/src/integrations/providerRegistry.ts`
- `apps/web/src/integrations/coinbase/coinbasePlugin.ts`
- `apps/web/src/components/imports/ProviderGrid.tsx`
- `apps/web/src/components/imports/ProviderCard.tsx`
- `apps/web/src/components/imports/ImportWizard.tsx`
- `apps/web/src/components/imports/CoinbaseConnectForm.tsx`
- `apps/web/src/components/imports/CoinbaseFetchPanel.tsx`

### Muokatut tiedostot
- `apps/web/src/pages/ImportsPage.tsx` (refaktorointi: 1007r → ~80r)
- `packages/core/src/index.ts` (lisää imports-exportit)

### Muuttumattomat tiedostot (ei koske)
- `apps/web/src/integrations/coinbase/coinbaseVault.ts`
- `apps/web/src/integrations/coinbase/coinbaseSync.ts`
- `apps/web/src/integrations/coinbase/coinbaseApi.ts`
- `apps/web/src/integrations/coinbase/coinbaseImport.ts`

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/core/src/imports/providerTypes.ts` — ProviderDescriptor, AuthMethod-tyypit
- [ ] `apps/web/src/integrations/importPlugin.ts` — ImportPlugin interface
- [ ] `apps/web/src/integrations/providerRegistry.ts` — registry + coming-soon lista
- [ ] `apps/web/src/integrations/coinbase/coinbasePlugin.ts` — Coinbase plugin
- [ ] `apps/web/src/components/imports/` — ProviderGrid, ProviderCard, ImportWizard, CoinbaseConnectForm, CoinbaseFetchPanel
- [ ] `apps/web/src/pages/ImportsPage.tsx` — refaktoroitu käyttämään ProviderGrid

### Testitulos
- [ ] `pnpm test` läpäisee (unit + coverage)
- [ ] `pnpm test:e2e` läpäisee (kaikki olemassa olevat Coinbase-testit)

### Env-muutokset
Ei muutoksia.

### Deploy-ohjeet
Ei backend-muutoksia Vaiheessa 1. Tavallinen `pnpm build` + Cloudflare Pages deploy.
