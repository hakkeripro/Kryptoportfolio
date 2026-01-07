# ADR-018 Auth + Vault UX (Passkey + yksi Vault Passphrase per käyttäjä)

**Status:** Proposed  
**Date:** 2026-01-06

## Context

Nykyinen UX vaatii käyttäjältä:
- login (email+password) ja
- erillisen Vault Passphrase -syötön (vault unlock)

Lisäksi havaittiin bugi: passphrase ei tallennu edes yhden istunnon ajaksi (KP-UI-001), mikä tekee onboardingista epäloogisen.

Käyttäjätarve:
- sama tili käytössä usealla laitteella (mobiili + desktop)
- **yksi Vault Passphrase per käyttäjä**, jolla data avautuu missä tahansa
- login-prosessin oltava “normaali” ja selkeä

## Decision

1) Säilytetään “zero-knowledge” malli:
- server ei näe plaintextia
- vault data on E2E-salattua

2) Määritellään **yksi Vault Passphrase per käyttäjä**:
- luodaan ensimmäisessä setupissa
- toimii universal unlock/recovery -keinona kaikilla laitteilla

3) Lisätään **Passkey/WebAuthn** “device convenience” -tavaksi:
- käyttäjä voi avata vaultin ilman passphrase-typingä
- passkey on laitekohtainen ja voidaan lisätä/poistaa Account → Security

4) Korjataan session UX:
- onnistuneen setupin jälkeen vault passphrase tallennetaan sessioniin (vähintään sessionStorage), jotta ensikäyttö ei katkea reloadiin.

## Consequences

- Parempi UX multi-device-käytössä (yksi passphrase, passkey helpottaa)
- Tarvitaan passkey management UI (list/add/remove)
- Tarvitaan selkeä copy: “miksi vault passphrase on olemassa”
- Security: passphrasea ei tallenneta pysyvästi ilman käyttäjän explicit opt-iniä (ei “remember forever” oletuksena)

## References

- `docs/UI_MOCK_SPEC.md`
- `docs/UX_ACCEPTANCE_CRITERIA.md`
- ADR-011 Sync E2E encryption
