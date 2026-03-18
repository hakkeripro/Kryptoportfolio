# PrivateLedger — Product Roadmap 2026

**Laadittu:** 2026-03-17
**Perustuu:** Kaupallinen + UX-arviointisessio (2026-03-17)
**Alkuarvio:** Kaupallinen 7/10, UX 7.5/10, AI-workflow 8.5/10
**Tavoite:** Kaikki osa-alueet 9-10/10

---

## OSA 1: KAUPALLINEN STRATEGIA

### 1.1 Kilpailutilanne

**Suorat kilpailijat Suomessa/Pohjoismaissa:**
- **kryptoverotus.fi** — suomalainen, 130+ integraatiota (CSV-pohjainen), HMO-laskuri, lompakkokohtainen FIFO, OmaVero-opas. Ei privacy-tarinaansa (data Googlelle/Metalle/PostHogille). €49–€399/verovuosi.
- **Divly** — ruotsalainen, paras Pohjoismaat-tuki, FI-verologiikka. Pieni tiimi. €99–€199/vuosi.
- **Koinly** — kansainvälinen markkinajohtaja, 350+ integraatiota, vahva SEO. Ei ZK. €49–€279/verovuosi.

**Kriittisin erottautumistekijä:** Kukaan kilpailija ei tarjoa zero-knowledge -arkkitehtuuria. Tämä on aito, teknisesti toteutettu USP — ei markkinointiväittämä.

---

### 1.2 Kohdemarkkinan prioriteetti

```
1. Suomi (ensin)      — kryptoverotus.fi on voitettavissa ZK:lla + paremmalla UX:lla
2. Pohjoismaat        — Divly on pieni, Ruotsi/Norja/Tanska samankaltainen veromalli
3. EU (myöhemmin)     — Blockpit/Koinly dominoi, vaatii enemmän resursseja
```

---

### 1.3 Exchange-integraatiot (prioriteettijärjestys)

| Prioriteetti | Exchange | Perustelu |
|---|---|---|
| 1 | **Binance** (CSV + API) | Suurin käyttäjäkanta EU:ssa |
| 2 | **Kraken** (API) | Toiseksi suurin, Suomessa suosittu |
| 3 | **Northcrypto** (CSV) | Suomalainen, FIN-FSA säännelty, partnership-potentiaali |
| 4 | **Coinmotion** (CSV) | Suomalainen, toinen paikallinen |
| 5 | **Bybit** (CSV + API) | Kasvaa EU:ssa Binance-rajoitusten takia |
| 6 | **Bitstamp** (API) | EU-headquartered, luotettu |

**Live-seuranta ZK-yhteensopivasti:** API-avaimet salataan vaultissa, ei koskaan palvelimelle. Auto-sync pyörii clientillä (PWA foreground + Service Worker background). Markkinointiviesti: *"Sync happens on your device — your API keys never leave it."*

---

### 1.4 Hinnoittelumalli

```
FREE
  - Rajoittamaton portfolio tracking
  - 1 exchange-integraatio
  - Transaktiohistoria: 1 vuosi
  - 3 price alert -hälytystä
  - Tax data quality check (näkee ongelmat, voi korjata)
  - Verolaskenta preview (laskenta pyörii, numerot piilotettu)

PRO  €4,99/kk  tai  €49/vuosi
  - Kaikki integraatiot + API autosync
  - Rajoittamaton historia
  - Rajattomat hälytykset
  - Verolaskennan tulokset näkyvissä
  - Tax optimization (HMO, lot method comparison)
  - OmaVero copy-paste -opas
  - PDF + CSV export
  - Portfolio performance historia (kaikki)
  - AI portfolio analysis (client-side)

ADD-ONS (à la carte piheille)
  - Alerts Pro    €1,99/kk  — rajattomat hälytykset
  - History Full  €1,99/kk  — koko historia
```

**Psykologia:** Add-on ostaja → helppo upsell Pro:hon kun hinta on tuttu.

---

### 1.5 Domain + landing page

- **Domain:** `private-ledger.app` (tai .fi Suomi-first strategialla)
- **Hero-viesti:** *"The only crypto tracker that can't see your data."*
- **Konkreetti selitys ZK:sta:** ei pelkkä slogan, vaan 1-2 lausetta miten se toimii
- **Dashboard-preview/screenshot** ennen rekisteröitymistä — laskee kynnystä
- **Launch:** Hacker News "Show HN" ZK-arkkitehtuurikulma + suomenkielinen SEO-artikkeli

