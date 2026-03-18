# Feature 26: Dashboard + UX Polish

**Status:** ❌ EI TOTEUTETTU
**ADR:** —
**Paketti:** `apps/web`, `packages/core` (pienet lisäykset)
**Prioriteetti:** P1 — käyttökokemus + konversio

## Tavoite

Viimeistelee päivittäisen käytön UX:n ja poistaa suurimmat kitkapisteet uuden käyttäjän ensimmäisillä askelilla:
- Tyhjä tila → selkeä "Get Started" -ohjaus importtiin
- Import success -palaute
- Setup progress -ohjaus onboarding-vaiheessa
- Dashboard: ValueChart 90D + delta, 24h muutos % per positio, unrealized P&L % PortfolioPage:lla
- Sidebar Sync-napin poisto → passiivinen status (retry vain virheessä)
- Alert badge sidebarin nav-itemissä
- Onboarding: signup + vault yhdelle sivulle, passkey deferred dashboardin banneriin

---

## Vaatimukset

### A. Tyhjä tila + Setup-banneri
- [ ] **Get Started -widget:** dashboardilla kun `positions.length === 0` — exchange-kortit (Coinbase, Binance, Kraken) suorilla import-linkeillä + yksi CTA "→ Import transactions"
- [ ] **Setup progress -banneri:** näkyy kunnes 1. import tehty — `✅ Account  ✅ Vault  ○ Import  ○ Map assets`; häviää pysyvästi kun ledgerEvents > 0
- [ ] **KPI-kortit ilman dataa:** `—` nollan sijaan + "Add data →" -linkki kun portfolioarvo on 0
- [ ] **Partiaalidata-varoitus:** `⚠ 3 assets need price mapping before values show. [Map assets →]`

### B. Import success -banneri
- [ ] **Banneri jokaisen importin/syncin jälkeen:** `"247 new transactions encrypted & synced from Coinbase."`
- [ ] **Banneri häviää** 8 sekunnin kuluttua tai kun käyttäjä sulkee sen
- [ ] **Triggeri:** import wizard / fetch panel tallentaa luvun Zustand-storeen; DashboardPage lukee sen ja näyttää bannerin

### C. Dashboard-kaavion parannukset
- [ ] **ValueChart aikajännevalitsin:** `[7D] [30D] [90D] [1Y] [ALL]` (90D lisätään olemassaolevaan `DashboardCharts.tsx`)
- [ ] **Period delta:** kaavion otsikkorivissä näkyy +/-% valitulta periodilta (`filtered[last].value / filtered[0].value - 1`)
- [ ] **24h muutos % per positio:** Dashboard-holdingestaulukossa uusi sarake `24h` — lasketaan kahdesta peräkkäisestä `pricePoints`-arvosta (eilen vs tänään); `—` jos dataa ei ole riittävästi

### D. PortfolioPage: Unrealized P&L %
- [ ] **P&L %** per positio: `(unrealizedPnlBase / costBasisBase) * 100`; data on jo olemassa `PortfolioSnapshot.positions`-skeemassakin, renderöinti puuttuu
- [ ] **Sort-valikko:** lisätään `pnl%` ja `24h` lajitteluvaihtoehdoiksi

### E. Sidebar: Sync-napin poisto + passiivinen status
- [ ] **Poistetaan** `btn-sync-now` -nappi sidebarin footerista
- [ ] **Tilalle** passiivinen status: `○ Vault backed up · 3 min ago` kun viimeisin sync onnistui
- [ ] **Retry-nappi näkyy vain virheessä:** `● Sync failed [↻ Retry]` (sama `syncNow`-funktio)
- [ ] **Aika-formaatti:** "just now" / "3 min ago" / "2h ago" / päivämäärä yli 24h tapauksessa
- [ ] **Sync-status tallennetaan `useSyncStore`:** `lastSyncAtISO: string | null`, `lastSyncError: string | null`

