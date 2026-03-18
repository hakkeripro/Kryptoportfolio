# Feature 25: Finnish Tax Parity

**Status:** ❌ EI TOTEUTETTU
**ADR:** ADR-013 (Tax Engine — laajennus)
**Paketti:** `packages/core`, `apps/web`
**Prioriteetti:** P1 — kriittinen kilpailupariteetti kryptoverotus.fi:n kanssa

---

## Tavoite

Tee VaultFolion verolaskennasta **Suomen verolainsäädännön mukainen**. Tällä hetkellä puuttuu kolme kriittistä ominaisuutta jotka kryptoverotus.fi tarjoaa:

1. **HMO-laskuri** — hankintameno-olettama (20%/40%) automaattisella omistusajan laskennalla
2. **Lompakkokohtainen FIFO** — Verohallinnon ohjeen mukainen erillinen lot-seuranta per lompakko
3. **Transfer detection** — omat siirrot pörssien välillä tunnistetaan eikä merkitä verotettaviksi

Lisäksi feature tuo:
- **OmaVero copy-paste -opas** (Pro) — konkreettiset syöttöarvot OmaVero-lomakkeeseen
- **Tax issue -filter** TransactionsPage:lla — nopea pääsy ongelmallisiin tapahtumiin
- **Blur-gate** — verolaskennan numerot piilossa Free-käyttäjiltä (konversiopiste)

---

## Vaatimukset

### Vaihe 1: HMO, OmaVero, blur-gate, issue-filter (MVP)

- [ ] **HMO-1:** HMO-toggle TaxPage:lla Finland-profiililla. Oletuksena OFF.
- [ ] **HMO-2:** HMO laskee automaattisesti omistusajan per disposal (vanhimmasta lotsmatched-rivistä).
- [ ] **HMO-3:** HMO sovelletaan vain kun se on edullisempi kuin todellinen hankintameno.
- [ ] **HMO-4:** `< 10 vuotta` → 20% myyntihinnasta, `≥ 10 vuotta` → 40% myyntihinnasta.
- [ ] **HMO-5:** Report näyttää HMO-säästön: `"HMO reduced taxable gain by X EUR"`.
- [ ] **HMO-6:** HMO-laskuri on Pro-gated. Free-käyttäjä näkee "Estimated tax saving: [🔒 locked]".
- [ ] **BLUR-1:** Verolaskennan KPI-kortit ja disposal-taulukko ovat blurrattuja Free-käyttäjille.
- [ ] **BLUR-2:** Blur-efekti on selkeä (backdrop-filter + overlay), ei vain piilotus.
- [ ] **BLUR-3:** "Unlock — Pro" CTA blurratun alueen päällä.
- [ ] **OMAVERO-1:** OmaVero-opas on Pro-gated. Free-käyttäjälle lukko-ikoni + upgrade-viesti.
- [ ] **OMAVERO-2:** Opas näyttää Finland-profiililla valmiit syöttöarvot OmaVero-lomakkeeseen: Myyntihinnat, Hankintahinnat, Kulut — kukin [📋 Copy]-painikkeella.
- [ ] **OMAVERO-3:** Opas näkyy vain kun `taxProfile === 'FINLAND'` ja raportti on generoitu.
- [ ] **FILTER-1:** TransactionsPage:lla uusi filter-napisto: [All] [Issues] [Missing value] [Unmatched transfer].
- [ ] **FILTER-2:** "Issues" filtteri näyttää tapahtumat joilla `missingFmv=true` tai `isUnmatchedTransfer=true`.
- [ ] **FILTER-3:** Issue-merkinnät lasketaan ainoastaan ledger-datasta (ei DB-muutoksia).

### Vaihe 2: Wallet-level FIFO + Transfer detection