---

### 1.6 Jakelu ja asiakashankinta

| Kanava | Toimenpide |
|---|---|
| SEO (FI) | Artikkeli: "Krypto verotus Suomessa 2026 — OmaVero step by step" |
| Partnership | Northcrypto + Coinmotion — pyydä mainintaa tax FAQ:ssa |
| Reddit | r/Suomi, r/eupersonalfinance — orgaaninen apu verokauden kysymyksiin |
| YouTube (FI) | Tutorial: suomenkielinen Verohallinto-ohje PrivateLedgerlla |
| Show HN | Tekninen ZK-arkkitehtuuripostaus launch-hetkellä |

---

## OSA 2: UX-PARANNUKSET

### 2.1 Konversionpisteet premiumiin

Upgrade-CTA näkyy kontekstuaalisesti — ei vain Tax-sivulla:

| Tilanne | Viesti |
|---|---|
| Yli 1v historia | "Full history — Pro" |
| 4. hälytys | "Unlimited alerts — Pro" |
| Tax-sivu, generate | "Unlock your results — Pro" |
| HMO-laskuri | "Estimated tax saving: [locked] — Pro" |
| Dashboard AI-analyysi | "AI portfolio health — Pro" |
| Portfolio 30pv raja | "Full performance history — Pro" |

---

### 2.2 A: Onboarding-flow

**Ongelmat nykyisessä:**
- 4 näkymää ennen kuin käyttäjä näkee yhtään dataa
- Login-salasana + vault passphrase selittämättä miksi kaksi
- Passkey vie oman koko näkymänsä vaikka optionaalinen
- "Olen tallentanut passphrasen" -checkbox luo ahdistusta
- ZK-selitys puuttuu juuri siinä hetkessä kun se merkitsisi jotain

**Korjaukset:**

1. **Signup + VaultSetup yhdelle näkymälle**
   - Kaksi sektiota: "Your account" (email+salasana) + "Your vault" (passphrase)
   - Inline-selitys: *"Your vault passphrase encrypts data on your device. Unlike your login password, we cannot reset it — by design."*
   - Passphrase generator + Copy/Save-to-file -toiminnot (ei checkbox)

2. **Passkey → deferred, dashboard-banneri**
   - Ei onboardingissa, vaan ensimmäisellä dashboard-käynnillä: *"Add Face ID for faster unlock? [→] [✕]"*

3. **Maa/Tax country → onboardingissa**
   - Yksi kysymys ennen vaultin luontia: *"Where do you pay crypto taxes?"*
   - [🇫🇮 Finland] [🇸🇪 Sweden] [🇩🇪 Germany] [🌍 Other]
   - Asettaa taxProfile + baseCurrency automaattisesti

4. **"Use without account" selkeämmin**
   - Ei piilotettuna alarivissä vaan kolmas selkeä vaihtoehto omalla selityksellä

---

### 2.3 B: Tyhjä tila (empty state)

**Ongelmat:**
- $0.00 kaikkialla — näyttää rikkinäiseltä
- Hajautetut EmptyStatet joka sektiossa
- Ei onboarding-jatkumoa setup-vaiheiden jälkeen
- Ei "aha-moment" ensimmäisen importin jälkeen
- Partiaalidata (transaktiot olemassa, hinnat puuttuu) näyttää samalta kuin tyhjä

**Korjaukset:**

1. **KPI-kortit ilman dataa:** `—` nollan sijaan + "Add data →" -linkki

2. **Get Started -widget** kun `positions.length === 0`:
   - Exchange-kortit (Coinbase, Binance, Kraken...) suorilla linkeillä
   - Yksi selkeä CTA: "→ Import transactions"

3. **Setup progress -banneri** (häviää kun 1. import tehty):
   - `✅ Account  ✅ Vault  ○ Import  ○ Map assets`

4. **Import success -banneri** (jokaisen importin/syncin jälkeen):
   - *"247 new transactions encrypted & synced from Coinbase."*
   - Vahvistaa toiminnallisen onnistumisen + USP:n

5. **Partiaalidata-varoitus:**
   - *"⚠ 3 assets need price mapping before values show. [Map assets →]"*

---

### 2.4 C: Dashboard + Portfolio (päivittäinen käyttö)

**Korjaukset:**

