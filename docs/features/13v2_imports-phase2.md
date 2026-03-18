# Feature 13 Vaihe 2: Binance + Kraken -providerit

**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-019 (laajennus)
**Paketti:** `packages/core` + `apps/api` + `functions/` + `apps/web`
**Prioriteetti:** P1
**Playbook:** `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md`
**Edeltävä:** Feature 13 Vaihe 1 ✅

---

## Tavoite

Lisätään kaksi täysimittaista providerit plugin-registryyn:

- **Binance** — HMAC-SHA256 API (autosync) + Statement CSV (kertaluonteinen import)
- **Kraken** — HMAC-SHA512 API (autosync)

Samalla uudistetaan `ImportPlugin`-interface capability-based-malliksi, joka tukee
sekä API- että CSV-providereitä saman wizardin kautta.

**Vaihe 2B** (erillinen speksi myöhemmin): Northcrypto CSV + Coinmotion CSV
**Vaihe 3** (erillinen speksi): MetaMask (osoitetuonti) — korkea prioriteetti

---

## Vaiheistus tässä speksissä

| Vaihe | Sisältö |
|-------|---------|
| **A: Arkkitehtuuri** | ImportPlugin capability-redesign + coinbasePlugin-migraatio |
| **B: Binance** | HMAC API + Statement CSV mapper + UI |
| **C: Kraken** | HMAC API + Ledger mapper + UI |
| **D: Coming-soon päivitys** | Lisätään Bybit, Bitstamp, MetaMask, Northcrypto, Coinmotion jne. |

---

## A: ImportPlugin capability-based redesign

### Ongelma

Nykyinen `ImportPlugin` olettaa aina API-avaimen:
- `ConnectForm` — ei ole olemassa CSV-providerille
- `isConnected / disconnect` — ei tarkoita mitään tiedostouploadille

### Ratkaisu: capability-malli

```ts
// apps/web/src/integrations/importPlugin.ts

export interface ApiCapability {
  ConnectForm: React.FC<ConnectFormProps>;
  FetchPanel:  React.FC<FetchPanelProps>;
  isConnected: (passphrase: string) => Promise<boolean>;
  disconnect:  () => Promise<void>;
}

export interface CsvCapability {
  UploadForm: React.FC<CsvUploadFormProps>;
  // Ei connection-stateta — käyttäjä uploadaa tiedoston, wizard hoitaa
}

export interface CsvUploadFormProps {
  ctx: ImportContext;
}

export interface ImportPlugin {
  descriptor: ProviderDescriptor;
  api?: ApiCapability;   // API-autosync
  csv?: CsvCapability;   // CSV kertaluonteinen import
  // Ainakin yksi pakollinen
}
```

### Wizard-käyttäytyminen

| Capability | Wizard-flow |
|-----------|-------------|
| vain `api` | Connect → Preview → Done |
| vain `csv` | Upload → Preview → Done |
| `api + csv` | **Valintanäyttö** → API-polku tai CSV-polku |

Binancella on molemmat. Valintanäyttö näytetään ennen wizard-stepperiä.

### Coinbase-migraatio uuteen interfaceen

`coinbasePlugin.ts` muuttuu minimaalisesti:

```ts
// Ennen
export const coinbasePlugin: ImportPlugin = {
  descriptor, ConnectForm, FetchPanel, isConnected, disconnect,
};

// Jälkeen
export const coinbasePlugin: ImportPlugin = {
  descriptor,
  api: { ConnectForm, FetchPanel, isConnected, disconnect },
};
```

`ImportWizard.tsx` ja `ProviderCard.tsx` päivitetään lukemaan `plugin.api.*` ja `plugin.csv.*`.

---

## B: Binance-provider

### B.1 Auth: HMAC-SHA256

Binance käyttää `X-MBX-APIKEY` -headeria + `signature`-parametria (HMAC-SHA256 querystring + body, secret-avaimella).

