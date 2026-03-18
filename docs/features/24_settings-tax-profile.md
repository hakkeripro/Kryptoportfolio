# Feature 24: Settings-sivu siivous + Tax Profile

**Status:** 📋 SUUNNITTEILLA
**ADR:** —
**Paketti:** `packages/core` + `apps/web`
**Prioriteetti:** P1
**Sprintti:** Sprint 1 (PRODUCT_ROADMAP_2026.md)

---

## Tavoite

Settings-sivu on tällä hetkellä epälooginen: verotusasetukset, tietoturvaasetukset ja käyttöasetukset ovat sekaisin kahdessa epämääräisessä ryhmässä ("Vault & Security" + "Preferences"). Käyttäjä ei löydä Tax Profile -asetuksia helposti.

Tässä featuressa:
1. **Reorganisoidaan Settings-sivu** selkeisiin, nimettyihin osioihin
2. **Luodaan Tax Profile -osio** (maa, valuutta, lot method, HMO default)
3. **Lisätään `taxCountry`-kenttä** Settings-skeemaan — maatiedon säilytys
4. **Lisätään maa-valinta onboardingiin** (VaultSetupWizard)

---

## Vaatimukset

### Settings-sivun uusi rakenne

```
// ACCOUNT
  - Sähköposti + kirjautumistila
  - Kielivalinta (EN / FI)
  - Linkki AccountPage:lle (passkeys, salasana, vault passphrase)

// TAX PROFILE
  - Maa-valinta (taxCountry): FI / SE / DE / OTHER
  - Perusvaluutta (baseCurrency)
  - Lot method (FIFO / LIFO / HIFO / AVG_COST)
  - HMO default toggle (hmoEnabled — prep for Feature 25)
  - Rewards cost basis mode (ZERO / FMV)
  - Tallenna-nappi

// NOTIFICATIONS
  - Server alerts toggle + status (nykyinen NotificationsCard säilyy)
  - Device push toggle

// INTEGRATIONS
  - Auto-refresh-intervalli (siirretty PortfolioSettingsCardista)
  - Coinbase: viittaus ImportsPage:lle autosync-asetuksiin

// DANGER ZONE
  - Export data: lataa kaikki tapahtumat JSON-muodossa (client-side)
  - Delete account: placeholder-nappi + vahvistusmodaali (API: DELETE /v1/auth/account)
```

### Toiminnalliset vaatimukset

- [ ] Settings-sivu käyttää uutta osiorakennetta
- [ ] `PortfolioSettingsCard` korvataan `TaxProfileCard`-komponentilla
- [ ] Tax Profile -osiossa on maa-valinta (FI, SE, DE, OTHER) joka asettaa `taxCountry`
- [ ] `taxCountry = 'FI'` lukitsee lot methodin FIFO:ksi + näyttää selityksen (UI-vihje — ei pakota laskentaan vielä, se on Feature 25)
- [ ] `hmoEnabled`-toggle näkyy vain kun `taxCountry = 'FI'`
- [ ] SyncCard siirretään INTEGRATIONS-osioon (ei enää irrallinen kappale sivulla)
- [ ] AdvancedCard (dev-only) säilyy DANGER ZONE -osion lopussa
- [ ] Export data: `JSON.stringify(ledgerEvents)` + `Blob` download — ei API-kutsua
- [ ] Onboarding (VaultSetupWizardPage): lisätään maa-valintasäde ennen vault-vaihetta

### Ei tässä featuressa
- Varsinainen HMO-laskenta (→ Feature 25)
- Lompakkokohtainen FIFO (→ Feature 25)
- Coinbase autosync -konfigurointi Settings-sivulla (autosync on jo ImportsPage:lla)
- Delete account -API endpoint (placeholder riittää — merkitään ISSUE_LOG:iin)
- Stripe/billing-osio Settings-sivulla (on jo AccountPage:lla)

---

## Tekninen suunnitelma

### Domain (`packages/core`)

**`packages/core/src/domain/settings.ts`**

Lisätään kaksi kenttää Settings-skeemaan:

```typescript
taxCountry: z.enum(['FI', 'SE', 'DE', 'OTHER']).optional(),   // uusi
hmoEnabled: z.boolean().optional(),                             // uusi, prep Feature 25
```

