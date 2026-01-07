# ADR-019 Imports plugin registry (provider grid + wizard)

**Status:** Proposed  
**Date:** 2026-01-06

## Context

Imports-sivu on tällä hetkellä Coinbase-keskeinen ja UI on vaikea laajentaa.
Seuraavaan versioon halutaan ainakin:
- Binance, MEXC, Bitvavo, Ledger, MetaMask (API ensisijainen, CSV toissijainen)

Tarvitaan rakenne, jossa uusien providerien lisääminen ei riko UI:ta eikä vaadi massiivista refaktorointia.

## Decision

- Rakennetaan “provider registry”:
  - lista providereista (id, name, icon, methods, status hooks)
- Imports root näyttää provider gridin dynaamisesti registrystä.
- Provider connect flow on yhteinen wizard-runkokomponentti:
  - step: method (API default)
  - step: credentials + test
  - step: options
  - step: first sync + summary
- Backend: yhtenäinen interface `ExchangeIntegration` (API) + `CsvImport` (secondary).

## Consequences

- UI ja backend skaalautuvat uusiin importteihin
- Tarvitaan standardi: “test connection” ja “first sync” -telemetria
- Docs: päivitä `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md` tarvittaessa

## References

- `docs/UI_MOCK_SPEC.md` (Imports)
- `docs/BACKLOG.md`
- ADR-012 Imports normalize ledger