```
API Key:    tallennetaan vaultiin vault_binance_v1 META_KEY:llä
API Secret: tallennetaan vaultiin (salattu)
```

### B.2 Backend proxy (apps/api + functions/)

**Tiedostot:**

- `apps/api/src/routes/imports-binance.ts`
- `apps/api/src/services/binanceClient.ts`
- `apps/api/src/services/binanceHmac.ts`
- `functions/api/binance.ts` (hosted mirror)
- `functions/_lib/binanceHmac.ts`

**Endpointit (identtiset molemmissa):**

```
POST /v1/import/binance/verify        — testaa avain (GET /api/v3/account)
POST /v1/import/binance/trades        — kauppalistat (GET /api/v3/myTrades, paginated)
POST /v1/import/binance/deposits      — talletukset (GET /sapi/v1/capital/deposit/hisrec)
POST /v1/import/binance/withdrawals   — nostot (GET /sapi/v1/capital/withdraw/history)
POST /v1/import/binance/dust          — small balances → BNB (GET /sapi/v1/asset/dribblet)
```

Proxy allekirjoittaa Binance-pyynnöt palvelimella. Secret-avainta ei koskaan lähetetä Binancen palvelimelle suoraan clientiltä.

**TEST_MODE fixture** (`binanceV1Fixture.ts`): deterministiset testitransaktiot E2E-testejä varten.

### B.3 Core mapper: `packages/core/src/import/binanceStatement.ts`

Binance **Statement CSV** -format (prioriteetti, kattavin):

```csv
UTC_Time,Account,Operation,Coin,Change,Remark
2024-01-15 10:30:00,Spot,Buy,BTC,0.001,
2024-01-15 10:30:00,Spot,Transaction Related,USDT,-50.25,
2024-01-15 10:31:00,Spot,Commission History,BNB,-0.0001,
```

Operaatioiden mappaus:

| Binance Operation | LedgerEvent type | Huomio |
|---|---|---|
| `Buy` + `Transaction Related` | BUY (pari) | ryhmitellään aikaleiman + "Transaction Related" perusteella |
| `Sell` + `Transaction Related` | SELL (pari) | sama |
| `Deposit` | TRANSFER (in) | |
| `Withdraw` | TRANSFER (out) | |
| `POS savings interest` / `Staking Rewards` | STAKING_REWARD | FMV = ZERO default |
| `Distribution` / `Airdrop Assets` | AIRDROP | |
| `Commission History` | fee — liitetään lähimpään kauppaan | |
| `Small assets exchange BNB` | SWAP | |
| `Referral Commission` | REWARD | |

**Core mapper: `binanceTrades.ts`** (API-vastaukselle):
- `GET /api/v3/myTrades` palauttaa `symbol, side, price, qty, quoteQty, commission, commissionAsset`
- Yhdistetään Ledger-endpointtien deposit/withdrawal-dataan täydelliseksi kuvaksi

### B.4 Web-integraatio

```
apps/web/src/integrations/binance/
  binanceVault.ts         — vault_binance_v1, BinanceIntegrationSchema (apiKey, apiSecret, autosync settings)
  binanceApi.ts           — proxy-kutsut (verify, trades, deposits, withdrawals)
  binanceSync.ts          — fetchNewest / fetchAll, inkrementaalinen cursor (lastFetchedTs per endpoint)
  binanceImport.ts        — commit LedgerEventit, deduplicate (externalRef: binance:api:<symbol>:<tradeId>)
  binancePlugin.ts        — ImportPlugin { api: {...}, csv: {...} }

apps/web/src/components/imports/
  BinanceConnectForm.tsx  — API Key + Secret -syöttö, verify-kutsu
  BinanceFetchPanel.tsx   — fetchNewest/fetchAll, autosync status, preview
  BinanceCsvUploadForm.tsx — tiedosto-upload, parse + preview, commit
```