- [ ] **WALLET-1:** `createLotEngine` tukee `walletLevelFifo: boolean` -optiota.
- [ ] **WALLET-2:** Kun `walletLevelFifo=true`, lot-bucketit ovat `accountId:assetId` (ei vain `assetId`).
- [ ] **WALLET-3:** Finland-profiilin generointi käyttää wallet-level FIFO:a automaattisesti.
- [ ] **WALLET-4:** Tapahtumat ilman `accountId`:tä menevät `_global`-bucketiin.
- [ ] **TRANSFER-1:** `detectSelfTransfers()` tunnistaa parit: sama asset, määrä ±0.5%, aikaikkunassa ≤2h, eri account.
- [ ] **TRANSFER-2:** Tunnistettu "self-transfer" pari: kopioi cost basis outgoing-lotilta incoming-lotille.
- [ ] **TRANSFER-3:** Tunnistamaton outgoing TRANSFER → `isUnmatchedTransfer`-varoitus raportissa.
- [ ] **TRANSFER-4:** TaxPage: Data Quality Check -paneeli ennen laskentaa (transaktioita, missing FMV, unmatched transfers).
- [ ] **TRANSFER-5:** [Review →] -linkki vie TransactionsPage:lle esisuodatettuna.

---

## Tekninen suunnitelma

### Vaihe 1

#### packages/core

**Uusi tiedosto: `src/tax/hmoCalculator.ts`**

```typescript
export type HmoRate = 0.20 | 0.40;

export type HmoAdjustment = {
  disposalEventId: string;
  holdingYears: number;
  hmoRate: HmoRate;
  hmoCostBasisBase: string;      // proceeds * hmoRate
  actualCostBasisBase: string;   // original cost basis
  savedBase: string;             // actualCost - hmoCost (positiivinen = säästö)
  applied: boolean;              // true jos HMO on edullisempi
};

export type HmoResult = {
  adjustments: HmoAdjustment[];
  totalSavingBase: string;       // summa kaikista applied=true säästöistä
};

export function applyHmo(
  disposals: Disposal[],
  hmoEnabled: boolean,
): HmoResult
```

- Laskee omistusajan: `holdingYears = (disposedAt - earliestAcquiredAt) / 365.25`
- `earliestAcquiredAt` haetaan `disposal.lotsMatched` -rivien `acquiredAtISO` kentästä
- HMO sovelletaan vain jos `hmoCostBasis < actualCostBasis` (edullisempi käyttäjälle)
- Palauttaa muuttumattoman disposals-listan + erillinen `HmoResult` (ei mutatoi Disposal-skeemaa)

**Muutos: `src/domain/portfolio.ts` — `DisposalLotMatch`**

```typescript
// LISÄTÄÄN optional field:
export const DisposalLotMatch = z.object({
  lotId: z.string().min(1),
  amount: DecimalString,
  costBasisBase: DecimalString,
  acquiredAtISO: IsoString.optional(),  // ← UUSI: tarvitaan HMO-laskentaan
});
```

**Muutos: `src/portfolio/lotEngine.ts` — `pickLots()`**

`takeFromLot()` -sisäfunktiossa lisätään `acquiredAtISO: lot.acquiredAtISO` matched-objektiin.

**Muutos: `src/domain/tax.ts` — `TaxYearReport`**

```typescript
export const TaxYearReport = z.object({
  // ... olemassaolevat kentät ...
  hmoEnabled: z.boolean().optional(),
  hmoTotalSavingBase: DecimalString.optional(),
  hmoAdjustments: z.array(HmoAdjustment).optional(),
});
```

**Muutos: `src/tax/taxEngine.ts` — `generateTaxYearReport()`**

```typescript
export type GenerateTaxReportOptions = {
  lotMethodOverride?: Settings['lotMethodDefault'];
  hmoEnabled?: boolean;  // ← UUSI
};
```

Kun `hmoEnabled=true` ja `taxProfile==='FINLAND'`: kutsutaan `applyHmo()` disposalien jälkeen. Tulokset lisätään raporttiin.

**Ei uusia API-endpointteja, ei DB-migraatioita.** HMO on puhdas laskennallinen kerros.

#### apps/web

**Muutos: `src/pages/TaxPage.tsx`**

1. **HMO-toggle** Finland-profiililla:
   - `[☑ Apply acquisition cost assumption where beneficial (HMO)]`
   - Disabled ja piilotettu jos `taxProfile !== 'FINLAND'`
   - Pro-gated: Free-käyttäjä näkee `"Estimated saving: [🔒 Pro]"`