### F. Alert badge navigaatiossa
- [ ] **Bell-ikonin vieressä badge:** lukumäärä triggeroituneista hälytyksistä jotka eivät ole `acknowledged`
- [ ] **Ei uutta DB-kenttää:** alerts-skeemassa jo `isEnabled`; triggeroitunut alert tunnistetaan `triggeredAtISO`-kentällä (lisätään skeemaan)
- [ ] **Badge häviää** kun käyttäjä käy Alerts-sivulla (merkitään katsotuksi)

### G. Onboarding: Signup + Vault yhdelle sivulle
- [ ] **Uusi sivu `SignupWithVaultPage`** (`/auth/signup`) korvaa nykyisen kaksivaiheen (`SignupPage` → `VaultSetupPage`)
- [ ] **Sivun rakenne:**
  ```
  Logo + "Create your account"

  // YOUR ACCOUNT
  Email, Password, Confirm password

  // YOUR VAULT
  [ZK-selitys: "Your vault passphrase encrypts data on your device.
   Unlike your login password, we cannot reset it — by design."]
  PassphraseGenerator (Copy / Save to file)
  Passphrase input
  Confirm passphrase input
  (Ei checkbox — poistetaan "Olen tallentanut" -ahdistus)

  // TAX COUNTRY
  [🇫🇮 Finland] [🇸🇪 Sweden] [🇩🇪 Germany] [🌍 Other]

  [Create account & vault →]

  "Already have an account? Sign in"
  "Use without account →"
  ```
- [ ] **Toimintajärjestys:** `register()` → `setupVault()` → `saveCountryToSettings()` → navigate `/home`
- [ ] **Vanhat sivut säilyvät:** `VaultSetupPage` (`/vault/setup`) käytetään edelleen offline-moodissa (`?offline=1`) ja sisäänkirjautuneille käyttäjille jotka eivät ole asettaneet vaultia

### H. Passkey deferred
- [ ] **Poistetaan passkey-step `VaultSetupPage`:lta** (step 2) normaalista signup-flowsta
- [ ] **Dashboard-banneri:** ensimmäisellä `/home`-käynnillä näytetään banneri `"Add Face ID / Touch ID for faster unlock? [Enable →] [✕]"`
- [ ] **Banneri tallennetaan `meta`-tauluun:** `ui:passkeyPromptDismissed = "1"` kun suljetaan tai hyväksytään
- [ ] **VaultSetupPage:n passkey-step jää offline-flowhin** (offline-moodissa ei tunneta käyttäjää → passkey ei ole käytettävissä, step piilotetaan siellä jo nyt)

---

## Tekninen suunnitelma

### Domain / Core (`packages/core`)

**Muutos: Alert-skeema — `triggeredAtISO`-kenttä**
```typescript
// packages/core/src/domain/alert.ts
export const Alert = z.object({
  ...BaseEntityFields,
  // ... olemassaolevat kentät ...
  triggeredAtISO: IsoString.optional(),   // UUSI: milloin viimeksi triggeröityi
  acknowledgedAtISO: IsoString.optional(), // UUSI: milloin käyttäjä katsoi
});
```

Nämä kentät ovat optional → taaksepäin yhteensopiva, ei Dexie-migraatiota.

### Platform (`packages/platform-web`)

Ei muutoksia. Dexie-skeema v4 pysyy — `alerts`-taulu jo olemassa.

### Web (`apps/web`)

#### 1. `useSyncStore.ts` — lisäys
```typescript
// Uudet kentät
lastSyncAtISO: string | null;
lastSyncError: string | null;

// syncNow() päivittää nämä:
// onnistumisessa: lastSyncAtISO = new Date().toISOString(), lastSyncError = null
// virheessä: lastSyncError = err.message
```
Persistoidaan `partialize`:ssa → tieto säilyy reload-ylikin.

#### 2. `useImportSuccessStore.ts` — uusi pieni store
```typescript
type ImportSuccessStore = {
  pendingBanner: { provider: string; count: number } | null;
  setBanner: (provider: string, count: number) => void;
  clearBanner: () => void;
};
```