Olemassaolevat kentät säilyvät ennallaan. Muutos on backward-compatible (optional-kentät).

### Platform (`packages/platform-web`)

Ei muutoksia — Dexie-skeema ei tarvitse versio-bumppua, koska uudet Settings-kentät ovat optional ja Dexie tallentaa ne automaattisesti.

### API (`apps/api` + `functions/`)

Ei muutoksia tässä featuressa.

### Web (`apps/web`)

#### Uudet komponentit

**`apps/web/src/components/settings/TaxProfileCard.tsx`** (korvaa PortfolioSettingsCard)
- Props: `settings`, `loading`, `error`, `busy`, `setBusy`
- Kentät: `taxCountry`, `baseCurrency`, `lotMethodDefault`, `hmoEnabled`, `rewardsCostBasisMode`
- `taxCountry = 'FI'` → lot method -select disabloituu + tooltip "Finland: FIFO required by tax authority"
- `hmoEnabled`-rivi renderöidään vain kun `taxCountry = 'FI'`
- data-testid: `card-tax-profile`, `form-settings-tax-country`, `form-settings-hmo-enabled`

**`apps/web/src/components/settings/IntegrationsCard.tsx`** (uusi)
- Auto-refresh-intervalli (siirretty TaxProfileCardilta)
- Linkki `/import` Coinbase-asetuksiin
- data-testid: `card-integrations`

**`apps/web/src/components/settings/DangerZoneCard.tsx`** (korvaa AdvancedCard)
- "Export data (JSON)": client-side Blob download kaikista `ledgerEvents`-merkinnöistä
- "Delete account": vahvistusmodaali → placeholder (toast: "Contact support to delete account")
- AdvancedCard (dev-only) säilyy erillisenä, renderöidään DangerZoneCardin jälkeen DEV:ssä
- data-testid: `card-danger-zone`, `btn-export-data`, `btn-delete-account`

#### Muokatut komponentit

**`apps/web/src/pages/SettingsPage.tsx`**
- Uusi osiorakenne: ACCOUNT / TAX PROFILE / NOTIFICATIONS / INTEGRATIONS / DANGER ZONE
- Korvaa `PortfolioSettingsCard` → `TaxProfileCard`
- Lisää `IntegrationsCard` + `DangerZoneCard`
- Poistaa erilliset SyncCard-kutsun (siirtyy IntegrationsCardiin tai jää omaksi osiokseen INTEGRATIONS alla)
- `settingsQ` säilyy — sama data-fetching kuin ennen

**`apps/web/src/pages/VaultSetupWizardPage.tsx`**
- Lisätään step 0: "Where do you pay crypto taxes?"
  - [🇫🇮 Finland] [🇸🇪 Sweden] [🇩🇪 Germany] [🌍 Other]
  - Asettaa `taxCountry` Settingsiin heti kun vault on alustettu
  - Step on skippattavissa ("Skip for now →")

---

## UI-suunnitelma

### Sections

Käytetään projektista tuttua `// SECTION_NAME` -terminal-tyylistä otsikointia:

```
text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3
```

DANGER ZONE -otsikko: `text-red-500/60` (nykyinen käytäntö säilyy).

### Tax Profile Card

```
┌─────────────────────────────────────────────────────┐
│ Tax Profile                              [Save]      │
│ Configure how your crypto gains are calculated      │
│                                                      │
│ Tax country     [🇫🇮 Finland ▾]                    │
│ Base currency   [EUR_____________]                   │
│ Lot method      [FIFO ▾] ⓘ Required by Finnish law  │
│ Rewards basis   [Zero cost basis ▾]                  │
│ HMO default     [○ Apply where beneficial]          │  ← vain FI
└─────────────────────────────────────────────────────┘
```

### Onboarding country step

```
Where do you pay crypto taxes?
We'll set up your tax profile automatically.

[🇫🇮 Finland]   [🇸🇪 Sweden]
[🇩🇪 Germany]   [🌍 Other]

                        [Skip for now →]
```

Valittu maa korostuu oranssilla borderilla (`border-[#FF8400]`).

---

## Testaus

