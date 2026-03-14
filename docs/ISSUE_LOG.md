# Issue log (bugit + tuoteaukot)

Päivitetty: 2026-01-06

Prioriteetit:
- **P0** = estää käytön / rikkoo peruspolun / data integrity / turvallisuus
- **P1** = merkittävä käyttökokemus- tai luottamusongelma
- **P2** = häiritsevä / vaatii kiertotien
- **P3** = kosmeettinen / ylläpito

## P0

### ~~KP-UI-001: Vault passphrase ei pysy muistissa edes yhden istunnon ajan~~ ✅ KORJATTU
**Oire:** onboardingissa luodun vaultin jälkeen refresh tai reitti-/reload voi vaatia passphrasea uudelleen.
**Syy (kooditaso):** onboarding luo vaultin, mutta passphrasea ei talleteta `sessionStorage`en avaimella `KP_VAULT_PASSPHRASE_SESSION`.
**Vaikutus:** onboarding koetaan epäloogiseksi ja turhauttavaksi.
**Korjaus:** `useVaultStore.setupVault()` tallentaa passphrasen sessionStorageen (`rememberSessionPassphrase`), ja `loadVaultStatus()` palauttaa sen reloadissa. E2e-testi: `smoke.spec.ts` “KP-UI-001”.
**Korjattu:** 2026-03-14

### ~~KP-UI-002: Price auto-refresh ei käynnisty (asetukset haetaan väärällä ID:llä)~~ ✅ KORJATTU
**Syy:** `PriceAutoRefresh.tsx` haki `db.settings.get('settings')`, mutta käytössä oli `settings_1`.
**Vaikutus:** hinnat eivät päivittyneet automaattisesti → “hinnat väärin / stale”.
**Korjaus:** Settings-avain korjattu kaikkialle (`settings_1`), `ensureDefaultSettings()` migroi vanhan avaimen. “Last price update” UI DashboardPage:lla. DashboardPage:n duplikaatti auto-refresh timer poistettu (PriceAutoRefresh hoitaa globaalin).
**Korjattu:** 2026-03-14

### ~~KP-ALERT-001: “Enable server alerts” voi tyhjentää server-alertit ja/tai ei persistoidu oikein~~ ✅ KORJATTU
**Syy:** settings-sivu voi kutsua enable-endpointia tyhjällä alert-listalla → server tekee `DELETE` + insert (0 kpl) = kaikki pois.
**Vaikutus:** käyttäjä kokee että hälytykset “ei toimi” tai “asetus ei pysy”.
**Korjaus:** AlertsPage: eroteltu kaksi toimintoa: “Sync rules to server” (replace-mode, vaatii confirm jos 0 alerttia) ja “Enable delivery” (enable_only-mode, ei koske olemassa oleviin sääntöihin). E2E-testi päivitetty.
**Korjattu:** 2026-03-14

### ~~KP-IMPORT-001: Coinbase JSON key -flow ristiriidassa UI-validoinnin kanssa~~ ✅ KORJATTU
**Oire:** docs/tausta tukee JSON-keyfilea, mutta UI vaatii `keyName`/kenttiä.
**Korjaus:** ImportsPage: private key -kenttä tunnistaa JSON key file -sisällön automaattisesti. Paste-JSON extractaa `name`/`keyName` → keyName-kenttään ja `privateKey`/`private_key`/`key_secret`/`api_secret` → PEM-kenttään. Escaped newlines normalisoidaan. Placeholder päivitetty ohjeistamaan JSON-paste.
**Korjattu:** 2026-03-14

## P1

### KP-UX-001: Onboarding/login/passphrase -malli epäselvä multi-device-käytössä
**Oire:** “miksi login + passphrase?” ja “miksi tämä ei toimi sekä mobiilissa että desktopissa järkevästi?”  
**Korjaus:** ota käyttöön Passkey/WebAuthn (device convenience) + *yksi Vault Passphrase per käyttäjä* (“universal unlock / recovery”).

### KP-ALERT-002: Hälytyksien välitys ei toimi tuotannossa
**Hypoteeseja:** VAPID env puuttuu, runner/cron ei käy, push permission/HTTPS, tai KP-ALERT-001 tyhjensi säännöt.  
**Korjaus:** diagnostiikka UI (VAPID ok? subscription ok? server rules count?), sekä “Test notification”.

### KP-UI-003: Imports-sivu sekamelska eikä skaalaudu tuleville integroinneille
**Korjaus:** siirry provider-registry UI:hin + connect wizard (API ensisijainen, CSV toissijainen).

### KP-DATA-001: Asset mapping vaatii liikaa manuaalityötä
**Korjaus:** auto-suggest (CoinGecko symbol search) + user override; mapping queue UX säilyy.

### KP-TAX-001: Verolaskelmat: maille sopivuus epäselvä + Suomen hankintameno-olettama puuttuu
**Korjaus:** tax profile UI (“Country”) + selkeä disclaimer + FI: hankintameno-olettama optiona.

## P2 / P3

- KP-UI-004: Token ikonit puuttuvat laajasti (UX polish)
- KP-BRAND-001: Logo + värimaailma eivät ole yhtenäisiä kaikkialla
- KP-UI-005: Sync-nappi epäselvä (ei selitystä eikä tulosraporttia)
- KP-MAINT-001: Kuolleita/tuplakomponentteja (layout) → siivous