Import wizard / fetch panel kutsuu `setBanner("Coinbase", 247)` kun import onnistuu.
`DashboardPage` lukee `pendingBanner` ja näyttää bannerin.

#### 3. `DashboardCharts.tsx` — ValueChart-muutokset
- Lisätään `'90D'` → `TimeRange` unioniin ja `RANGE_DAYS`-mappiin (`90: 90`)
- Lisätään `periodDelta` laskenta:
  ```typescript
  const periodDelta = filtered.length >= 2
    ? (filtered.at(-1)!.value - filtered[0]!.value) / filtered[0]!.value * 100
    : null;
  ```
- Renderöidään delta kaavion otsikkorivissä kaavion aikajännevalitsimen vieressä

#### 4. `DashboardPage.tsx` — Holdings-taulukko
- Lisätään sarake `24h` (`[Asset, Price, Holdings, Value, 24h, PnL]`)
- 24h-laskenta per positio:
  ```typescript
  // useMemo, laskee kaikille positioille
  const priceChange24h = useMemo(() => {
    // käy pricePoints läpi: hae per assetId viimeinen ja eilen-arvo
    // palauttaa Map<assetId, number | null>
  }, [dbState.data.pricePoints]);
  ```
- `useDashboardData` laajennetaan hakemaan myös `pricePoints` (viimeiset 2 päivää, vain live-pisteet)

#### 5. `PortfolioPage.tsx`
- Lisätään P&L% renderöinti: `pnl.div(costBasis).mul(100).toFixed(1) + '%'`
- Lisätään sort-vaihtoehdot `'pnl'` ja `'24h'` Select:iin

#### 6. `Sidebar.tsx`
- Poistetaan `btn-sync-now` -nappi
- Lisätään sync-status-näyttö (funktio `formatRelativeTime`)
- Retry-nappi näkyy vain kun `lastSyncError !== null`
- Alerts NavItem:iin badge (lukee `useAlertBadgeCount`-hookista)

#### 7. `useAlertBadgeCount.ts` — uusi hook
```typescript
// Laskee katsomattomien triggeroituneiden hälytysten määrän
// alerts.filter(a => a.triggeredAtISO && !a.acknowledgedAtISO).length
```

#### 8. `AlertsPage.tsx`
- Lisätään `acknowledgedAtISO = now` kaikille hälytyksille kun sivu mountataan (tai kun käyttäjä käy sivulla)

#### 9. `SignupWithVaultPage.tsx` — uusi sivu
- Korvaa `/auth/signup` -reitin
- `SignupPage.tsx` poistetaan tai jätetään (compat)
- Toimintajärjestys: `register` → `setupVault` → `saveCountry` → `navigate('/home')`
- PassphraseGenerator-komponentti integroitu

#### 10. `VaultSetupPage.tsx`
- Poistetaan `passkey`-step (step 2) kun ei ole `?offline=1` -moodissa
- Passkey-step jää vain offline-moodiin (missä passkey ei kuitenkaan toimi, joten se piilotetaan myös siellä)
- Käytännössä: `TOTAL_STEPS` 4 → 3 (country → passphrase → done)

#### 11. `DashboardPage.tsx` — bannerit
- **Import success -banneri** (auto-dismiss 8s): lukee `useImportSuccessStore`
- **Setup progress -banneri**: näkyy kun `ledgerEvents.length === 0`
- **Passkey-deferred -banneri**: lukee `meta('ui:passkeyPromptDismissed')`, näytetään vain kun `isPasskeySupported() && !dismissed && vaultSetup`
- **Partiaalidata-varoitus**: lasketaan `positions` joilla `valueBase === '0'` mutta `amount > 0`

#### 12. Routing (`App.tsx`)
- `/auth/signup` → `SignupWithVaultPage` (uusi)
- Vanhat data-testid:t säilytetään yhteensopivuuden vuoksi

---

