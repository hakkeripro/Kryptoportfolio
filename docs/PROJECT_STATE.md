# Project state

Tama tiedosto kuvaa projektin nykytilan. Katso myos:
- **[../CLAUDE.md](../CLAUDE.md)** — AI-kehitysohjeet, monorepo-rakenne, komennot
- **[features/FEATURES_TODO.md](features/FEATURES_TODO.md)** — Featureiden ja teknisen velan status
- **[SESSION_CONTEXT.md](SESSION_CONTEXT.md)** — Muutosloki + aktiivinen tila
- **[ISSUE_LOG.md](ISSUE_LOG.md)** — Bugit (priorisoitu)

## Mita on valmiina

### Core (`packages/core`)
- Ledger (append-only) + replacement + tombstone
- Coinbase v2 mapping: connect → fetch → normalize → issues → ledger events
- Lot engine: FIFO default + veroprofiilit (LIFO/HIFO/AVG_COST)
- Portfolio snapshots: streaming rebuild + incremental replace
- Tax engine (per tax year): realized disposals + income + year-end holdings

### Web (`apps/web`)
- React+Vite PWA, Tailwind, Zustand, Dexie vault
- Onboarding: vault setup + unlock
- Optional login + E2E encrypted sync
- Coinbase import stepper + autosync
- Portfolio/Dashboard/Holdings/Transactions/Tax
- Asset catalog mapping (CoinGecko)
- Alerts: CRUD + mirror state + trigger log + web push

### Local API (`apps/api`)
- Fastify + SQLite (local dev + Playwright e2e)

### Hosted MVP (`functions/`)
- Cloudflare Pages Functions (Hono) + Neon Postgres
- Skeema: `functions/_lib/db.ts` (`HOSTED_SCHEMA_SQL`)
- Migraatiot: `scripts/migrations/*.sql`

### CI
- GitHub Actions: `.github/workflows/ci.yml`
- Unit test + Playwright e2e + lint + typecheck + audit + bundle size

## Miten ajetaan

```bash
pnpm install    # Asennus
pnpm dev        # Dev serverit (web :5173, api :8788)
pnpm test       # Vitest unit testit
pnpm test:e2e   # Playwright e2e
```

## Hosted deploy

- Paaohje: `docs/hosted-mvp-cloudflare-pages.md`
- Staging: `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`
- Alerts+push: `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`

**Env vars:** `DATABASE_URL`, `VAPID_PUBLIC_KEY/PRIVATE_KEY/SUBJECT`, `CRON_SECRET`, `COINGECKO_BASE_URL`, `COINGECKO_DEMO_API_KEY`

## Kriittiset polut

Katso `CLAUDE.md` → "Kriittiset polut" -taulukko.