1. **ValueChart aikajännevalitsin:** [7D] [30D] [90D] [1Y] [ALL] + delta per periodi
2. **24h muutos % per positio** — CoinGecko-data on jo olemassa
3. **Unrealized P&L % per positio** portfolio-sivulla — data olemassa, renderöinti puuttuu
4. **Sync-status indikaattori** dashboardin yläpalkissa:
   - `● Synced 3 min ago [↻]` / `⚠ Sync failed [Retry]`
5. **Triggered alert -badge:** `🔔 2` dashboardin yläpalkissa
6. **Portfolio sort:** Lisätään P&L% ja 24h muutos lajitteluvaihtoehdoiksi
7. **"Set alert" -pikavalikko** positio-rivillä (Feature 15 toteutuksessa)
8. **Mobiili:** Swipeable card carousel kaavioille (ValueChart ↔ AllocationBars)

**Sidebar sync-nappiin:**
- Poistetaan "Sync"-toimintanappi
- Tilalle passiivinen status: `○ Vault backed up · 3 min ago`
- Nappi vain virhetilanteessa: `● Sync failed [↻ Retry]`
- Dashboard-yläpalkin sync-indikaattori hoitaa kommunikoinnin

---

### 2.5 D: Tax Flow

**Ongelmat:**
- Käyttäjä ei tiedä onko data kunnossa ennen laskentaa
- Laskenta-tulokset näkyvät ilmaiseksi (kaupallinen ongelma)
- HMO puuttuu (kriittisin Finnish tax -ominaisuus)
- Omat siirrot pörssien välillä voi tulla kirjatuksi verotettaviksi
- OmaVero-kopiointiopas puuttuu
- Lot method -selitys puuttuu
- Maa/jurisdiktio-valinta piilotettu

**Korjaukset:**

1. **Data Quality Check** (ilmainen, ennen laskentaa):
   ```
   ✅ 1 247 transactions loaded
   ⚠  23 transactions missing EUR value    [Fix →]
   ⚠  3 assets unmapped                    [Map →]
   ⚠  5 unmatched transfers                [Review →]
   ```
   - [Fix →] vie TransactionsPage:lle esifiltteröitynä

2. **Transfer detection + review UI:**
   - Automaattinen matching: sama summa ±dust, alle 2h aikaikkunassa, eri pörssit
   - Tunnistamaton siirto → käyttäjälle varoitus + [Mark as transfer] -toiminto
   - AI-avustus: voi auttaa luokittelussa/kuvauksen tulkinnassa (EI hintatiedoissa)

3. **Blur-gate tuloksille** (premium-konversiopiste):
   ```
   Realized gain    ██████ EUR   [🔒 Unlock — Pro]
   Proceeds         ██████ EUR
   Cost basis       ██████ EUR
   ```

4. **HMO-laskuri** (Finland-profiili):
   - Toggle: "Apply acquisition cost assumption where beneficial (20%/40%)"
   - Automaattinen omistusajan laskenta (< 10v = 20%, ≥ 10v = 40%)
   - "Estimated tax saving: [locked] EUR" → Pro-konversionpiste

5. **Lompakkokohtainen FIFO** (Verohallinnon ohje):
   - Pakollinen Finland-profiililla, selitetty käyttäjälle

6. **OmaVero copy-paste -opas** (Pro, raportin jälkeen):
   ```
   Step 1 — Luovutusvoitot ja -tappiot (OmaVero)
   Myyntihinnat:   48 210,00 €  [📋 Copy]
   Hankintahinnat: 31 776,00 €  [📋 Copy]
   Kulut:             324,50 €  [📋 Copy]
   ```

7. **Tax issue -filter TransactionsPage:lla:**
   - [All] [Issues only] [Missing value] [Unmatched transfer]

8. **Lot method -selitys kontekstissa:**
   - FIFO lukitaan Finland-profiililla + selitys miksi

9. **AI-avustus transaktion luokitteluun** (realistinen käyttötapaus):
   - Käyttäjä voi pyytää AI:ta tulkitsemaan epäselvän tapahtumakuvauksen
   - AI EI arva hintoja — vain tyyppiluokittelu + kuvauksen tulkinta

---

### 2.6 E: Kokonaisarkkitehtuurin puuttuvat linkit

1. **Settings-sivu: siivous + selkeytys**
   - Nykyinen: sekava, kaikki samassa
   - Uusi rakenne:
     ```
     // ACCOUNT
     Email, password, passkeys
     // TAX PROFILE
     Country, base currency, lot method, HMO default
     // NOTIFICATIONS
     Push alerts, email
     // INTEGRATIONS
     Coinbase autosync-asetukset
     // DANGER ZONE
     Export data, delete account
     ```
   - Progressiiviset asetukset: tärkeimmät valittu jo onboardingissa

