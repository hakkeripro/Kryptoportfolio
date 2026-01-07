# Prompt for next AI (implementation)

Päivitetty: 2026-01-06

Käytä tätä promptia, kun seuraava AI alkaa toteuttaa koodimuutoksia docsien perusteella.

---

OLET TYÖSKENTELEMÄSSÄ Kryptoportfolio v3 -monorepon kanssa (pnpm). Tavoite: toteuta UX ja toiminnallisuus docsien mukaan ja pidä testit vihreänä.

LUE ENSIN
- `docs/PROJECT_STATE.md`
- `docs/ISSUE_LOG.md`
- `docs/BACKLOG.md`
- `docs/UI_MOCK_SPEC.md`
- `docs/UX_ACCEPTANCE_CRITERIA.md`
- `docs/adr/ADR-018-auth-vault-ux.md`
- `docs/adr/ADR-019-imports-plugin-registry.md`
- `docs/adr/ADR-020-billing-feature-gating.md`
- `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md`
- Hosted: `docs/hosted-mvp-cloudflare-pages.md` + `docs/hosted/*`

PRIORITEETIT
1) Korjaa P0-bugit:
   - KP-UI-001: vault passphrase session bug
   - KP-UI-002: price auto-refresh settings key mismatch
   - KP-ALERT-001: server alerts enable/replace semantics
2) Toteuta uusi Auth/Vault UX:
   - Passkey/WebAuthn
   - **yksi Vault Passphrase per käyttäjä**, toimii kaikilla laitteilla
   - UI copy selkeäksi (miksi passphrase on olemassa)
3) Dashboard: ⏰ alert popup jokaiselle positiolle
4) Imports: provider registry + wizard; valmistele uudet providerit (Binance/MEXC/Bitvavo/Ledger/MetaMask)
5) Branding + token ikonit
6) Strategy MVP
7) Billing stub + feature gating

VAATIMUS: KOMENNOT JA VERIFIOINTI
Kun lisäät ominaisuuden tai korjaat bugin:
- Anna aina komennot (install/build/test/dev)
- Lisää lyhyt “How to verify” (smoke steps)
- Jos Windows-erot, anna PowerShell/CMD vaihtoehdot.

TOIMITA LOPUSSA
- Lista tehdyistä muutoksista (viitaten KP-…)
- Muutetut ENV:t ja deploy-ohjeet
- Riskit/rajoitteet
