---
name: spec-feature
description: Create or update a feature specification before implementation. Analyzes requirements, existing code, ADRs, and produces a complete spec document.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Glob, Grep, Agent
argument-hint: [feature-number]
---

# Spec Feature

Luo tai paivita feature-speksi ENNEN toteutusta. Tama on pakollinen vaihe — koodia ei kirjoiteta ilman speksia.

## Vaihe 1: Keraa konteksti

1. Lue `docs/features/FEATURES_TODO.md` — featuren nykyinen kuvaus ja status
2. Lue relevantti ADR `docs/adr/` -kansiosta (jos viitattu)
3. Lue `docs/CODING_CONVENTIONS.md` — nimeamiskaytannot ja arkkitehtuuri
4. Lue `docs/ISSUE_LOG.md` — liittyvat bugit
5. Tutki olemassa oleva koodi: mita on jo toteutettu, mita rajapintoja on kaytossa

## Vaihe 2: Analysoi ja kysy

Ennen speksin kirjoittamista, kysy kayttajalta:

1. **Scope:** Mika on featuren MVP? Mita EI kuulu tahan versioon?
2. **Reunaehdot:** Onko erityisvaatimuksia (suorituskyky, turvallisuus, yhteensopivuus)?
3. **UI:** Onko mockupeja tai wireframeja? Millainen UX-flow?
4. **Prioriteetti:** Mikä on aikataulu? Onko riippuvuuksia muihin featureihin?

Jos kayttaja on jo antanut nama tiedot (esim. ADR tai backlog-kuvaus), tiivista ne ja kysy vahvistus.

## Vaihe 3: Kirjoita speksi

Kayta pohjana `docs/features/FEATURE_TEMPLATE.md`. Kirjoita tiedostoon `docs/features/$ARGUMENTS_nimi.md`.

Speksin PITAA sisaltaa:

### Pakolliset osiot
1. **Tavoite** — 1-3 lausetta: MITA ja MIKSI
2. **Vaatimukset** — Konkreettinen checklist (ei "paranna UX:aa" vaan "lisaa virheviesti kun salasana vaara")
3. **Tekninen suunnitelma** — Neliosainen:
   - **Domain** (`packages/core/`): skeemat, funktiot, validoinnit
   - **Platform** (`packages/platform-web/`): DB-muutokset, vault, sync
   - **API** (`apps/api/` + `functions/`): endpointit, migraatiot
   - **Web** (`apps/web/`): sivut, komponentit, store, routing
4. **Testaussuunnitelma** — Mita unit-testeja ja E2E-testeja tarvitaan
5. **Riippuvuudet** — Muut featuret, bugit, ulkoiset palvelut

### Vapaavalintaiset osiot
- UI-suunnitelma (mockupit, flow-kuvaukset)
- Riskit/rajoitteet
- Migraatiopolku (jos muuttaa olemassa olevaa dataa)
- Deploy-ohjeet

## Vaihe 4: Validoi speksi

Tarkista etta:
- [ ] Jokainen vaatimus on testattavissa (ei "parempi" vaan "alle 200ms")
- [ ] Tekninen suunnitelma kattaa kaikki tarvittavat paketit
- [ ] Ei riko olemassa olevia ADR-paatoksia (zero-knowledge, append-only, jne.)
- [ ] Riippuvuudet on listattu ja ne ovat valmiita
- [ ] Testaussuunnitelma kattaa happy path + virhepolut

## Vaihe 5: Paivita seuranta

1. `docs/features/FEATURES_TODO.md` — Paivita featuren status: 📋 SUUNNITTEILLA, lisaa speksi-viittaus
2. Kerro kayttajalle: "Speksi valmis, voit aloittaa toteutuksen komennolla `/implement-feature $ARGUMENTS`"

## Argumentit

`/spec-feature 12` — Luo tai paivita Feature 12:n speksi.