2. **Blur-gate verotuloksille** (korvaa nykyinen GateWall):
   - KPI-kortit + disposal-taulukko: `BlurOverlay` -komponentti Free-käyttäjille
   - `BlurOverlay`: `filter: blur(8px) + overlay div + UpgradeCTA`
   - Data renderöidään normaalisti taustalla (ei piiloteta DOM:sta — blur on CSS)
   - Tämä on erilainen kuin `GateWall` joka korvaa koko sisällön. Blur näyttää luvut sumeina.

3. **OmaVero-osio** raportin alla (Finland-profiili + raportti generoitu + Pro):
   - Oma `OmaVeroGuide` -komponentti (`src/components/tax/OmaVeroGuide.tsx`)
   - Sisältö alla

**Uusi: `src/components/tax/OmaVeroGuide.tsx`**

```
// OMAVERO GUIDE — Finland Tax Year {year}

Step 1 — OmaVero → "Muut tulot" → "Luovutusvoitot ja -tappiot"

Myyntihinnat yhteensä:   {proceeds} EUR   [📋]
Hankintahinnat yhteensä: {costBasis} EUR  [📋]
  (sis. kulut: {fees} EUR)
Voitto/tappio:           {gain} EUR

Step 2 — Jos käytit HMO:
  Hankintameno-olettama sovellettu {N} myynnissä
  HMO-korjattu hankintameno:  {hmoCostBasis} EUR  [📋]

Step 3 — Virtuaalivaluuttojen arvo vuodenvaihteessa:
  {yearEndHoldings.map(h => h.symbol + ': ' + h.costBasisBase)}
```

Pro-gate: `useFeatureGate('omavero-guide')` — lisätään uusi feature key planTypes.ts:ään.

**Muutos: `src/pages/TransactionsPage.tsx` — issue filter**

Lisätään filter-napit (alle olemassaolevan type-filterin):
- [All] [⚠ Issues] [Missing value] [Unmatched transfer]

`isUnmatchedTransfer(event)`: TRANSFER-tyyppi jolla `amount < 0` eikä ole matchattua vastaavaa (heuristiikka: kaikki negatiiviset TRANSFERit flagataan V1:ssä — V2:ssa transfer detection tekee tämän oikein)

`isMissingValue(event)`: `REWARD/STAKING_REWARD/AIRDROP` joilla ei `fmvTotalBase` eikä `fmvPerUnitBase`.

**Muutos: `src/hooks/useFeatureGate.ts` + `packages/core/src/billing/planTypes.ts`**

Lisätään uudet feature keyt:
- `'hmo-calculator'` — Pro-only
- `'omavero-guide'` — Pro-only

---

### Vaihe 2

#### packages/core

**Uusi tiedosto: `src/tax/transferDetection.ts`**

```typescript
export type SelfTransferMatch = {
  outEventId: string;   // negatiivinen TRANSFER
  inEventId: string;    // positiivinen TRANSFER
  assetId: string;
  amount: string;
  timeDiffSec: number;
  confidence: 'high' | 'medium';  // high: ≤30min, medium: 31min-2h
};

export type TransferDetectionResult = {
  matched: SelfTransferMatch[];
  unmatchedOut: string[];  // eventId[] — negatiiviset ilman paria
  unmatchedIn: string[];   // eventId[] — positiiviset ilman paria (hämmentäviä)
};

export function detectSelfTransfers(
  events: LedgerEvent[],
  options?: { maxTimeDiffHours?: number; dustTolerancePct?: number }
): TransferDetectionResult
```

Algoritmi:
1. Suodata `type === 'TRANSFER'`
2. Ryhmittele `assetId`:n mukaan
3. Per asset: sovita negatiiviset (`amount < 0`) positiivisiin (`amount > 0`)
4. Matching-kriteeri: `abs(outAmt - inAmt) / outAmt < dustTolerance (0.005)` + `|outTime - inTime| < maxTimeDiff (2h)` + `outAccountId !== inAccountId`
5. Greedy matching: lähin ajallinen matchataan ensin

**Muutos: `src/portfolio/lotEngine.ts`**

