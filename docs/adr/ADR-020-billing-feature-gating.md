# ADR-020 Billing + feature gating (maksulliset ominaisuudet)

**Status:** Proposed  
**Date:** 2026-01-06

## Context

Seuraavaan versioon on tärkeää huomioida maksulliset ominaisuudet.
Tavoite: lisätä premium ilman että free-käyttäjien UX hajoaa.

## Decision

- Määritellään “Plan” (Free / Premium) ja gating-kerros:
  - UI: näyttää badge + upgrade modal
  - Backend: varmistaa server-puolen premium-toiminnot (esim. server alerts rajoitteet)
- Implementaatio vaiheittain:
  1) Stub plan locally + hosted (no Stripe yet)
  2) Lisää upgrade UI + feature flags
  3) Lisää Stripe (tai muu) vasta kun MVP on vakaa

## Consequences

- Tarvitaan yksi paikka feature-kyselylle (hook / selector)
- Riskinä “premium creep” jos gating ei ole selkeä
- Docs: kirjaa mitkä ominaisuudet premium

## References

- `docs/BACKLOG.md`
- `docs/AI_HANDOFF.md` (päivitetään)
