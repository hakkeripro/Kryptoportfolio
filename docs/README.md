# Docs index

Tämä kansio on **source of truth** projektin nykytilasta, löydetyistä ongelmista ja seuraavista toteutuksista.

## Aloita tästä

- **PROJECT_STATE.md** — nykytila + miten ajetaan local/hosted
- **ISSUE_LOG.md** — bugit + tuoteaukot (priorisoitu)
- **BACKLOG.md** — halutut ominaisuudet ja toteutusjärjestys
- **UI_MOCK_SPEC.md** — ruutu/flow-mockit (tekstiwireframe) uusille UX-muutoksille
- **UX_ACCEPTANCE_CRITERIA.md** — hyväksymiskriteerit UI-mockeille

## Arkkitehtuuripäätökset (ADR)

- `docs/adr/*` (mm. E2E sync, alerts, imports)
- Uudet päätökset:
  - ADR-018: Auth + Vault UX (Passkey + yksi Vault Passphrase per käyttäjä)
  - ADR-019: Imports plugin registry (Binance/MEXC/Bitvavo/Ledger/MetaMask…)
  - ADR-020: Billing + feature gating (maksulliset ominaisuudet)

## Integraatiot

- `docs/integrations/coinbase.md`
- `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md` (miten lisätään uusi import)