### Unit-testit (`vitest`)

**`packages/core/src/domain/settings.test.ts`** (laajennus):
- Settings-skeema hyväksyy `taxCountry` + `hmoEnabled` (optional)
- Settings-skeema on backward-compatible ilman uusia kenttiä

**`apps/web/src/components/settings/TaxProfileCard.test.tsx`** (uusi):
- Lot method -select disabloituu kun `taxCountry = 'FI'`
- HMO-toggle näkyy vain kun `taxCountry = 'FI'`
- Save tallentaa kaikki kentät oikein

**`apps/web/src/components/settings/DangerZoneCard.test.tsx`** (uusi):
- Export-nappi kutsuu `URL.createObjectURL` (mock)
- Delete-nappi avaa vahvistusmodaalin

### E2E-testit (`playwright`)

**`apps/web/e2e/settings-tax-profile.spec.ts`** (uusi, ~3 testiä):
1. Settings-sivulla näkyy kaikki 5 osiota oikeilla `data-testid`-attribuuteilla
2. TaxProfileCard: vaihda `taxCountry → FI` → lot method -select disabloituu + HMO-toggle ilmestyy
3. TaxProfileCard: tallenna asetukset → `save-status` näyttää onnistumisviestin

**Olemassaolevat testit:** Kaikki nykyiset Settings-sivun testit (jos niitä on) pitää ajaa läpi ja päivittää uusiin `data-testid`-arvoihin.

---

## Riippuvuudet

- **Feature 13** ✅ — ImportsPage on paikallaan, INTEGRATIONS-osioon voi lisätä linkin sinne
- **Feature 14** ✅ — AccountPage:lla on billing-osio; Settings ei tarvitse sitä
- **Feature 22/23** ✅ — Design system + shadcn/ui käytössä; TaxProfileCard käyttää samoja patterneja

### Bugit korjattava ensin
- Ei blokkereita

---

## Riskit / rajoitteet

1. **VaultSetupWizardPage**: onboarding-country-step täytyy tallentaa Settings DB:hen *ennen* kuin vault on täysin alustettu — tarkistettava ajoitus (`ensureDefaultSettings()` vs vault init order)
2. **Backward compat**: `taxCountry`-kenttä on optional; olemassaolevilla käyttäjillä arvo on `undefined` → UI näyttää "Other" defaultina — hyväksyttävää
3. **Delete account**: API-endpoint puuttuu → placeholder, ei kriittinen blokkeri
4. **SyncCard siirto**: `busy`-state on jaettu koko Settings-sivun välillä; IntegrationsCardilla täytyy olla sama `busy/setBusy` -mekanismi

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/core/src/domain/settings.ts` — `taxCountry` + `hmoEnabled` lisätty
- [ ] `apps/web/src/components/settings/TaxProfileCard.tsx` — luotu
- [ ] `apps/web/src/components/settings/IntegrationsCard.tsx` — luotu
- [ ] `apps/web/src/components/settings/DangerZoneCard.tsx` — luotu
- [ ] `apps/web/src/pages/SettingsPage.tsx` — uudelleenorganisoitu
- [ ] `apps/web/src/pages/VaultSetupWizardPage.tsx` — country step lisätty
- [ ] Unit-testit kirjoitettu ja ajettu
- [ ] E2E-testit kirjoitettu ja ajettu

### Env-muutokset
Ei uusia ympäristömuuttujia.

### Deploy-ohjeet
- Ei DB-migraatioita (Settings-kentät ovat optional, Dexie-muutos automaattinen)
- Ei Neon-migraatioita

---

## Toteutusstrategia

Tämä feature on **puhdas UI/UX-refaktorointi + pieni schema-laajennus**. Ei backend-muutoksia.

**Suositeltu sessio-jako:**

1. **Sessio 1 — Core + komponentit**: Settings-skeema, TaxProfileCard, IntegrationsCard, DangerZoneCard + unit-testit
2. **Sessio 2 — SettingsPage + E2E**: SettingsPage uudelleenorganisointi + onboarding country step + E2E-testit

Tai yhdellä sessiolla jos laajuus sallii: `/implement-feature 24` → `/frontend-design` UI-hiomiseen.