`createLotEngine(settings, engineOptions?)` — uusi toinen parametri:

```typescript
export type LotEngineOptions = {
  walletLevelFifo?: boolean;
  selfTransferMatches?: SelfTransferMatch[];
};
```

- `walletLevelFifo`: `lotsByWalletAsset: Record<string, Lot[]>` avain on `${accountId ?? '_global'}:${assetId}`
- `selfTransferMatches`: kun käsitellään matched self-transfer -paria, incoming TRANSFER kopioi cost basis outgoing-lotilta (käyttäen FIFO-järjestystä)

**Muutos: `src/tax/taxEngine.ts`**

```typescript
export type GenerateTaxReportOptions = {
  lotMethodOverride?: Settings['lotMethodDefault'];
  hmoEnabled?: boolean;
  enableTransferDetection?: boolean;  // ← UUSI V2
};
```

Kun `taxProfile === 'FINLAND'` ja `enableTransferDetection=true`:
1. Aja `detectSelfTransfers(events)` ensin
2. Siirrä `SelfTransferMatch[]` lot enginelle
3. Lisää `unmatchedTransfers` raportin `warnings[]`:iin

#### apps/web

**Uusi: `src/components/tax/DataQualityCheck.tsx`**

```
// DATA QUALITY CHECK

✅ 1 247 transactions loaded
⚠  23 transactions missing EUR value    [Fix →]
⚠  3 assets unmapped                    [Map →]
⚠  5 unmatched transfers                [Review →]
```

- Näkyy TaxPage:lla ennen laskentaa (tai laskennassa tuotetun raportin warnings-pohjalta)
- [Fix →] ja [Review →] linkit vievät TransactionsPage:lle esisuodatettuna (`?filter=missing-value` jne.)

---

## UI-suunnitelma

### TaxPage — Vaihe 1 muutokset

```
[Tax Report]  [2024 ▼]  [FIFO ▼ (disabled for FI)]  [Finland ▼]  [☑ HMO]  [Generate]  [Export CSV ●]

--- KPI-kortit (blur Free-käyttäjille) ---
[Realized gain  ████ EUR]  [Income  ████ EUR]  [Cost basis  ████ EUR]
             [🔒 Unlock results — Pro]

--- Disposals taulukko (blur) ---
...taulukko sumeana taustalla...
[🔒 Upgrade to Pro to see your tax results]

--- OmaVero Guide (Pro, Finland-profiili) ---
// OMAVERO GUIDE — Tax Year 2024
Step 1 — Luovutusvoitot ja -tappiot
  Myyntihinnat:    48 210,00 €  [📋]
  Hankintahinnat:  31 776,50 €  [📋]
  Kulut:              324,50 €  [📋]
  Voitto:          16 109,50 €  [📋]
[HMO sovellettu 7 myynnissä — säästö 1 240 EUR]
```

### TransactionsPage — issue filter

Lisätään olemassaolevan type-filterin rinnalle (tai alle) issue-filter. Pieni, ei häiritse normaalikäyttöä.

```
Type: [All ▼]          Issues: [All] [⚠ Issues] [Missing value] [Unmatched transfer]
```

### Blur-komponentti vs. GateWall

**Päätös: käytetään `BlurOverlay`:ta kaikkialla TaxPage:lla** — sumuefekti on psykologisesti tehokkaampi kuin `GateWall`. Käyttäjä näkee että lukuja on, mutta ei pysty lukemaan niitä.

| Komponentti | Käyttötapaus |
|---|---|
| `GateWall` | Ei käytetä TaxPage:lla enää. Sopii muihin sivuihin joissa sisältöä ei ole lainkaan. |
| `BlurOverlay` | KPI-kortit + disposal-taulukko + income + holdings — kaikki sumeana Free-käyttäjille |

```tsx
// BlurOverlay.tsx
<div className="relative">
  <div className="filter blur-[6px] pointer-events-none select-none" aria-hidden>
    {children}
  </div>
  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
    <UpgradeCTA feature="tax-results" />
  </div>
</div>
```

---

## Testaus

### Unit-testit (`packages/core`)

**`src/tax/hmoCalculator.test.ts`** — uusi tiedosto

