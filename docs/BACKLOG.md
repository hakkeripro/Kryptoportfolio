# Backlog (halutut ominaisuudet & optiot)

Päivitetty: 2026-01-06

Tämä backlog yhdistää:
- käyttäjän havainnot ja toiveet
- koodista löydetyt aukot (Issue log)
- tuotteen “v3 next” -prioriteetit

## Tavoite seuraavalle versiolle (v3.next)

- Onboarding ja login ovat **yksiselitteisiä**: yksi tili + yksi Vault Passphrase, Passkey tekee käytöstä “normaalin”.
- Hälytykset toimivat luotettavasti (device + server).
- Imports UI skaalautuu uusille providereille (Binance/MEXC/Bitvavo/Ledger/MetaMask).
- Branding + token ikonit yhtenäiset.
- Maksulliset ominaisuudet (billing + feature gating) huomioitu.

---

## P0 — toteutetaan ensin (blokkerit)

1) **Auth/Vault UX (Passkey + yksi passphrase per käyttäjä)**
- Ks. `UI_MOCK_SPEC.md` ja `adr/ADR-018-auth-vault-ux.md`
- Korjaa session passphrase bugi (KP-UI-001)

2) **Prices freshness**
- Korjaa auto-refresh settings key (KP-UI-002)
- Näytä “Last price update” ja manuaalinen refresh

3) **Server alerts stability**
- Korjaa enable/replace semantics (KP-ALERT-001)
- Lisää diagnostiikka ja “Test notification”

---

## P1 — “tuote tuntuu valmiilta” (MVP+)

### Dashboard: Alert popup per positio
- “⏰” ikoni jokaiselle positiolle
- “Create alert” modal (price/allocation/P&L)

### Token ikonit koko sovellukseen
- Asset catalogiin `iconUrl` (cache)
- Fallback: letter avatar

### Branding
- Yksi lähde totuudelle: logo + `--brand-gradient`
- App icon (PWA + web): 1024 master + exports

### Imports UI → provider registry + wizard
- API ensisijainen, CSV toissijainen
- Coinbase, Binance, MEXC, Bitvavo, Ledger, MetaMask

### Account-sivu
- Security: passkeys, change password, change vault passphrase
- Devices / sessions
- Billing status (free/premium placeholder)

### Settings UX
- “API base URL” vain Advanced/Dev, selitetty
- “Enable server alerts” persistoi ja näyttää tilan

---

## P2 — Strategy osio valmiiksi

MVP:
- Target allocation
- Drift alert (“alert when drift > X%”)
- Rebalance suggestions (paper)
- Selkeä raja: ei automaattisia tradeja tässä vaiheessa

---

## P3 — Maksulliset ominaisuudet (tärkeä huomioida heti)

- Planit: Free / Premium
- Feature gating (UI + backend)
- Stripe-integraatio (tai stub) + “Upgrade” UI
- Mitkä ominaisuudet maksullisia (ehdotus):
  - Server alerts (rajoitettu free)
  - Strategy advanced rules
  - Multi-exchange autosync / scheduled sync
  - Export/reporting

---

## Optio (Later): AI integraatio + automaattinen treidaus

**Tavoite:** kaupallisesti turvallinen ja laillinen toteutus.

Rajat:
- Aloita “AI insights” (ei toimeksiantoja)
- “Auto-trading” vain erillisellä opt-inillä + riskivaroitukset + audit log
- Ensisijainen pörssi: MEXC (jos API helpoin), mutta tarkistettava:
  - käyttöehdot, alueellinen sääntely, ja “investment advice” -rajat

Ks. ADR-015 (trading bot option) + uusi toteutussuunnitelma ADR:llä, jos päätetään edetä.