**`BinanceCsvUploadForm.tsx` -flow:**
1. Drag-and-drop tai tiedostovalitsin (`.csv`)
2. Clientillä parsitaan `binanceStatement.ts`-mapperilla → `LedgerEvent[]`
3. Näytetään preview (sama `PreviewPanel` kuin API-flowssa)
4. Commit tai hylkäys

CSV-mappaus tapahtuu täysin clientillä — ei backend-kutsua. Tämä on ZK-yhteensopivaa.

### B.5 `data-testid` -standardi

```
form-binance-apikey, form-binance-apisecret
btn-binance-connect, btn-binance-disconnect
btn-binance-fetch-newest, btn-binance-fetch-all
btn-binance-preview-commit, btn-binance-preview-download
input-binance-csv-upload
```

---

## C: Kraken-provider

### C.1 Auth: HMAC-SHA512

```
API Key:   X-Kraken-API-Key header
API Sign:  X-Kraken-API-Sign header (HMAC-SHA512 of URI path + SHA256(nonce + body) )
```

Sama rakenne kuin Binancella — proxy allekirjoittaa palvelimella.

### C.2 Backend proxy

**Tiedostot:**

- `apps/api/src/routes/imports-kraken.ts`
- `apps/api/src/services/krakenClient.ts`
- `apps/api/src/services/krakenHmac.ts`
- `functions/api/kraken.ts` + `functions/_lib/krakenHmac.ts`

**Endpointit:**

```
POST /v1/import/kraken/verify    — testaa avain (POST /0/private/Balance)
POST /v1/import/kraken/ledgers   — kaikki tapahtumat (POST /0/private/Ledgers, paginated offset)
POST /v1/import/kraken/trades    — kauppadetaljit (POST /0/private/TradesHistory) — valinnainen
```

Kraken Ledgers-endpoint kattaa kaiken: talletus, nosto, kauppa, staking, airdrop.

**TEST_MODE fixture** (`krakenV1Fixture.ts`)

### C.3 Core mapper: `packages/core/src/import/krakenLedger.ts`

Kraken Ledger entry:

```json
{ "refid": "ABCDEF", "time": 1705312200, "type": "trade",
  "asset": "XXBT", "amount": "0.001", "fee": "0.0000026", "balance": "..." }
```

Operaatioiden mappaus:

| Kraken type | LedgerEvent type | Huomio |
|---|---|---|
| `trade` | BUY tai SELL | parit: samalla `refid` kaksi riviä (yksi per valuutta) |
| `deposit` | TRANSFER (in) | |
| `withdrawal` | TRANSFER (out) | |
| `staking` | STAKING_REWARD | FMV ZERO default |
| `reward` | STAKING_REWARD | Ethereum staking |
| `earn` | STAKING_REWARD | Kraken Earn -tuotto |
| `airdrop` | AIRDROP | |
| `transfer` | TRANSFER | sisäiset siirrot (Spot → Futures) → skip tai flagaa |

Kraken asset-koodit normalisoidaan: `XXBT → BTC`, `XETH → ETH`, `ZUSD → USD` jne.
Mappaustaulu: `packages/core/src/import/krakenAssetMap.ts`

**`externalRef` -formaatti:** `kraken:ledger:<refid>:<asset>`

### C.4 Web-integraatio

```
apps/web/src/integrations/kraken/
  krakenVault.ts    — vault_kraken_v1
  krakenApi.ts      — proxy-kutsut
  krakenSync.ts     — fetchNewest (offset-cursor), fetchAll
  krakenImport.ts   — commit + deduplicate
  krakenPlugin.ts   — ImportPlugin { api: {...} }  // ei csv-capabilitya

apps/web/src/components/imports/
  KrakenConnectForm.tsx
  KrakenFetchPanel.tsx
```

### C.5 `data-testid` -standardi