## UI-suunnitelma

### Tyhjä tila (Get Started -widget)
```
┌─────────────────────────────────────────────────┐
│ // GET STARTED                                   │
│                                                  │
│  Connect your first exchange                     │
│                                                  │
│  [🟠 Coinbase]  [⬡ Binance]  [K Kraken]  [+ More]│
│                                                  │
│  [→ Import transactions]                         │
└─────────────────────────────────────────────────┘
```

### Setup progress -banneri (dashboard yläreuna)
```
┌─────────────────────────────────────────────────┐
│ ✅ Account  ✅ Vault  ○ Import transactions  ○ Map assets  [→] │
└─────────────────────────────────────────────────┘
```

### Import success -banneri (dashboard, dismissable)
```
┌─────────────────────────────────────────────────┐
│ ✓  247 new transactions encrypted & synced from Coinbase.  [✕] │
└─────────────────────────────────────────────────┘
```

### Passkey-deferred -banneri
```
┌─────────────────────────────────────────────────┐
│ 🔑  Add Face ID for faster unlock?  [Enable →]  [✕] │
└─────────────────────────────────────────────────┘
```

### Sidebar footer (sync-status)
```
Onnistui:
  ○ Vault backed up · 3 min ago

Virheessä:
  ● Sync failed  [↻ Retry]
```

### Alerts nav-item badge
```
🔔 Alerts    [2]    ← oranssi badge
```

### Dashboard Holdings — lisäsarake 24h
```
Asset     Price     Holdings    Value      24h      PnL
BTC       45 200€   0.5         22 600€   +1.8%    +12.3%
ETH       2 400€    3.2         7 680€    −0.5%    +4.1%
```

### SignupWithVaultPage (yhdistetty)
- Koko ruudun centered-layout kuten nykyinen SignupPage
- Kaksi selkeää sektiota `// YOUR ACCOUNT` ja `// YOUR VAULT` terminal-tyylisellä otsikolla
- Maa-valinta grid 2×2 (kuten VaultSetupPage:ssa)
- Yksi iso CTA-nappi alhaalla: `"Create account & vault →"`

---

## Testaus

### Unit testit (vitest)
- `useSyncStore`: `lastSyncAtISO` ja `lastSyncError` päivittyvät oikein onnistumisessa ja virheessä
- `useAlertBadgeCount`: laskee oikein triggeroituneet / katsomattomat
- `formatRelativeTime`: testaa kaikki aikahaarukat (just now, min ago, h ago, >24h)
- `periodDelta`-laskenta (ValueChart): tyhjä data → null, yksi datapiste → null, kaksi pistettä → oikea %
- 24h muutos -laskenta: ei dataa → null, sama päivä → null, eilen+tänään → oikea %

### E2E testit (playwright)
- **Import success -banneri:** tee import → navigoi dashboardille → banneri näkyy → häviää 8s:ssa
- **Setup progress -banneri:** uusi käyttäjä, ei tapahtumia → banneri näkyy; importin jälkeen → häviää
- **Get Started -widget:** ei positioita → widget näkyy; importin jälkeen → widget häviää
- **Signup + Vault yhdellä sivulla:** täytä lomake → luo tili → päätyy dashboardille → vault unlocked
- **Sidebar sync-status:** `btn-sync-now` ei enää löydy; status-teksti löytyy

---

## Riippuvuudet
- Feature 14 (billing gating) — ei suoraa riippuvuutta; bannerit ovat ilmaisia
- Feature 25 (Finnish Tax Parity) ✅ — valmis
- Alert-skeemamuutos (`triggeredAtISO`) on taaksepäin yhteensopiva

## Riskit / rajoitteet

1. **24h muutos % -datan saatavuus:** Lasketaan `pricePoints`-taulusta kahdesta peräkkäisestä arvosta. Uusilla käyttäjillä tai jos hintoja ei ole haettu vähintään kahtena eri päivänä, näytetään `—`. Tämä on hyväksyttävä kompromissi ilman ylimääräistä CoinGecko-kenttää.

