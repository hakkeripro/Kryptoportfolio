# Kryptoportfolio v3 - Claude Code Ohjeet

## Projekti lyhyesti
Kryptovaluuttaportfolion hallinta-PWA (pnpm monorepo). React 18 + Vite + Tailwind + Zustand + Dexie (IndexedDB). Zero-knowledge vault: käyttäjädata salataan paikallisesti, serveri tallentaa vain ciphertext-kirjekuoria. Coinbase-import end-to-end, verolaskenta, hälytykset + web push.

## Monorepo-rakenne
```
packages/
  core/              # @kp/core — Domain: skeemat (Zod), import-mapperit, lot engine, tax engine, alerts eval
  platform-web/      # @kp/platform-web — Dexie IndexedDB, WebCrypto vault, sync client
apps/
  web/               # @kp/web — React+Vite PWA (Tailwind, Zustand, React Router)
  api/               # @kp/api — Fastify + sql.js (local dev + Playwright e2e)
  runner/            # @kp/runner — Cloudflare Worker (cron: alert runner joka 15 min)
functions/           # Cloudflare Pages Functions (hosted MVP API, Hono + Neon Postgres)
scripts/             # Zip, schema generation, migraatiot
docs/                # ADR:t (001-020), runbookit, speksit, issue log
```

## Komennot
```bash
pnpm install          # Asennus (postinstall buildaa core + platform-web)
pnpm dev              # Kaikki dev serverit rinnakkain (web :5173, api :8788)
pnpm build            # Build kaikki
pnpm test             # Vitest unit testit
pnpm test:e2e         # Playwright e2e (web + api)
pnpm schema:hosted    # Tulosta hosted DB skeema
```

## Kriittiset polut
| Tarkoitus | Polku |
|-----------|-------|
| Coinbase import mapper | `packages/core/src/import/coinbaseV2.ts` |
| Lot engine (FIFO/LIFO/HIFO/AVG) | `packages/core/src/portfolio/lotEngine.ts` |
| Portfolio snapshots | `packages/core/src/portfolio/snapshots.ts` |
| Tax engine | `packages/core/src/tax/taxEngine.ts` |
| Alert eval (server) | `packages/core/src/alerts/serverAlertEval.ts` |
| Asset catalog + CoinGecko | `packages/core/src/catalog/assetCatalog.ts` |
| Dexie DB skeema | `packages/platform-web/src/db/webDb.ts` |
| App state (Zustand) | `apps/web/src/store/useAppStore.ts` |
| App routing | `apps/web/src/app/App.tsx` |
| Hosted API router | `functions/api/[[path]].ts` |
| Hosted DB skeema | `functions/_lib/db.ts` (`HOSTED_SCHEMA_SQL`) |
| CI pipeline | `.github/workflows/ci.yml` |

## Seurantadokumentit (single source of truth)

| Dokumentti | Sisalto | Milloin luetaan |
|------------|---------|-----------------|
| `docs/features/FEATURES_TODO.md` | **Kaikkien featureiden status** (01-20) | Ennen toteutuksen aloittamista |
| `docs/ISSUE_LOG.md` | Kaikki bugit (P0-P3) | Ennen bugikorjausta |
| `docs/BACKLOG.md` | Feature backlog + prioriteetit | Uuden ominaisuuden suunnittelussa |
| `docs/SESSION_CONTEXT.md` | Muutosloki + aktiivinen tila | Session alussa ja lopussa |
| `docs/CODING_CONVENTIONS.md` | Koodauskaytannot | Aina koodia kirjoittaessa |
| `docs/PROJECT_STATE.md` | Projektin tila, kriittiset polut | Tarvittaessa |

**Featuret:** `docs/features/FEATURES_TODO.md` on AINOA paikka feature-statuksille. Featuret 01-21 on numeroitu pysyvasti.
**Tekninen velka:** Vaihe 0 (T-001..T-008) FEATURES_TODO:n alussa — tehdaan ENNEN uusia featureita.
**Bugit:** `docs/ISSUE_LOG.md` on AINOA paikka bugien seurantaan.
**Feature-speksit:** `docs/features/XX_nimi.md` (kayta `docs/features/FEATURE_TEMPLATE.md` pohjana)

