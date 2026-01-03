# Exchange integration playbook (v3)

This file is written so that an AI (or a human) can add a new exchange into this monorepo **without breaking module boundaries**.

## What "an exchange integration" means in this repo

An integration has 3 parts:

1) **API proxy (apps/api)**
   - Talks to the exchange over HTTPS.
   - Signs requests using the exchange’s auth scheme.
   - Returns *raw JSON* and/or normalized shapes.
   - Never stores exchange secrets.

2) **Vault storage (apps/web, apps/native)**
   - Credentials and per-exchange settings are stored **E2E encrypted** in the Vault.
   - On disconnect, remove the vault blob for that exchange.

3) **Importer (apps/web, apps/native)**
   - Fetches newest or all history.
   - Dedupes deterministically using `externalRef`.
   - Commits to the local append-only ledger.

## Canonical file locations

### Backend (apps/api)

- `apps/api/src/routes/imports-<exchange>.ts`
- `apps/api/src/services/<exchange>Client.ts`
- `apps/api/src/services/<exchange>Auth.ts` (JWT/HMAC helpers)
- Register route in `apps/api/src/server.ts`

### Hosted MVP backend (Cloudflare Pages Functions)

If you want the integration to work in the **hosted MVP** deployment (Cloudflare Pages), mirror the minimal proxy endpoints in `functions/` as well:

- `functions/_lib/<exchange>Client.ts`
- `functions/_lib/<exchange>Auth.ts`
- Route(s) in `functions/api/[[path]].ts` (keep the URL contract identical to apps/api)

Tip: keep the request/response schemas in `@kp/core` (zod) so both backends stay in sync.

#### Cron / scheduled tasks (hosted)

Cloudflare Pages Functions do not have always-on background processes. For scheduled work (e.g. server-side alerts, telemetry, nightly cleanup), use a separate **Cloudflare Worker Cron** that calls a Pages Functions endpoint protected by a dedicated bearer secret (do **not** reuse `JWT_SECRET`). See `docs/hosted/PHASE6_ALERTS_PUSH_RUNBOOK.md` for the pattern used in this repo.


### Web (apps/web)

- `apps/web/src/integrations/<exchange>/coinbaseVault.ts` (rename)
- `apps/web/src/integrations/<exchange>/<exchange>Api.ts`
- `apps/web/src/integrations/<exchange>/<exchange>Sync.ts`
- `apps/web/src/integrations/<exchange>/<exchange>Import.ts`
- `apps/web/src/pages/ImportsPage.tsx` (UI)
- `apps/web/src/components/IntegrationAutoSync.tsx` (foreground autosync)
- `apps/web/src/assets/exchanges/<exchange>.svg`

### Native (apps/native)

Mirror the web structure in `apps/native/src/integrations/<exchange>/...`.

## Required UX behaviors

- **Connect**: validate creds by doing a small read call (e.g. list accounts).
- **Fetch newest**: should only import transactions that are not yet imported.
- **Fetch all history**: must paginate until the exchange says there are no more pages.
- **Auto sync** (foreground): poll while app is open. PWA background is not reliable on iOS.
- **Auto commit**: when enabled, commit the fetched items without showing a preview.
- **Disconnect**: remove vault blob (credentials + cursors). Keep previously imported ledger events unless user explicitly chooses to delete.
- **Raw JSON**: user must be able to download the fetched JSON (for debugging/support).

## Data rules (import)

### Ledger invariants

- Ledger is **append-only**.
  - "Editing" an event means: append a new event with `replacesEventId`, and set `isDeleted=true` on the old event.
  - Never mutate a previously committed event in place.

### External refs + dedupe

- Always set `externalRef` on every committed ledger event.
  - Format: `<exchange>:<namespace>:<remote-id>`
  - Example: `coinbase:v2:<accountId>:<txId>`
- Deduplication key is `externalRef`.

### Domain mapping (must match v3 core)

- **BUY** increases holdings and sets `pricePerUnitBase`.
  - BUY fee increases **cost basis**.
- **SELL** decreases holdings and sets `pricePerUnitBase`.
  - SELL fee reduces **proceeds**.
- **SWAP** is represented as a single ledger event, but must behave like:
  - disposal of `assetId`/`amount` and acquisition of `assetOutId`/`amountOut`
  - disposal proceeds are determined by `valuationBase` (or deterministic fallback).
  - disposal fee reduces proceeds.
- **Token fee is never allowed without valuation**:
  - store `feeAssetId`, `feeAmount`, and deterministic `feeValueBase` (requires provider price or user input).
- Rewards/interest/staking:
  - default cost basis is **ZERO**.
  - FMV mode requires a base valuation (`fmvTotalBase`) or the importer must surface a blocking issue.

### Assets + catalog mapping

- Prefer mapping assets via a provider identifier (e.g. `providerRef.coingeckoId`).
- Do **not** "guess" by symbol when a provider id exists (symbols are ambiguous).

### Multi-currency + FX

- Choose a deterministic `baseCurrency` (from settings).
- If the exchange returns amounts in multiple currencies, build `fxRatesToBase` deterministically:
  - provider FX when available
  - otherwise require user input before commit (surface a blocking issue)
- Create missing Assets deterministically from currency codes:
  - `asset_<lowercase code>` (e.g. `asset_usd`, `asset_usdc`, `asset_btc`)
  - `providerRef` can be empty; user can map to provider IDs later in Assets.
- Create a single Account for the exchange:
  - Example: `acct_coinbase`

## `data-testid` standard (E2E)

All integration critical UI elements must have test ids:

- `btn-<exchange>-connect`
- `btn-<exchange>-disconnect`
- `btn-<exchange>-fetch-newest`
- `btn-<exchange>-fetch-all`
- `btn-<exchange>-preview-commit`
- `btn-<exchange>-preview-download`
- `form-<exchange>-keyname`, `form-<exchange>-privatekey`

Tip: keep additional test ids generic when repeated (e.g. `badge-ledger-deleted`) and put the id in the row element (`row-ledger-<id>`), so tests can reliably select.

## Minimal API contract (recommended)

Backend endpoints:

- `POST /v1/import/<exchange>/accounts`
- `POST /v1/import/<exchange>/transactions/page` (supports `nextUri`)
- `POST /v1/import/<exchange>/transactions/show` (optional)
- (Optional) `GET /v1/import/<exchange>/exchange-rates?...`

All `POST` endpoints should require `Authorization: Bearer <kp token>`.

## Checklist

- [ ] Add backend proxy + auth
- [ ] Add web vault schema + UI connect/disconnect
- [ ] Add newest + all history fetch with pagination
- [ ] Add deterministic dedupe & commit
- [ ] Add raw JSON download
- [ ] Add logo svg and show it in Imports
- [ ] Add Playwright coverage for connect → fetch newest → commit → disconnect
- [ ] Add a backend fixture mode (TEST_MODE) for deterministic e2e imports
