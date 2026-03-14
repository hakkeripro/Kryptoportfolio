---
name: fix-bugs
description: Fix bugs for a DocumentManager feature using its BUG_REPORT. Prioritizes critical bugs first.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, TodoWrite
argument-hint: [bug-id or priority]
---

# Fix Bugs

Korjaa kryptoportfolio-v3 bugeja prioriteettijarjestyksessa.

## Vaihe 1: Lataa bugilista

Lue `docs/ISSUE_LOG.md` ja tunnista avoimet bugit.

Jarjesta prioriteetin mukaan:
- **P0** (Kriittinen): Korjaa heti — estaa perustoiminnallisuuden
- **P1** (Korkea): UX-ongelma — toimii mutta huonosti
- **P2** (Keskitaso): Hairitseva — ei estaa kayttoa
- **P3** (Matala): Kosmeettinen

Jos argumentti annettu (`$ARGUMENTS`), suodata:
- Bug-ID:lla (esim. `KP-UI-002`)
- Prioriteetilla (esim. `P0`, `P1`)
- Avainsanalla (esim. `auth`, `sync`, `alerts`)

## Vaihe 2: Analysoi bugi

Jokaiselle bugille:
1. Lue kuvaus ja reproduktiopolku ISSUE_LOG:sta
2. Etsi relevantti koodi (`Grep` + `Glob`)
3. Ymmarra juurisyy — ala arvaa, lue koodi
4. Tarkista liittyvatko muut bugit samaan juurisyyhyn

## Vaihe 3: Kirjoita testi (jos mahdollista)

Ennen korjausta, lisaa epaonnistuva testi joka todistaa bugin:
- Unit-testi `packages/core/src/**/__tests__/` tai `*.test.ts`
- Tai E2E-testi `apps/web/tests-e2e/`

```bash
pnpm test -- --grep "bugin kuvaus"
```

## Vaihe 4: Korjaa

- Korjaa juurisyy (ei oireita)
- Pidä muutokset minimaalisina
- Noudata `docs/CODING_CONVENTIONS.md`

## Vaihe 5: Varmista

```bash
pnpm test          # Kaikki unit-testit
pnpm test:e2e      # E2E jos muutoksia UI/API
```

## Vaihe 6: Paivita dokumentaatio

1. `docs/ISSUE_LOG.md` — Merkitse bugi korjatuksi (paivamaara + kuvaus korjauksesta)
2. `docs/SESSION_CONTEXT.md` — Lisaa muutoslokiin

## Argumentit

- `/fix-bugs` — Korjaa seuraava avoinna oleva bugi prioriteettijarjestyksessa
- `/fix-bugs KP-UI-002` — Korjaa tietty bugi
- `/fix-bugs P1` — Korjaa kaikki P1-bugit