```
form-kraken-apikey, form-kraken-apisecret
btn-kraken-connect, btn-kraken-disconnect
btn-kraken-fetch-newest, btn-kraken-fetch-all
btn-kraken-preview-commit, btn-kraken-preview-download
```

---

## D: Coming-soon listan päivitys

`providerRegistry.ts` `COMING_SOON_PROVIDERS` päivitetään kun Binance + Kraken siirtyvät registryyn:

```ts
export const COMING_SOON_PROVIDERS: ProviderDescriptor[] = [
  // Suomalaiset (prioriteetti)
  { id: 'northcrypto', name: 'Northcrypto', authMethods: ['csv'], category: 'exchange' },
  { id: 'coinmotion',  name: 'Coinmotion',  authMethods: ['csv'], category: 'exchange' },
  // EU-pörssit
  { id: 'bybit',     name: 'Bybit',     authMethods: ['api-key', 'csv'], category: 'exchange' },
  { id: 'bitstamp',  name: 'Bitstamp',  authMethods: ['api-key'],        category: 'exchange' },
  { id: 'bitvavo',   name: 'Bitvavo',   authMethods: ['api-key'],        category: 'exchange' },
  { id: 'mexc',      name: 'MEXC',      authMethods: ['api-key', 'csv'], category: 'exchange' },
  // Lompakot (MetaMask prioriteetti)
  { id: 'metamask',  name: 'MetaMask',  authMethods: ['address'],        category: 'wallet' },
  { id: 'ledger',    name: 'Ledger Live', authMethods: ['csv'],          category: 'wallet' },
  { id: 'trezor',    name: 'Trezor Suite', authMethods: ['csv'],         category: 'wallet' },
];
```

---

## Testaus

### Unit testit (vitest)

- [ ] `binanceStatement.test.ts` — CSV-parsinta: osto, myynti, talletus, nosto, staking reward, airdrop, commission pairing
- [ ] `binanceTrades.test.ts` — API-vastauksen mappaus LedgerEventeiksi
- [ ] `krakenLedger.test.ts` — Ledger-entry mappaus, kauppaparin yhdistäminen refid:llä, asset-normalisointi
- [ ] `binancePlugin.test.ts` — plugin toteuttaa interfacen, isConnected false kun vault tyhjä
- [ ] `krakenPlugin.test.ts` — sama
- [ ] `importPlugin.types.test.ts` — päivitetty capability-mallin type-check

### E2E testit (playwright)

- [ ] `imports-binance-api.spec.ts` — TEST_MODE: connect → fetchNewest → preview → commit → disconnect
- [ ] `imports-binance-csv.spec.ts` — upload fixture-CSV → preview → commit
- [ ] `imports-kraken-api.spec.ts` — TEST_MODE: connect → fetchNewest → preview → commit → disconnect
- [ ] `imports-capability-wizard.spec.ts` — Binance: valintanäyttö "Connect via API / Import CSV" näkyy

---

## Arkkitehtuuriperiaatteet

1. **ZK-yhteensopivuus**: API-avaimet salataan vaultiin, proxyn kautta Binancelle/Krakenille. CSV-parsinta tapahtuu 100% clientillä.
2. **Append-only**: `externalRef` deduplikointi estää duplikaatit toistuvissa importeissa.
3. **Inkrementaalinen fetch**: Binance — `startTime` timestamp-cursor. Kraken — `offset`-cursor Ledgers-endpointissa.
4. **TEST_MODE**: molemmat providerit tukevat fixture-creds-tunnistusta (`TEST_API_KEY`/`TEST_SECRET`) kehitys/E2E-testaukseen.

---

## Tiedostomuutokset

### Uudet tiedostot

**Core:**
- `packages/core/src/import/binanceStatement.ts`
- `packages/core/src/import/binanceTrades.ts`
- `packages/core/src/import/binanceAssetMap.ts` (symboli → CoinGecko-id)
- `packages/core/src/import/krakenLedger.ts`
- `packages/core/src/import/krakenAssetMap.ts`

