---
name: implement-feature
description: Start implementing a DocumentManager feature by number. Loads spec, cheat sheet, TODO, and coding conventions automatically.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent, TodoWrite
argument-hint: [feature-number]
---

# Implement Feature

Toteuta kryptoportfolio-v3 feature numeron perusteella.

## Vaihe 1: Lataa konteksti

Lue seuraavat tiedostot jarjestyksessa:

1. `docs/features/FEATURES_TODO.md` — Tarkista featuren nykytila
2. Etsi feature-speksi: `docs/features/$ARGUMENTS*.md` (esim. `docs/features/12_auth-vault-ux.md`)
3. Jos speksia ei loydy, ilmoita kayttajalle ja kysy haluaako luoda sen `docs/features/FEATURE_TEMPLATE.md` pohjalta
4. `docs/CODING_CONVENTIONS.md` — Koodauskaytannot
5. `docs/ISSUE_LOG.md` — Liittyvat bugit

## Vaihe 2: Lataa relevantti ADR

Etsi featuren ADR `docs/adr/` -kansiosta (numero loytyyy feature-speksista tai FEATURES_TODO:sta). Lue se.

## Vaihe 3: Jos feature-speksissa on CHEAT_SHEET.md tai TODO.md

Tarkista onko `docs/features/$ARGUMENTS_*/CHEAT_SHEET.md` tai `docs/features/$ARGUMENTS_*/TODO.md` olemassa. Jos on, lue ne.

## Vaihe 4: Suunnittele toteutus

Luo TodoWrite-tehtavalista vaiheittain:
- **Core domain** (`packages/core/src/`) — skeemat, logiikka
- **Platform** (`packages/platform-web/src/`) — DB, vault, sync
- **API** (`apps/api/src/routes/` + `functions/api/routes/`) — endpointit
- **Web UI** (`apps/web/src/`) — sivut, komponentit, hookit

Kysy kayttajalta vahvistus ennen toteutuksen aloittamista.

## Vaihe 5: Toteuta

Tyoskentele TodoWrite-listan mukaan. Jokaisen vaiheen jalkeen:
- Aja `pnpm test` (unit-testit)
- Merkitse tehtava valmiiksi

## Vaihe 6: Testaa kokonaisuus

```bash
pnpm test          # Unit-testit
pnpm test:e2e      # E2E-testit (jos muutoksia UI:hin tai API:hin)
```

## Vaihe 7: Paivita seurantadokumentit

1. `docs/features/FEATURES_TODO.md` — Merkitse feature valmiiksi, lisaa toteutuspaivamaara
2. `docs/ISSUE_LOG.md` — Paivita liittyvat bugit
3. `docs/SESSION_CONTEXT.md` — Lisaa muutosloki

## Argumentit

Kayta feature-numeroa: `/implement-feature 12` lataa Feature 12:n speksin.