| Testi | Kuvaus |
|---|---|
| HMO 20% alle 10v, edullisempi | `proceeds=1000, costBasis=100` → `hmoCost=200 > costBasis=100` → HMO sovelletaan → `gain=800` |
| HMO 20% alle 10v, ei edullisempi | `proceeds=1000, costBasis=850` → `hmoCost=200 < costBasis=850` → HMO EI sovellu → gain=150 |
| HMO 40% yli 10v | `holdingYears=11` → `hmoRate=0.40` |
| Juuri 10v raja | `holdingYears=10.0` → `hmoRate=0.40` |
| Useita disposaleja — osa sovelletaan, osa ei | Verifikoi `totalSavingBase` oikein |
| Ilman `acquiredAtISO` lotsMatched:ssa | Fallback: `holdingYears=0` → 20% rate |
| `hmoEnabled=false` | Kaikki adjustments `applied=false`, `totalSavingBase='0'` |

**`src/tax/transferDetection.test.ts`** (Vaihe 2)

| Testi | Kuvaus |
|---|---|
| Täydellinen pari | out(-1 BTC, t=0) + in(+1 BTC, t=30min) → matchattu |
| Dust-toleranssi | out(-1.000 BTC) + in(+0.9995 BTC) → matchattu (0.05% < 0.5%) |
| Yli aikaikkunan | out(-1 BTC, t=0) + in(+1 BTC, t=3h) → ei matchattu |
| Sama account | out+in samalla accountId → ei matchattu (ei siirto) |
| Useita kandidaatteja | Lähimpään aikaan matchataan ensin |
| Ei vastinetta | out(-1 BTC) yksin → unmatchedOut |

**`src/portfolio/lotEngine.test.ts`** — lisätestit (Vaihe 2)

| Testi | Kuvaus |
|---|---|
| Wallet-level FIFO: eri bucket eri accountille | BUY Coinbase + BUY Kraken → erilliset lot-bucketit |
| Self-transfer carries cost basis | BUY Coinbase 10 BTC @ €5000 + matched TRANSFER → SELL harware wallet → costBasis = €5000 |
| Unmatched TRANSFER in: 0-cost lot | Ilman matchattua out-TRANSFERia → synthetic 0-cost lot + varoitus |

### E2E-testit (`apps/web`)

**`finnish-tax-hmo.spec.ts`** — Vaihe 1

```
Scenario: HMO-toggle Finland-profiililla
1. Navigate /tax
2. Select Finland profile
3. Assert HMO-toggle visible
4. Assert HMO-toggle hidden for GENERIC profile
5. Generate report
6. Assert OmaVero section visible (Pro-gated behind upgrade prompt for free)
```

**`tax-blur-gate.spec.ts`** — Vaihe 1

```
Scenario: Free user sees blurred results
1. Login as free user (mock plan='free')
2. Navigate /tax, generate report
3. Assert data-testid="blur-overlay" visible
4. Assert data-testid="kpi-total-gains" has class containing 'blur'
```

**`transactions-issue-filter.spec.ts`** — Vaihe 1

```
Scenario: Issue filter on TransactionsPage
1. Navigate /transactions
2. Assert filter buttons visible: [All] [Issues] [Missing value] [Unmatched transfer]
3. Click [Unmatched transfer]
4. Assert only TRANSFER rows with amount < 0 visible
```

---

## Riippuvuudet

- **Feature 14: Billing + Feature Gating** ✅ — `useFeatureGate` valmis
- **Feature 05: Tax Engine** ✅ — `generateTaxYearReport` valmis
- **Feature 04: Lot Engine** ✅ — `replayLedgerToLotsAndDisposals` valmis
- **Feature 24: Settings-sivu + Tax Profile** ❌ — ei kriittinen esiriippuvuus; TaxPage:lla on jo taxProfile-valitsin

---

## Riskit / rajoitteet

### HMO-laskuri