2. **`SignupWithVaultPage` vs E2E-testit:** Nykyiset E2E-testit saattavat löytää `data-testid="form-email"` ja `data-testid="btn-signup"` — nämä **säilytetään** uudessa sivussa. `data-testid="btn-create-vault"` ja `data-testid="form-vault-passphrase"` säilyvät myös.

3. **Alert badge + `triggeredAtISO`:** Runner (Cloudflare Worker) asettaa `triggeredAtISO` serverillä kun hälytys triggeröityy, mutta synkataan clientille vasta seuraavassa syncissä. Paikallinen badge voi olla hetken viiveellä.

4. **Passkey-step poisto:** VaultSetupPage:ssa passkey-step on toiminnallinen — poistetaan se normaalista flowsta. Offline-modessa passkey EI toimi (ei serveriä webauthn-rekisteröintiin) → step piilotetaan myös siellä. PasskeyCard-komponentti jää SettingsPage:lle.

5. **Tiedostokoko:** `SignupWithVaultPage.tsx` on laaja (kaksi lomaketta + maa-valinta + PassphraseGenerator). Arviolta ~250 riviä, alle 300-rajan.

---

## Vaiheistus (ehdotettu toteutusjärjestys)

### Vaihe 1 — Core UX (ei UI-riippuvuuksia muihin featureihin)
1. Sidebar sync-napin poisto + passiivinen status (`useSyncStore` + `Sidebar.tsx`)
2. Setup progress -banneri + Get Started -widget (`DashboardPage.tsx`)
3. Import success -banneri (`useImportSuccessStore` + import-komponentit + `DashboardPage.tsx`)

### Vaihe 2 — Dashboard data
4. ValueChart 90D + period delta (`DashboardCharts.tsx`)
5. 24h muutos % per positio (`useDashboardData` + `DashboardPage.tsx`)
6. Unrealized P&L % PortfolioPage:lla + uudet sort-vaihtoehdot

### Vaihe 3 — Onboarding
7. `SignupWithVaultPage.tsx` (yhdistää signup + vault)
8. VaultSetupPage passkey-step poisto
9. Passkey-deferred dashboard-banneri

### Vaihe 4 — Alert badge
10. Alert-skeema `triggeredAtISO` + `acknowledgedAtISO`
11. `useAlertBadgeCount` + Sidebar badge + AlertsPage acknowledge

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `apps/web/src/store/useSyncStore.ts` — `lastSyncAtISO`, `lastSyncError`
- [ ] `apps/web/src/store/useImportSuccessStore.ts` — uusi store
- [ ] `apps/web/src/components/Sidebar.tsx` — sync-status, alert badge
- [ ] `apps/web/src/hooks/useAlertBadgeCount.ts` — uusi hook
- [ ] `apps/web/src/components/DashboardCharts.tsx` — 90D, period delta
- [ ] `apps/web/src/hooks/useDashboardData.ts` — pricePoints lisäys
- [ ] `apps/web/src/pages/DashboardPage.tsx` — bannerit, 24h sarake, Get Started
- [ ] `apps/web/src/pages/PortfolioPage.tsx` — P&L%, uudet sortit
- [ ] `apps/web/src/pages/SignupWithVaultPage.tsx` — uusi sivu
- [ ] `apps/web/src/pages/VaultSetupPage.tsx` — passkey-step poisto
- [ ] `apps/web/src/pages/AlertsPage.tsx` — acknowledge
- [ ] `apps/web/src/app/App.tsx` — routing
- [ ] `packages/core/src/domain/alert.ts` — `triggeredAtISO`, `acknowledgedAtISO`

### Env-muutokset
Ei uusia.

### Deploy-ohjeet
Ei DB-migraatioita (hosted Neon ei muutu). Alert-skeeman uudet kentät ovat optional → taaksepäin yhteensopiva Dexie-taulun kanssa (versio pysyy v4).
