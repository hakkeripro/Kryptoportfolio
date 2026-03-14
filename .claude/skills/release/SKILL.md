---
name: release
description: Full release pipeline — local checks, preview deploy, monitoring, DB migrations, production deploy with rollback plan.
disable-model-invocation: true
allowed-tools: Read, Write, Edit, Bash, Grep, Glob, Agent, TodoWrite, WebFetch
---

# Release Pipeline

Taysi julkaisupipeline: tarkistukset → preview → seuranta → DB-migraatiot → tuotanto → vahvistus.

**TARKEA:** Tuotantoon ei koskaan deployta suoraan. Preview-deploy + seuranta AINA ensin.

## Vaihe 0: Esitarkistukset

### 0a. Tarkista lahtotilanne

```bash
git status
git log --oneline -20
git branch --show-current
```

Varmista:
- Tyohakemisto on puhdas (ei uncommitattuja muutoksia) — jos on, kysy kayttajalta haluaako commitoida ensin
- Olet oikealla branchilla (tyypillisesti `main` tai feature-branch)

### 0b. Kartoita muutokset edellisesta releasesta

```bash
# Viimeisin tagi tai tuotanto-commit
git log --oneline $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD
git diff --stat $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD
```

Raportoi kayttajalle:
- Montako committia
- Mita tiedostoja muutettu (erityisesti: core, API, functions, migrations)
- Onko DB-migraatioita (`scripts/migrations/*.sql` muuttunut)
- Onko wrangler-konfiguraatioita muutettu

## Vaihe 1: Paikallinen laadunvarmistus

Aja kaikki CI-tarkistukset paikallisesti:

```bash
# Riippuvuudet
pnpm install

# Buildaa
pnpm build:deps
pnpm --filter @kp/web build

# Tyypitarkistus
pnpm typecheck

# Lint + format
pnpm lint
pnpm format

# Unit-testit + coverage
pnpm test

# Bundle-koko
pnpm size
```

Jos jokin failaa:
1. **Tyyppivirheet / lint** → Korjaa ja commitoi
2. **Testit failaa** → Korjaa, aja uudelleen, commitoi
3. **Bundle liian iso** → Raportoi kayttajalle, ala jatka ennen ratkaisua

## Vaihe 2: Tunnista DB-migraatiot

Tarkista onko DB-muutoksia:

```bash
# Onko uusia migraatioita?
git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD -- scripts/migrations/
git diff --name-only $(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~10)..HEAD -- functions/_lib/db.ts
```

Jos DB-muutoksia loytyy:

1. Lue muutetut migraatiotiedostot (`scripts/migrations/*.sql`)
2. Lue `functions/_lib/db.ts` — tarkista HOSTED_SCHEMA_SQL
3. Aja `pnpm schema:hosted:file` — varmista generoidun skeeman ajantasaisuus
4. **NAYTA migraatio-SQL kayttajalle** ja kysy vahvistus

**HUOM:** Migraatiot ajetaan **migration runnerilla** — ei manuaalisesti.

### 2a. Tarkista migraatioiden tila

```bash
# Tarkista mita migraatioita on odottamassa
DATABASE_URL="$DATABASE_URL" pnpm migrate:status
```

## Vaihe 3: Preview-deploy

### 3a. Pushaa koodi

```bash
git push origin $(git branch --show-current)
```

### 3b. Tarkista CI-putki

```bash
# Seuraa GitHub Actions -ajoa
gh run list --limit 5
gh run watch  # Odota uusin ajo loppuun
```

Jos CI failaa:
- Lue lokitiedot: `gh run view --log-failed`
- Korjaa ongelma, commitoi, pushaa uudelleen
- Toista kunnes CI on vihrea

### 3c. Tarkista Cloudflare preview

Cloudflare Pages luo automaattisesti preview-deployn jokaiselle branchille.

```bash
# Preview URL: https://<branch>.kryptoportfolio.pages.dev
# TAI: katso GitHub PR:n kommenteista Cloudflare-botti
```

Odota deployn valmistumista ja raportoi URL kayttajalle.

## Vaihe 4: Preview-seuranta ja smoke test

**TARKEA: Tama vaihe on pakollinen ennen tuotantoon vientia.**

### 4a. API health check

```bash
# Korvaa URL oikealla preview-osoitteella
PREVIEW_URL="https://<branch>.kryptoportfolio.pages.dev"
curl -sf "${PREVIEW_URL}/api/health" | cat
```

Odotettu vastaus: `{"ok":true}`

### 4b. Aja DB-migraatiot preview-kantaan (jos tarpeen)

Jos vaiheessa 2 tunnistettiin DB-muutoksia:

```bash
# Aja odottavat migraatiot preview-/staging-kantaan
DATABASE_URL="$PREVIEW_DATABASE_URL" pnpm migrate:run
```

### 4c. Toiminnallinen tarkistus

Kysy kayttajalta haluaako han testata manuaalisesti. Raportoi testattavat asiat:

- [ ] `/api/health` vastaa `{"ok":true}`
- [ ] Etusivu latautuu (ei blank page)
- [ ] Rekisterointi/kirjautuminen toimii (jos auth-muutoksia)
- [ ] Coinbase-import toimii (jos import-muutoksia)
- [ ] Halytykset toimivat (jos alert-muutoksia)
- [ ] Web push toimii (jos push-muutoksia)

### 4d. Seurantajakso

