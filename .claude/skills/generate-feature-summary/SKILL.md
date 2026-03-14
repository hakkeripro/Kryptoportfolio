---
name: generate-feature-summary
description: Generate compact summary files (CHEAT_SHEET.md and TODO.md) from feature specifications to manage context length and prevent prompt overflow
disable-model-invocation: true
allowed-tools: Read, Write, Glob, Grep
argument-hint: [feature-number]
---

# Generate Feature Summary

Luo tiivistetyt CHEAT_SHEET.md ja TODO.md feature-speksista. Nama tiedostot auttavat pitamaan kontekstin kompaktina toteutuksen aikana.

## Vaihe 1: Lataa feature-speksi

1. Etsi speksi: `docs/features/$ARGUMENTS*.md`
2. Jos ei loydy, listaa saatavilla olevat speksit ja kysy kayttajalta
3. Lue speksi kokonaan

## Vaihe 2: Luo CHEAT_SHEET.md

Kirjoita `docs/features/$ARGUMENTS_nimi/CHEAT_SHEET.md`:

```markdown
# Feature XX: Nimi — Cheat Sheet

## Ydinidea
[1-2 lausetta: mika on featuren tarkoitus]

## Skeemat
[Listaa uudet/muutetut Zod-skeemat kenttineen — vain oleellisimmat]

## API-endpointit
[Listaa uudet/muutetut endpointit: metodi, polku, request/response]

## Kriittiset polut
[Tiedostot jotka PITAA muuttaa — ei "nice to have"]

## Reunaehdot
[ADR-rajoitteet, turvallisuusvaatimukset, yhteensopivuus]

## Testausvaatimukset
[Mita testeja PITAA olla ennen kuin feature on valmis]
```

Pidä alle 80 rivia. Tiivista armottomasti — tama on muistilappu, ei speksi.

## Vaihe 3: Luo TODO.md

Kirjoita `docs/features/$ARGUMENTS_nimi/TODO.md`:

```markdown
# Feature XX: Nimi — TODO

## Core domain
- [ ] Tehtava 1 (`polku/tiedosto.ts`)
- [ ] Tehtava 2

## Platform
- [ ] Tehtava 3

## API
- [ ] Tehtava 4

## Web UI
- [ ] Tehtava 5

## Testit
- [ ] Unit: kuvaus
- [ ] E2E: kuvaus

## Dokumentaatio
- [ ] FEATURES_TODO.md paivitys
- [ ] SESSION_CONTEXT.md paivitys
```

Jokainen tehtava on konkreettinen, yksikasitteinen ja sisaltaa tiedostopolun.

## Argumentit

`/generate-feature-summary 12` — Luo tiivistelman Feature 12:sta.
