# Next steps

Päivitetty: 2026-01-06

Tämä tiedosto on “korkean tason” ohjain. Tarkemmat listat löytyvät:
- **Bugit ja tuoteaukot:** `docs/ISSUE_LOG.md`
- **Backlog & prioriteetit:** `docs/BACKLOG.md`
- **UI-spec + acceptance:** `docs/UI_MOCK_SPEC.md` ja `docs/UX_ACCEPTANCE_CRITERIA.md`

## Recommended order (v3.next)

1) Auth/Vault UX (Passkey + yksi Vault Passphrase per käyttäjä) + fixit (KP-UI-001)
2) Prices freshness (KP-UI-002) + “Last price update”
3) Alerts reliability (KP-ALERT-001) + diagnostiikka + test notification
4) Imports registry + wizard (Binance/MEXC/Bitvavo/Ledger/MetaMask)
5) Branding + token ikonit
6) Strategy MVP
7) Billing stub + feature gating

## Definition of Done (next release)

- Multi-device: sama vault passphrase toimii (desktop + mobile)
- Hälytykset: device + server toimivat ja diagnostiikka kertoo tilanteen
- Imports: uusi provider lisättävissä ilman imports root UI -refaktoria
- Premium: feature gating näkyy ja toimii (stub riittää)
