# Project state (handoff)

Tämä tiedosto on tarkoitettu tekoäly/kehittäjä-handoffiin.

## Mitä on valmiina

### Core (`packages/core`)
- Ledger (append-only) + replacement + tombstone.
- Coinbase v2 mapping: connect → fetch all/newest → normalize → issues (FX / fee value / reward FMV) → ledger events.
- Lot engine: FIFO default + veroprofiilit (LIFO/HIFO/AVG_COST).
- Portfolio snapshots: streaming rebuild + “incremental replace from earliest changed day”.
- Tax engine (per tax year): realized disposals + income + year-end holdings.

Testit:
- `vitest` unit testit corelle (coinbase import, lot engine, tax engine).

### Web (`apps/web`)
- React+Vite PWA, Tailwind, Zustand, Dexie vault.
- Onboarding: vault setup + unlock.
- Optional login + E2E encrypted sync (server stores ciphertext envelopes).
- Imports:
  - Coinbase import stepper: connect → fetch → preview → resolve issues → commit → rebuild derived.
  - Autosync UI: status (in-flight/last run/next run) + cursor telemetry + “Run now”.
- Portfolio/Dashboard/Holdings päivittyy commitin jälkeen.
- Transactions:
  - virtualized list
  - detail drawer (raw JSON)
  - append-only delete (tombstone)
- Asset catalog mapping UX:
  - “Unmapped assets” -jono
  - CoinGecko search + manuaalinen `coingeckoId`-linkitys
- Alerts:
  - alert CRUD + mirror state push + trigger log näkymä
  - web push subscribe/unsubscribe UI (toimii kun VAPID envit asetettu)

### Local API (`apps/api`)
- Fastify + SQLite (local dev + Playwright e2e).
- Endpointit vastaavat webin tarpeita (/api proxyn takana).

### Hosted MVP API (`functions/`)
- Cloudflare Pages Functions (Hono) → sama-origin `/api/*`.
- DB: Neon Postgres.
- Skeema:
  - source of truth: `functions/_lib/db.ts` (`HOSTED_SCHEMA_SQL`)
  - dump tiedostona: `scripts/hosted-schema.sql`

  - migrations: `scripts/migrations/*` (esim. `scripts/migrations/2026-01-03-alert-runner-state.sql` jos saat virheen relation "alert_runner_state" does not exist)
  - komennot: `pnpm schema:hosted` ja `pnpm schema:hosted:file`

### CI
- GitHub Actions: `.github/workflows/ci.yml`
  - unit test job
  - Playwright e2e job (voi ohittaa repo variablella `SKIP_E2E=1`)

## Miten ajetaan local

```bash
pnpm install
pnpm dev
```

E2E:

```bash
pnpm test
pnpm test:e2e
```

## Hosted deploy

- Pääohje: `docs/hosted-mvp-cloudflare-pages.md`
- Staging runbook: `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`
- Phase 6 runbook: `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`

## Tunnetut keskeneräiset asiat (seuraava versio)

1) **Pricing/FX production caching**
- Rate limit handling + cache invalidation.

2) **Billing / maksavat asiakkaat**
- Stripe + feature gating (ei vielä kuluja ennen kuin aktivoidaan).

3) **Performance**
- Lot engine fully incremental (per-asset pool state persistence)
- Ledger: very large datasets (paging + search + grouping).

4) **Native parity**
- Push + alerts parity mobile (Expo) when native app is brought back.

## Kriittiset polut

- Coinbase mapping: `packages/core/src/import/coinbaseV2.ts`
- Portfolio rebuild: `packages/core/src/portfolio/*`
- Dexie schema: `packages/platform-web/src/db/webDb.ts`
- Hosted API: `functions/api/[[path]].ts`
- Hosted schema: `functions/_lib/db.ts` + `scripts/hosted-schema.sql`