Odota preview-deployn seuranta-aikaa:

1. **Tarkista preview-lokit** Cloudflaresta virheidentunnistusta varten:
   ```bash
   # Jos wrangler on kaytettavissa
   pnpm dlx wrangler pages deployment tail --project-name kryptoportfolio
   ```

2. **Tarkista health uudelleen** muutaman minuutin kuluttua:
   ```bash
   curl -sf "${PREVIEW_URL}/api/health" | cat
   ```

3. Kysy kayttajalta: **"Preview on toiminut X minuuttia ilman virheita. Jatketaanko tuotantoon?"**

**ALA JATKA VAIHEESEEN 5 ILMAN KAYTTAJAN VAHVISTUSTA.**

### 4e. Runner-tarkistus (jos runner-muutoksia)

Jos `apps/runner/` on muuttunut:
```bash
cd apps/runner
pnpm dlx wrangler deploy --dry-run
```

## Vaihe 5: Tuotanto-DB-migraatiot

Jos vaiheessa 2 tunnistettiin DB-muutoksia JA preview-testit menivat lapi:

1. **KYSY VAHVISTUS** kayttajalta ennen tuotanto-DB:n muuttamista
2. Nayta ajettava SQL (migraatioiden nimet + sisalto)
3. Aja migraatiot:

```bash
DATABASE_URL="$DATABASE_URL" pnpm migrate:run
```

4. Vahvista migraation onnistuminen:

```bash
DATABASE_URL="$DATABASE_URL" pnpm migrate:status
```

## Vaihe 6: Tuotantoon vienti

### 6a. Merge main-branchiin (jos feature-branch)

Jos tyoskennellaan feature-branchilla:
```bash
# Luo PR jos ei viela olemassa
gh pr create --title "Release: <lyhyt kuvaus>" --body "$(cat <<'EOF'
## Release checklist
- [x] Local checks passed (typecheck, lint, test, build)
- [x] Preview deploy verified
- [x] Preview monitoring OK (no errors)
- [x] DB migrations applied (if any)
- [ ] Production smoke test

## Changes
<lista muutoksista>
EOF
)"

# TAI jos PR on jo olemassa ja valmis
gh pr merge --merge --delete-branch
```

Jos tyoskennellaan suoraan mainilla:
```bash
git push origin main
```

### 6b. Seuraa tuotanto-deploya

```bash
# GitHub Actions
gh run list --limit 3
gh run watch

# Cloudflare Pages tuotanto-deploy kaynnistyy automaattisesti main-pushista
```

**Odota CI:n ja Cloudflare-deployn valmistumista ennen seuraavaa vaihetta.**

### 6c. Runner-deploy (jos tarpeen)

Jos `apps/runner/` on muuttunut:
```bash
cd apps/runner
pnpm dlx wrangler deploy
```

Varmista CRON_SECRET on asetettu:
```bash
pnpm dlx wrangler secret list
```

## Vaihe 7: Tuotanto-smoke test ja vahvistus

### 7a. Health check

```bash
curl -sf https://kryptoportfolio.pages.dev/api/health | cat
```

### 7b. Toiminnallinen tarkistus

Raportoi kayttajalle ja odota vahvistus:

- [ ] API health OK
- [ ] Etusivu latautuu
- [ ] Perustoiminnot toimivat
- [ ] Ei virheita konsolissa

### 7c. Rollback-suunnitelma

Jos tuotanto-smoke test failaa, ohjeista kayttajaa:

1. **Revert-commit:** `git revert HEAD && git push origin main` → Cloudflare deployttaa automaattisesti
2. **DB rollback:** Jos migraatio aiheutti ongelman, luo korjausmigraatio (kayta `IF EXISTS` -patternia)
3. **Runner rollback:** `cd apps/runner && git stash && pnpm dlx wrangler deploy` (edellinen versio)

**ALA poista dataa tai droppa tauluja ilman kayttajan nimenomaista lupaa.**

## Vaihe 8: Viimeistely

### 8a. Tagaa release (valinnainen)

Kysy kayttajalta haluaako tagata:
```bash
git tag -a v$(date +%Y.%m.%d) -m "Release $(date +%Y-%m-%d)"
git push origin --tags
```

### 8b. Paivita seurantadokumentit

1. `docs/SESSION_CONTEXT.md` — Merkitse release tehty
2. `docs/ISSUE_LOG.md` — Merkitse releasen mukana korjatut bugit

### 8c. Yhteenveto

Tulosta kayttajalle:
- Mita deploytiin (committien maara + paasisalto)
- DB-migraatiot (jos ajettu)
- Preview URL + tuotanto URL
- Mahdolliset varoitukset tai seurattavat asiat

## Virhetilanteet

### CI failaa
→ Lue lokit (`gh run view --log-failed`), korjaa, pushaa uudelleen

### Preview-deploy failaa Cloudflaressa
→ Tarkista build output, wrangler.jsonc, env vars

### DB-migraatio failaa
→ **ALA JATKA DEPLOYTA.** Raportoi virhe kayttajalle. Tarkista `pnpm migrate:status` tilanne.

### Tuotanto-smoke test failaa
→ **Aloita rollback-suunnitelma (Vaihe 7c).** Raportoi kayttajalle valittomasti.

### Runner ei kaynnisty
→ `pnpm dlx wrangler tail kryptoportfolio-alert-runner` — seuraa reaaliaikaiset lokit
