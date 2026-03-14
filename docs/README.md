# Docs index

Tama kansio sisaltaa projektin dokumentaation.

## Aloita tasta

- **[../CLAUDE.md](../CLAUDE.md)** — AI-kehitysohjeet, monorepo-rakenne, komennot, kriittiset polut
- **[SESSION_CONTEXT.md](SESSION_CONTEXT.md)** — Muutosloki + aktiivinen tila
- **[features/FEATURES_TODO.md](features/FEATURES_TODO.md)** — Kaikkien featureiden ja teknisen velan status
- **[ISSUE_LOG.md](ISSUE_LOG.md)** — Bugit + tuoteaukot (priorisoitu)
- **[BACKLOG.md](BACKLOG.md)** — Halutut ominaisuudet ja toteutusjarjestys

## Feature-speksit

- `docs/features/` — Feature-kohtaiset speksit (kayta `FEATURE_TEMPLATE.md` pohjana)
- **[UI_MOCK_SPEC.md](UI_MOCK_SPEC.md)** — Ruutu/flow-mockit (tekstiwireframe)
- **[UX_ACCEPTANCE_CRITERIA.md](UX_ACCEPTANCE_CRITERIA.md)** — Hyvaksymiskriteerit UI-mockeille

## Arkkitehtuuripaatokset (ADR)

- `docs/adr/*` — 20 ADR:aa (mm. E2E sync, alerts, imports, billing)
- Tarkeimmat: ADR-001 (monorepo), ADR-002 (append-only ledger), ADR-011 (E2E encryption), ADR-018 (auth/vault UX), ADR-019 (imports registry), ADR-020 (billing)

## Integraatiot

- **[integrations/coinbase.md](integrations/coinbase.md)** — Coinbase-import speksi
- **[EXCHANGE_INTEGRATION_PLAYBOOK.md](EXCHANGE_INTEGRATION_PLAYBOOK.md)** — Miten lisataan uusi import-provider

## Hosted (Cloudflare + Neon)

- **[hosted-mvp-cloudflare-pages.md](hosted-mvp-cloudflare-pages.md)** — Hosted-ympariston yleiskuvaus
- **[hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md](hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md)** — Staging deploy
- **[hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md](hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md)** — Alerts + web push

## Koodauskaytannot

- **[CODING_CONVENTIONS.md](CODING_CONVENTIONS.md)** — Koodauskaytannot (aina koodia kirjoittaessa)