**API (local):**
- `apps/api/src/routes/imports-binance.ts`
- `apps/api/src/routes/imports-kraken.ts`
- `apps/api/src/services/binanceClient.ts`
- `apps/api/src/services/binanceHmac.ts`
- `apps/api/src/services/binanceV1Fixture.ts`
- `apps/api/src/services/krakenClient.ts`
- `apps/api/src/services/krakenHmac.ts`
- `apps/api/src/services/krakenV1Fixture.ts`

**API (hosted):**
- `functions/api/binance.ts`
- `functions/api/kraken.ts`
- `functions/_lib/binanceHmac.ts`
- `functions/_lib/krakenHmac.ts`

**Web — integraatiot:**
- `apps/web/src/integrations/binance/binanceVault.ts`
- `apps/web/src/integrations/binance/binanceApi.ts`
- `apps/web/src/integrations/binance/binanceSync.ts`
- `apps/web/src/integrations/binance/binanceImport.ts`
- `apps/web/src/integrations/binance/binancePlugin.ts`
- `apps/web/src/integrations/kraken/krakenVault.ts`
- `apps/web/src/integrations/kraken/krakenApi.ts`
- `apps/web/src/integrations/kraken/krakenSync.ts`
- `apps/web/src/integrations/kraken/krakenImport.ts`
- `apps/web/src/integrations/kraken/krakenPlugin.ts`

**Web — komponentit:**
- `apps/web/src/components/imports/BinanceConnectForm.tsx`
- `apps/web/src/components/imports/BinanceFetchPanel.tsx`
- `apps/web/src/components/imports/BinanceCsvUploadForm.tsx`
- `apps/web/src/components/imports/KrakenConnectForm.tsx`
- `apps/web/src/components/imports/KrakenFetchPanel.tsx`
- `apps/web/src/components/imports/CapabilityChoiceScreen.tsx` (API vs CSV -valinta)

### Muokatut tiedostot

- `apps/web/src/integrations/importPlugin.ts` — capability-redesign
- `apps/web/src/integrations/coinbase/coinbasePlugin.ts` — migraatio `api:`-capabilityyn
- `apps/web/src/integrations/providerRegistry.ts` — lisätään binancePlugin, krakenPlugin; päivitetään coming-soon
- `apps/web/src/components/imports/ImportWizard.tsx` — lisätään capability-branching + CapabilityChoiceScreen
- `apps/web/src/components/imports/ProviderCard.tsx` — isConnected-logiikka luetaan `plugin.api`
- `apps/api/src/server.ts` — rekisteröi uudet route-moduulit
- `packages/core/src/import/index.ts` — re-export uudet mapperit

---

## Riskit

| Riski | Lieventäminen |
|-------|--------------|
| ImportPlugin capability-redesign rikkoo Coinbase E2E-testit | Coinbase-migraatio on minimaalinen; data-testid:t eivät muutu |
| Binance CSV-format vaihtelee (Statement vs Trade History) | Speksi sitoutuu Statement-formaattiin; format-validointi parse-vaiheessa |
| Kraken asset-koodit (`XXBT`, `XETH`) eivät mappaudu | krakenAssetMap.ts kattaa yleisimmät; tuntematon → surface issue |
| HMAC-proxy ei toimi Cloudflare Workers -ympäristössä | Ajetaan sama logiikka Hono-routeissa kuten Coinbase |

---

## Toteutusjärjestys

```
Vaihe A: importPlugin.ts redesign + coinbasePlugin migraatio + testit
Vaihe B: Binance CSV mapper (core) → verify-proxy → API sync → UI
Vaihe C: Kraken mapper (core) → verify-proxy → API sync → UI
Vaihe D: providerRegistry coming-soon päivitys
```

Suositus: testataan vaihe kerrallaan (`pnpm test` + fixture E2E) ennen seuraavaan siirtymistä.
