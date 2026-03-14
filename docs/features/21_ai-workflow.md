# Feature 21: AI-kehitysymparisto + workflow

**Status:** ✅ TOTEUTETTU
**Toteutettu:** 2026-03-14
**Edellyttaa:** Vaihe 0 valmis (T-001 CI, T-008 siivous)

## Tavoite

Dokumentoidaan ja toteutetaan AI-avusteisen kehityksen tyokalut, skillit ja laatuvaatimukset. Varmistetaan etta jokainen AI-sessio tuottaa laadukasta, testattua koodia ja paivittaa seurantadokumentit.

## Toteutetut osat

### 1. Claude Code skillit (slash-komennot)

| Skilli | Tiedosto | Kuvaus |
|--------|----------|--------|
| `/spec-feature <nro>` | `.claude/skills/spec-feature/SKILL.md` | **ENSIN:** Luo feature-speksi (vaatimukset, tekninen suunnitelma, testaussuunnitelma) |
| `/implement-feature <nro>` | `.claude/skills/implement-feature/SKILL.md` | **SITTEN:** Lataa valmis speksi → suunnittele → toteuta → testaa → paivita docs |
| `/fix-bugs [id/prio]` | `.claude/skills/fix-bugs/SKILL.md` | Lataa ISSUE_LOG → priorisoi P0→P3 → analysoi → testi → korjaa → paivita docs |
| `/generate-feature-summary <nro>` | `.claude/skills/generate-feature-summary/SKILL.md` | Luo CHEAT_SHEET.md + TODO.md isosta speksista kontekstin tiivistamiseksi |
| `/update-session` | `.claude/skills/update-session/SKILL.md` | Paivittaa SESSION_CONTEXT.md, FEATURES_TODO.md, ISSUE_LOG.md session lopussa |

### 2. Laatuvaatimukset (CLAUDE.md:ssa)

- Testit ennen valmis-merkintaa
- Tiedostokoko max 300 rivia
- Ei `as any` kriittisilla poluilla
- Feature-speksi ENNEN koodia
- Coverage threshold >= 30% (CI pakottaa)

### 3. Session-tyoskentely (CLAUDE.md:ssa)

- Session aloitus -tarkistuslista (SESSION_CONTEXT → FEATURES_TODO → ISSUE_LOG)
- Uuden featuren workflow: `/spec-feature` → `/generate-feature-summary` → `/implement-feature` → `/update-session`
- Bugikorjaus workflow: `/fix-bugs` → `/update-session`
- Session lopetus -tarkistuslista (testit → /update-session → commit)

### 4. MCP-integraatiot (arvioitu)

- **Cloudflare MCP:** Ei tarvetta — `wrangler` CLI riittaa
- **GitHub MCP:** Ei tarvetta — `gh` CLI riittaa
- **CoinGecko API MCP:** Ei tarvetta — testifixturet riittavat
- **Paatos:** MCP:t lisaavat monimutkaisuutta ilman merkittavaa hyotya. Arvioidaan uudelleen tarvittaessa.

### 5. CI/CD workflow

- **Nykyinen pipeline:** lint → typecheck → test (coverage 30%) → build → e2e → audit → bundle size
- **Coverage threshold:** 30% (vitest config, CI failaa)
- **Staging/production deploy:** Toteutetaan Feature 11 (Hosted MVP) yhteydessa — ei taman featuren scopessa

### 6. Kehityksen rytmi (dokumentoitu CLAUDE.md:ssa)

- Yksi feature tai bugikorjaus per AI-sessio
- Session lopussa aina: `/update-session` + commit
- Seurantadokumentit pysyvat ajan tasalla

## Tiedostot

**Luotu:**
- `.claude/skills/spec-feature/SKILL.md`
- `.claude/skills/implement-feature/SKILL.md`
- `.claude/skills/fix-bugs/SKILL.md`
- `.claude/skills/generate-feature-summary/SKILL.md`
- `.claude/skills/update-session/SKILL.md`
- `docs/features/21_ai-workflow.md` (tama tiedosto)

**Muutettu:**
- `CLAUDE.md` — laatuvaatimukset, skillit, session-tyoskentely, MCP-arvio
- `.github/workflows/ci.yml` — coverage threshold -kommentti