## Arkkitehtuuripaatokset (ADR)
20 ADR:aa hakemistossa `docs/adr/`. Tarkeimmat:
- **ADR-001:** Monorepo + core (domain logiikka @kp/core:ssa)
- **ADR-002:** Append-only ledger (ei muokkauksia, vain replacement + tombstone)
- **ADR-011:** E2E encryption (zero-knowledge sync)
- **ADR-018:** Auth/Vault UX: Passkey + yksi Vault Passphrase per kayttaja (**PROPOSED**)
- **ADR-019:** Imports plugin registry + wizard (**PROPOSED**)
- **ADR-020:** Billing + feature gating (**PROPOSED**)

## Arkkitehtuuriperiaatteet
1. **Zero-knowledge vault** — Serveri ei koskaan nae selkotekstidataa. Client salaa kaiken.
2. **Append-only ledger** — Tapahtumia ei muokata. Muutokset = replacement event + `replacesEventId`. Poistot = tombstone.
3. **Domain core erillaan** — Kaikki bisneslogiikka `@kp/core`:ssa. Web/API ovat ohuita adaptereita.
4. **Dual API** — Local: Fastify + SQLite (dev/e2e). Hosted: Cloudflare Pages Functions + Neon Postgres. Samat endpointit.
5. **Reactive UI** — Zustand app state + Dexie liveQuery. Derived data rebuildetaan automaattisesti ledger-muutoksista.

