# AI handoff

This repo is designed so that *another* AI (or a new ChatGPT project) can pick up work without context loss.

## One-paragraph summary

Kryptoportfolio v3 is a pnpm monorepo. The web app is a React+Vite PWA storing user data locally in IndexedDB (Dexie) and protecting it with a vault passphrase. Optional login enables E2E encrypted sync: the server stores only ciphertext envelopes. Coinbase (CDP Secret API Key ES256) import exists end-to-end (connect → fetch → preview → resolve issues → commit → rebuild derived → show in Portfolio/Transactions/Tax). A basic tax module (realized disposals + income + year-end holdings) is included. The repo also includes a Hosted MVP target: Cloudflare Pages + Pages Functions + Neon Postgres.

## Repo structure

```
apps/
  web/                  # React PWA
  api/                  # Fastify API for local dev + Playwright
packages/
  core/                 # domain models, import mappers, lot & tax engines
  platform-web/         # Dexie DB, vault crypto, sync envelope helpers
functions/              # Cloudflare Pages Functions API (hosted MVP)
docs/                   # documentation
scripts/                # tooling (zips, hosted schema, etc)
```

## How to run (local)

1) Install deps

```bash
pnpm install
```

2) Start dev

```bash
pnpm dev
```

Defaults:

- Web: `http://localhost:5173`
- API (Fastify): `http://localhost:8788` (configurable via `PORT`)

If you see a port conflict on Windows, keep Vite proxy (`apps/web/vite.config.ts`) and API `PORT` in sync.

## How to run (hosted MVP)

- Overview: `docs/hosted-mvp-cloudflare-pages.md`
- Staging runbook: `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`
- Phase 6 runbook: `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`

Node version is pinned via `.node-version` + `.nvmrc` (Node 20).

## Tests

- Unit tests: `pnpm test`
- Playwright e2e: `pnpm test:e2e` (spins up web + api; API port is 8788)

CI is wired in `.github/workflows/ci.yml`.

## Current “done” list (high-level)

- Vault setup + lock/unlock
- Login (register/login) + device registration
- E2E encrypted sync envelopes (upload + pull)
- Coinbase import flow (connect, fetch-all, fetch-newest, preview + dedupe + commit)
- Import issue resolution UI for FX / fee value / swap valuation / reward FMV
- Derived rebuild for portfolio + snapshots (streaming + incremental replace)
- Transactions: virtualized ledger list + detail drawer + append-only delete
- Asset mapping UX: “unmapped assets” queue + CoinGecko search + manual coingeckoId linking
- Server alerts UI: mirror push + trigger log
- Hosted runner (Cloudflare Worker Cron) + web push sending end-to-end (see `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`)


## Product direction (Jan 2026)

- **Auth/Vault UX:** Passkey/WebAuthn + **yksi Vault Passphrase per käyttäjä** (multi-device). Katso:
  - `docs/adr/ADR-018-auth-vault-ux.md`
  - `docs/UI_MOCK_SPEC.md`
  - `docs/UX_ACCEPTANCE_CRITERIA.md`
- **Imports:** siirry provider registry + wizard -malliin (Binance/MEXC/Bitvavo/Ledger/MetaMask). Katso:
  - `docs/adr/ADR-019-imports-plugin-registry.md`
- **Billing:** premium + feature gating huomioidaan heti (aluksi stub). Katso:
  - `docs/adr/ADR-020-billing-feature-gating.md`

## Issue log (triage)

Aloita korjaukset tästä järjestyksessä:
1) P0: `docs/ISSUE_LOG.md`
2) Backlog: `docs/BACKLOG.md`

## Known limitations / gaps

- **KP-UI-001:** vault passphrase session bug (onboarding/unlock)
- **KP-UI-002:** price auto-refresh settings key mismatch
- **KP-ALERT-001:** server alerts enable/replace semantics can wipe rules

- **Pricing/FX**: production caching & rate limit handling needs tuning.
- **Billing**: Stripe + feature gating not implemented (kept out to avoid costs until needed).
- **Performance**: very large ledgers (search/group), and more incremental lot pool persistence.

## Next work items (recommended order)

1. **Pricing/FX caching**: smarter cache + backoff, and better UX for missing valuations.
2. **Billing**: Stripe subscription + plan gating.
3. **Performance/polish**: very large datasets (search/group), incremental lot pools persistence.
4. **Native parity**: bring Expo app back to parity (imports, alerts/push).

## Prompt template for a new AI

Copy/paste this into a new chat:

> You are a senior full-stack engineer and architect. Continue the Kryptoportfolio v3 monorepo in this zip.
> 
> Read and follow docs:
> - `docs/AI_HANDOFF.md`
> - `docs/PROJECT_STATE.md`
> - `docs/ISSUE_LOG.md`
> - `docs/BACKLOG.md`
> - `docs/UI_MOCK_SPEC.md`
> - `docs/UX_ACCEPTANCE_CRITERIA.md`
> - `docs/EXCHANGE_INTEGRATION_PLAYBOOK.md`
> - `docs/hosted-mvp-cloudflare-pages.md`
> - `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`
> - `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`
>
> Current state:
> - Web (React+Vite PWA) + IndexedDB vault
> - Optional login + E2E encrypted sync envelopes
> - Coinbase v2 import end-to-end + Tax report
> - Hosted MVP: Cloudflare Pages Functions + Neon schema in `scripts/hosted-schema.sql`
>
> Next goals:
> 1) Pricing/FX caching + better missing-valuation UX
> 2) Billing (Stripe)
> 3) Performance polish for large datasets
> 4) Native parity (Expo)
>
> Hosted alerts/push docs:
> - `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md`
