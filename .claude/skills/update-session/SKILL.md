---
name: update-session
description: Update SESSION_CONTEXT.md and related docs at end of session. Summarizes all changes made during the current session.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob
---

# Update Session

Paivita sessioseurantadokumentit session lopussa.

## Vaihe 1: Kartoita muutokset

Aja:
```bash
git diff --stat HEAD
git diff --name-only HEAD
git log --oneline -10
```

Tunnista:
- Uudet tiedostot
- Muutetut tiedostot
- Poistetut tiedostot
- Valmiiksi saadut featuret
- Korjatut bugit

## Vaihe 2: Paivita SESSION_CONTEXT.md

Muokkaa `docs/SESSION_CONTEXT.md`:

1. Paivita **Projektin nykytila** -osio vastaamaan tata hetkea:
   - Valmiit ominaisuudet
   - Avoimet bugit (tarkista ISSUE_LOG.md)
   - Teknisen velan tila
   - Seuraava tyovaihe

2. Lisaa uusi merkinta **Muutosloki**-osioon:

```markdown
### YYYY-MM-DD — [Lyhyt kuvaus]
**Luotu:**
- tiedosto1.ts — kuvaus
- tiedosto2.ts — kuvaus

**Muutettu:**
- tiedosto3.ts — mita muutettiin

**Testitulos:** Unit X/X ✅, E2E Y/Z ✅/❌
```

## Vaihe 3: Paivita FEATURES_TODO.md

Jos featureita valmistui tai edistyi:
1. Lue `docs/features/FEATURES_TODO.md`
2. Paivita featuren status (📋 → 🔧 → ✅)
3. Lisaa toteutuspaivamaara ja merkitse tehtavat valmiiksi

## Vaihe 4: Paivita ISSUE_LOG.md

Jos bugeja korjattiin:
1. Lue `docs/ISSUE_LOG.md`
2. Merkitse bugi korjatuksi (paivamaara + lyhyt kuvaus)
3. Poista FEATURES_TODO:n "Avoimet bugit" -viittaus jos kaikki korjattu

## Vaihe 5: Tarkista konsistenssi

Varmista etta:
- SESSION_CONTEXT viittaa oikeisiin feature-numeroihin
- FEATURES_TODO:n statukset vastaavat todellisuutta
- ISSUE_LOG:n statukset vastaavat todellisuutta
- Seuraava tyovaihe on jarkevatesti jarjestyksessa
