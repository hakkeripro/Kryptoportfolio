# Hosted MVP (Cloudflare Pages + Pages Functions + Neon Postgres)

Tämä repo tukee **hostattua MVP:tä** ilman jatkuvasti käynnissä olevaa Node-backendiä:

- **Frontend**: Cloudflare Pages (static + PWA)
- **API**: Cloudflare Pages Functions (`/api/*`)  
- **DB**: Neon Postgres (free tier)

Hyöty: sama-origin API (`/api`) → ei CORS-ongelmia, eikä käyttö riipu yksittäisestä tietokoneesta.

## Mitä hosted MVP kattaa

- Auth: `/api/v1/auth/*` + `/api/v1/me`
- E2E sync (encrypted envelopes): `/api/v1/devices/register` + `/api/v1/sync/envelopes`
- Coinbase import proxy (CDP Secret API Key ES256):
  - `/api/v1/import/coinbase/v2/accounts`
  - `/api/v1/import/coinbase/v2/transactions/page`
  - `/api/v1/import/coinbase/v2/transactions/show`
  - `/api/v1/import/coinbase/v2/exchange-rates`
- CoinGecko proxy (asset mapping + prices):
  - `/api/v1/catalog/coingecko/search`
  - `/api/v1/prices/coingecko/simple`
- Server alerts (mirror state + trigger log) + web push subscription endpoints:
  - `/api/v1/alerts/server/*`
  - `/api/v1/push/web/*`

> Huom: Local dev käyttää edelleen `apps/api`-Fastify-backendiä. Hosted-versiossa sama API toteutetaan Pages Functionsilla (`functions/api/*`).

## Quickstart (staging)

Katso yksityiskohtainen runbook:

- `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md`

## Neon Postgres: skeema

Repo sisältää skeeman tiedostona:

- `scripts/hosted-schema.sql`

Tulosta “source of truth” (jos haluat generoida SQL:n uusiksi):

```bash
pnpm schema:hosted
```

Generoi tiedostoksi:

```bash
pnpm schema:hosted:file
```

## Cloudflare Pages build

Monorepo: build ajetaan repo-juuresta.

- **Build command**:

```bash
pnpm install
pnpm -w build:deps
pnpm --filter @kp/web build
```

- **Build output directory**: `apps/web/dist`

## Environment variables

Katso:

- `.env.hosted.example`

Minimi (Preview + Production):

- `DATABASE_URL`
- `JWT_SECRET`

Valinnainen:

- `COINGECKO_DEMO_API_KEY`
- `VAPID_*`
- `CRON_SECRET` (Cloudflare Worker Cron -> `/api/v1/alerts/server/runAll`)

## Troubleshooting

### `/api/*` 404

- varmista että repo-rootissa on `functions/api/[[path]].ts`

### DB error / timeout

- varmista että skeema on ajettu (`scripts/hosted-schema.sql`)
- tarkista että connection string sisältää `sslmode=require`

### Node version buildissä

Repo sisältää `.node-version` ja `.nvmrc` (Node 20). Jos build ympäristö silti käyttää väärää versiota, aseta Pages build env var:

- `NODE_VERSION=20`
