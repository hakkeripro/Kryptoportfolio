# Issue log (bugit + tuoteaukot)

Päivitetty: 2026-01-06

Prioriteetit:
- **P0** = estää käytön / rikkoo peruspolun / data integrity / turvallisuus
- **P1** = merkittävä käyttökokemus- tai luottamusongelma
- **P2** = häiritsevä / vaatii kiertotien
- **P3** = kosmeettinen / ylläpito

## P0

### KP-UI-001: Vault passphrase ei pysy muistissa edes yhden istunnon ajan
**Oire:** onboardingissa luodun vaultin jälkeen refresh tai reitti-/reload voi vaatia passphrasea uudelleen.  
**Syy (kooditaso):** onboarding luo vaultin, mutta passphrasea ei talleteta `sessionStorage`en avaimella `KP_VAULT_PASSPHRASE_SESSION`.  
**Vaikutus:** onboarding koetaan epäloogiseksi ja turhauttavaksi.  
**Korjaus:** tallenna passphrase sessioniin onnistuneen setupin jälkeen (tai Passkey unlock -polku), ja lisää “Unlock your vault” -selitys.

### KP-UI-002: Price auto-refresh ei käynnisty (asetukset haetaan väärällä ID:llä)
**Syy:** `PriceAutoRefresh.tsx` hakee `db.settings.get('settings')`, mutta käytössä on `settings_1`.  
**Vaikutus:** hinnat eivät päivity automaattisesti → “hinnat väärin / stale”.  
**Korjaus:** korjaa avain + lisää näkyvä “Last price update” UI:hin.

### KP-ALERT-001: “Enable server alerts” voi tyhjentää server-alertit ja/tai ei persistoidu oikein
**Syy:** settings-sivu voi kutsua enable-endpointia tyhjällä alert-listalla → server tekee `DELETE` + insert (0 kpl) = kaikki pois.  
**Vaikutus:** käyttäjä kokee että hälytykset “ei toimi” tai “asetus ei pysy”.  
**Korjaus:** erottele “enable” vs “replace rules”; älä ikinä lähetä tyhjää listaa ilman explicit “reset”; persistoi tila.

### KP-IMPORT-001: Coinbase JSON key -flow ristiriidassa UI-validoinnin kanssa
**Oire:** docs/tausta tukee JSON-keyfilea, mutta UI vaatii `keyName`/kenttiä.  
**Korjaus:** hyväksy JSON paste UI:ssa ja extractaa `keyName/privateKey` automaattisesti; anna selkeä copy.

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