2. **Alerts → dashboard-integraatio** (Feature 15):
   - "Set alert" suoraan positio-riviltä
   - Triggered alert -badge dashboardilla

3. **Premium upgrade -pisteet koko appissa:**
   - Jokainen gated feature on itsenäinen konversionpiste
   - Yhtenäinen UpgradeModal kaikissa kohdissa

---

## OSA 3: AI-AVUSTUS ORPOJEN TIETOJEN TÄYDENTÄMISEEN

### Mitä AI voi tehdä (realistinen arvio)

| Käyttötapaus | AI sopii? | Parempi vaihtoehto |
|---|---|---|
| Transaktion tyyppiluokittelu epäselvästä kuvauksesta | ✅ Kyllä | — |
| Pörssispesifisen kuvauksen tulkinta | ✅ Kyllä | — |
| Siirron tunnistus kontekstin perusteella | ✅ Apuna | Sääntöpohjainen matching ensin |
| Historialliset token-hinnat | ❌ Ei | CoinGecko API |
| Obscure tokenin FMV verotukseen | ❌ Ei | Manuaalinen syöttö + varoitus |
| Transfer matching eri pörsseistä | ⚠ Osittain | Sääntöpohjainen (summa ±dust + aikaikkunaluotettavampi) |

### Käytännön toteutus

```
Unresolved transaction:
"Staking reward - ATOM - 0.543210 - 2024-03-15"

[🤖 Ask AI to classify]
→ AI: "This looks like a STAKING_REWARD event for Cosmos (ATOM).
       For EUR value, you need CoinGecko price data for 2024-03-15."
→ Käyttäjä hyväksyy / muokkaa / hylkää
```

**ZK-yhteensopivuus:** AI-kutsu tapahtuu clientiltä suoraan Claude API:in — data ei kulje PrivateLedgern palvelimen kautta. Käyttäjälle selkeä opt-in: *"This transaction data will be sent to Claude AI for classification."*

---

## OSA 4: TOTEUTUSJÄRJESTYS (EHDOTUS)

```
SPRINT 1 (perusta kaupalliselle)
  → Hinnoittelumalli + Pro gating (blur-gate, add-ons)     [Feature 14 laajennus]
  → Onboarding: signup+vault yhdelle sivulle + maa-valinta [Feature 12 laajennus]
  → Settings-sivu siivous + Tax Profile -osio              [Feature 24]

SPRINT 2 (Finnish tax -pariteetti kryptoverotus.fi:n kanssa)
  → HMO-laskuri + lompakkokohtainen FIFO                   [Feature 25]
  → Transfer detection + review UI                         [Feature 25]
  → OmaVero copy-paste -opas                               [Feature 25]
  → Tax issue -filter TransactionsPage:lla                  [Feature 25]

SPRINT 3 (exchange-kattavuus)
  → Binance plugin (CSV + API)                             [Feature 13 Vaihe 2]
  → Kraken plugin                                          [Feature 13 Vaihe 2]
  → Import success -banneri + setup progress               [Feature 26]

SPRINT 4 (päivittäinen käyttökokemus)
  → ValueChart aikajännevalitsin                           [Feature 26]
  → 24h muutos % + P&L% per positio                       [Feature 26]
  → Sync-status indikaattori + sidebar-siivous             [Feature 26]
  → Alert badge dashboardilla                              [Feature 15]

SPRINT 5 (kasvu + markkinointi)
  → Domain + landing page (private-ledger.app)                 [Feature 27]
  → Suomenkielinen SEO-artikkeli                           [Feature 27]
  → AI transaction classification                          [Feature 28]
```

---

## OSA 5: AI-KEHITYSWORKFLOW

### 5.1 Käsitelty sessiossa 2026-03-17

**Mallistrategia (skill frontmatter):**
- `/spec-feature` → Opus (arkkitehtuuripäätökset, ei varaa oikaista)
- `/implement-feature` → Sonnet (hyvä tasapaino)
- `/fix-bugs` P0-P1 → Opus, P2-P3 → Sonnet
- `/frontend-design` → Sonnet
- `/update-session`, `/generate-feature-summary` → Haiku (mekaaniset tehtävät)
- Käyttäjä pitää Sonnetin oletuksena — skillit ylikirjoittavat automaattisesti