- **Riski:** `acquiredAtISO` puuttuu `DisposalLotMatch`-objekteista nykyisessä datassa. Korjataan lisäämällä se `lotEngine.ts`:n `pickLots()`-funktioon — backward compatible (optional field).
- **Rajoite:** HMO lasketaan vanhimman matched-lotin perusteella. Verohallinto ei anna eksplisiittistä ohjetta monen lot-erän tapaukseen. Vanhin lot = konservatiivinen tulkinta (edullisempi käyttäjälle).
- **Rajoite:** HMO-laskuri on approksimatiivinen verotyökalu, ei virallinen veroilmoitus. Varoitusteksti UI:ssa: *"This is a calculation aid, not tax advice."*

### Wallet-level FIFO

- **Riski:** Olemassaoleva data ei välttämättä sisällä `accountId`-kenttää kaikissa tapahtumissa (erityisesti manuaalisesti lisätyt). Fallback: `_global`-bucket.
- **Riski:** Breaking change lot engine -testeissä jotka odottavat globaalia FIFO:a. Kaikki olemassaolevat testit säilyvät: `walletLevelFifo` oletuksena `false`.
- **Rajoite:** Wallet-level FIFO ilman transfer detection on puolinainen — kustannusperuste "katoaa" siirretyistä lompakoista. Siksi Vaihe 2 toteutetaan kokonaisena, ei puolittain.

### Transfer detection

- **Riski:** False positives — kaksi eri siirtoa samalle assetille eri lompakoiden välillä samaan aikaan. `confidence`-kenttä ohjaa käyttäjää vahvistamaan.
- **Rajoite:** V1:ssä algoritmi on heuristinen. Ei automaattista merkintää — käyttäjä vahvistaa jokaisen matchin. (V2:ssa voi lisätä auto-hyväksynnän high-confidence matcheille.)
- **Rajoite:** Ei tue cross-exchange transfereja jossa aika-ikkunaan on useita tunnin mittaisia viivästyksiä (blockchain confirmation). `maxTimeDiff` on konfiguroitavissa, default 2h.

---

## Toteutussuositus — vaiheistus

```
Vaihe 1 (1 sessio — core + UI):
  packages/core: hmoCalculator.ts, DisposalLotMatch.acquiredAtISO, lotEngine muutos, planTypes uudet keyt
  apps/web: TaxPage (HMO-toggle + blur-gate + OmaVero), TransactionsPage (issue filter)
  Testit: hmoCalculator.test.ts (7 kpl), E2E 2-3 testiä

Vaihe 2 (2 sessiota — lot engine + detection + UI):
  Sessio 2a: transferDetection.ts + lotEngine wallet-level FIFO + testit
  Sessio 2b: DataQualityCheck UI + TransactionPage transfer links + E2E
```

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/core/src/domain/portfolio.ts`: `DisposalLotMatch.acquiredAtISO` optional
- [ ] `packages/core/src/portfolio/lotEngine.ts`: `pickLots()` lisää `acquiredAtISO` matched-riveihin + wallet-level FIFO -option
- [ ] `packages/core/src/tax/hmoCalculator.ts`: uusi tiedosto
- [ ] `packages/core/src/tax/taxEngine.ts`: `hmoEnabled` option, kutsuu `applyHmo()`
- [ ] `packages/core/src/domain/tax.ts`: `TaxYearReport` HMO-kentät
- [ ] `packages/core/src/billing/planTypes.ts`: `'hmo-calculator'`, `'omavero-guide'` feature keyt
- [ ] `packages/core/src/tax/transferDetection.ts`: uusi tiedosto (Vaihe 2)
- [ ] `apps/web/src/pages/TaxPage.tsx`: HMO-toggle + blur-gate + OmaVero-osio
- [ ] `apps/web/src/components/tax/OmaVeroGuide.tsx`: uusi komponentti
- [ ] `apps/web/src/components/ui/BlurOverlay.tsx`: uusi komponentti
- [ ] `apps/web/src/pages/TransactionsPage.tsx`: issue-filter
- [ ] `apps/web/src/components/tax/DataQualityCheck.tsx`: uusi komponentti (Vaihe 2)

### Env-muutokset
Ei uusia ympäristömuuttujia.

### Deploy-ohjeet
Ei DB-migraatioita. Puhdas client-side muutos. Normal deploy riittää.