## Hosted-ymparisto
- **Platform:** Cloudflare Pages + Pages Functions
- **DB:** Neon Postgres (serverless)
- **Skeema:** `functions/_lib/db.ts` → `HOSTED_SCHEMA_SQL`
- **Migraatiot:** `scripts/migrations/*.sql`
- **Runner:** Cloudflare Worker cron (15 min valein)
- **Env vars:** `DATABASE_URL`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`, `CRON_SECRET`, `COINGECKO_BASE_URL`, `COINGECKO_DEMO_API_KEY`
- **Runbookit:** `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`, `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`

## Ristiriitojen kasittely
Jos havaitset ristiriitoja dokumentaation, koodin tai ominaisuuksien valilla:
1. **PYSAHDY** — ala jatka toteutusta
2. **Listaa ristiriidat** kayttajalle selkeasti
3. **Odota selvennystä** ennen jatkamista
4. **Paivita dokumentaatio** kun ristiriita on selvitetty

## Laatuvaatimukset
1. **Testit ennen valmis-merkintaa** — Jokainen feature vaatii unit-testit ENNEN kuin merkitaan valmiiksi FEATURES_TODO:ssa
2. **Tiedostokoko max 300 rivia** — Yksikaan tiedosto ei saa ylittaa 300 rivia ilman perusteltua syyta (dokumentoi poikkeus commitiin)
3. **Ei `as any` kriittisilla poluilla** — Domain (core), API-routet ja store-logiikka eivat saa sisaltaa `as any` -casteja
4. **Feature-speksi ENNEN koodia** — Uuden featuren toteutus alkaa aina speksista (`docs/features/XX_nimi.md`), ei improvisoituna
5. **Coverage threshold** — `@kp/core` coverage >= 30% (nostetaan sprinteittain). CI failaa jos alittuu.

## Skillit (slash-komennot)
| Komento | Kuvaus |
|---------|--------|
| `/spec-feature <nro>` | **ENSIN:** Luo feature-speksi (vaatimukset, tekninen suunnitelma, testaussuunnitelma) |
| `/implement-feature <nro>` | **SITTEN:** Lataa valmis speksi ja aloittaa toteutuksen |
| `/fix-bugs [id/prioriteetti]` | Korjaa bugeja ISSUE_LOG:sta prioriteettijarjestyksessa |
| `/generate-feature-summary <nro>` | Luo CHEAT_SHEET.md + TODO.md isosta speksista (kontekstin tiivistys) |
| `/update-session` | Session lopussa: paivittaa SESSION_CONTEXT.md, FEATURES_TODO.md, ISSUE_LOG.md |
| `/release` | **Julkaisu:** Tarkistukset → preview → DB-migraatiot → smoke test → tuotanto (Cloudflare Pages) |

## Session-tyoskentely

### Session aloitus
1. Lue `docs/SESSION_CONTEXT.md` — missa jäätiin
2. Lue `docs/features/FEATURES_TODO.md` — valitse tehtava
3. Tarkista `docs/ISSUE_LOG.md` — onko P0-bugeja jotka pitaa korjata ensin

### Uuden featuren workflow
```
/spec-feature <nro>        → Speksi ensin (vaatimukset, suunnitelma, testit)
/generate-feature-summary  → Tiivista iso speksi (valinnainen)
/implement-feature <nro>   → Toteutus valmiin speksin pohjalta
/update-session            → Paivita seurantadokumentit
```

### Bugikorjaus
```
/fix-bugs [id/prio]        → Korjaa bugi(t)
/update-session            → Paivita seurantadokumentit
```

### Session lopetus
1. Aja `pnpm test` — varmista testit menee lapi
2. Kayta `/update-session` — paivittaa kaikki seurantadokumentit
3. Commitoi muutokset

### MCP-integraatiot (arvioitu)
- **Cloudflare MCP:** Ei kaytossa — `wrangler` CLI riittaa deployihin ja logien tarkistukseen
- **GitHub MCP:** Ei kaytossa — `gh` CLI kattaa issue/PR-hallinnan
- **CoinGecko API MCP:** Ei kaytossa — testifixturet ja proxy-stubit riittavat kehitykseen
- **Paatos:** MCP:t lisaavat monimutkaisuutta ilman merkittavaa hyotya tassa projektissa. Arvioidaan uudelleen jos tarpeet muuttuvat.

## Tyoskentelytavat

### Teknisen velan tehtava (Vaihe 0)
1. Lue tehtavakuvaus `docs/features/FEATURES_TODO.md` (T-00X)
2. Toteuta muutos
3. Testaa: `pnpm test` + `pnpm test:e2e` (kaikki lapaistava)
4. Merkitse tehtava valmiiksi FEATURES_TODO:ssa
5. Paivita SESSION_CONTEXT.md

### Ominaisuuden toteutus
1. Lue feature-speksi: `docs/features/XX_nimi.md` + `FEATURES_TODO.md`
2. Lue relevantti ADR (`docs/adr/ADR-0XX-*.md`)
3. Lue `docs/CODING_CONVENTIONS.md`
4. Tarkista `docs/ISSUE_LOG.md` liittyvat bugit
5. Toteuta vaiheittain: Core domain → Platform → API → Web UI
6. Testaa: `pnpm test` + tarvittaessa `pnpm test:e2e`
7. Paivita: `docs/features/FEATURES_TODO.md` + `docs/ISSUE_LOG.md` + `docs/SESSION_CONTEXT.md`

### Bugikorjaus
1. Lue `docs/ISSUE_LOG.md` (prioriteettijarjestyksessa P0 → P3)
2. Korjaa ja testaa
3. Paivita ISSUE_LOG.md (merkitse korjatuksi)
4. Paivita SESSION_CONTEXT.md

### Tietokantamuutokset (hosted)
1. Muokkaa `functions/_lib/db.ts` (`HOSTED_SCHEMA_SQL`)
2. Luo migraatio: `scripts/migrations/YYYY-MM-DD-kuvaus.sql`
3. Aja `pnpm schema:hosted:file` (paivittaa `scripts/hosted-schema.sql`)

## Dokumenttien paivitys (session lopussa)
- `docs/SESSION_CONTEXT.md` — Muutosloki + status (AINA)
- `docs/features/FEATURES_TODO.md` — Feature-statusten paivitys
- `docs/ISSUE_LOG.md` — Bugien statukset

## Allowed tools
Tiedostojen muokkaus (Read, Write, Edit, Glob, Grep) sallittu ilman erillista vahvistusta.
Bash-komennot (pnpm, git, node) sallittu kehitystyohon.