**Frontend-design + implement-feature -jako:**
- Feature jossa logiikkaa + UI → kaksi sessiota: ensin `/implement-feature` (core/API/store), sitten `/frontend-design` (UI)
- Puhdas UI-polish → suoraan `/frontend-design`
- Pelkkä UI-sivun ulkoasumuutos → `/frontend-design`

**CHEAT_SHEET auto-generointi — sääntö:**
- Generoi automaattisesti JOS: ei DB-migraatioita, max 2 pakettia, ei kriittisiä polkuja, lineaarinen toteutus
- ÄLÄ generoi JOS: vault/crypto/tax engine/lot engine mukana, DB-muutoksia, monimutkaisia riippuvuuksia

**Toteutettavat parannukset skilleihin:**
- [ ] `model:` frontmatter kaikkiin SKILL.md-tiedostoihin
- [ ] `implement-feature`: pakollinen "ymmärrän näin" -vahvistusvaihe ennen koodausta
- [ ] `implement-feature`: ohje UI-osuuden siirtämisestä `/frontend-design`-skillille
- [ ] `spec-feature`: automaattinen CHEAT_SHEET-generointi säännön mukaan
- [ ] `frontend-design`: PrivateLedger-spesifinen versio (design tokens, olemassaolevat komponentit, kielletyt patternit)
- [ ] `update-session`: SESSION_CONTEXT.md arkivointi kun yli 300 riviä
- [ ] CLAUDE.md split: CLAUDE.md core (~80r) + CLAUDE_UI.md + CLAUDE_API.md
- [ ] CI: forbidden pattern -grep (bg-surface-raised, hover:bg-white/[0.03] jne.)
- [ ] Coverage threshold: 30% → 50% → 70% @kp/core asteittain
- [ ] Visuaalinen regressiotestaus: Playwright snapshots kriittisille komponenteille

---

### 5.2 Avoimet aiheet — palaa tähän myöhemmin

Seuraavat aiheet tunnistettiin sessiossa mutta jätettiin käsittelemättä. Palaa näihin kun haluat jatkaa workflow-hiomista.

**A) Testausstrategia AI-generoidulle koodille**
- Mitkä testit ovat pakollisia ennen hyväksyntää?
- Mitkä optionaalisia?
- Milloin unit-testi riittää, milloin tarvitaan E2E?
- Miten testata ZK-kriittisiä polkuja (vault, crypto) luotettavasti?
- Kuinka paljon AI:n kirjoittamiin testeihin voi luottaa — testaavatko ne oikeaa asiaa?

**B) Breaking changes ja migraatiot AI:n kanssa**
- Miten hallita Dexie-versiomuutoksia turvallisesti?
- Neon-migraatioiden review-prosessi ennen ajoa tuotantoon?
- Miten estää AI:ta tekemästä breaking changeja vahingossa?
- Rollback-strategia jos AI:n tuottama migraatio menee pieleen?

**C) AI-generoidun koodin katselmointikäytäntö**
- Mitä tarkistaa manuaalisesti ennen hyväksyntää?
- Kriittiset polut joita ei saa hyväksyä katsomatta (vault, lot engine, tax engine)?
- Miten havaita "toimii mutta on väärin" -tapaukset (esim. väärä verolaskenta joka läpäisee testit)?
- Sopiva granulariteetti: kuinka iso muutos per sessio on turvallinen?

**D) Milloin EI käytä AI:ta**
- Tehtävät joissa manuaalinen on nopeampi tai turvallisempi
- Milloin AI:n ehdotukseen ei pidä luottaa ilman vahvistusta
- Turvallisuuskriittiset kohdat (crypto, avainten käsittely) — erityisvarovaisuus

**E) Ison featuren pilkkominen sessioihin**
- Optimaalinen session koko (liian iso = konteksti täyttyy, liian pieni = overhead)
- Miten jakaa riippuvuusketjut (core → platform → API → UI) tehokkaasti
- Miten estää sessioiden välinen "rikkinäinen välivaihe" jossa CI failaa

---

## YHTEENVETO: Tavoitearviot toteutuksen jälkeen

| Osa-alue | Nyt | Tavoite |
|---|---|---|
| AI-kehitysworkflow | 8.5/10 | 9/10 |
| Kaupallinen | 7/10 | 9/10 |
| UX | 7.5/10 | 9.5/10 |
