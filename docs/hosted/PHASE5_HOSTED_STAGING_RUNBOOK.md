# Phase 5: Hosted staging runbook (Cloudflare Pages + Pages Functions + Neon)

Tämän vaiheen tavoite on saada **staging** verkkoon 0€-lähtökohdilla:

- **Frontend**: Cloudflare Pages (static + PWA)
- **API**: Cloudflare Pages Functions (`/api/*`)  
- **DB**: Neon Postgres (free tier)

> Local dev jatkuu entiseen tapaan: `pnpm dev` (Fastify API + Vite).

## Prerequisites

- GitHub repo (tai GitHub-zip projektista tehtynä repositoriona)
- Cloudflare account + Pages enabled
- Neon account
- Mahdollisuus ajaa Postgres SQL (joko `psql` paikallisesti tai Neon SQL editorissa)

## 1) Neon: luo staging DB

1. Neon dashboard → Create project
2. Kopioi **connection string** (DATABASE_URL)
3. (Suositus) Luo erillinen branch nimeltä `staging`.

## 2) DB schema bootstrap

Repo sisältää SQL-skeeman valmiina:

- `scripts/hosted-schema.sql`

Aja se Neonille:

### Vaihtoehto A: psql

```bash
psql "$DATABASE_URL" -f scripts/hosted-schema.sql
```

### Vaihtoehto B: Neon SQL editor

Neon dashboard → SQL editor → paste `scripts/hosted-schema.sql` → Run.

## 3) Cloudflare Pages: luo staging deployment

1. Cloudflare dashboard → Pages → Create a project → Connect to GitHub
2. Valitse repo ja branch (staging voi olla esim. `main` aluksi)

### Build settings (monorepo)

- **Build command**:

```bash
pnpm install
pnpm -w build:deps
pnpm --filter @kp/web build
```

- **Build output directory**: `apps/web/dist`

> Pages tukee monorepoja – build ajetaan repo-juuresta (workspaces tarvitsee sen).

### Environment variables

Aseta vähintään nämä (Preview + Production):

- `DATABASE_URL` = Neon connection string
- `JWT_SECRET` = satunnainen pitkä merkkijono (esim. `openssl rand -hex 32`)

Valinnaiset:

- `COINGECKO_DEMO_API_KEY` (jos haluat luotettavammat hinnat / rate limit)
- `COINGECKO_BASE_URL` (jos joskus haluat käyttää proxyä)
- Push:
  - `VAPID_PUBLIC_KEY`
  - `VAPID_PRIVATE_KEY`
  - `VAPID_SUBJECT` (esim. `mailto:you@domain.fi`)

### Node version

Repo sisältää `.node-version` ja `.nvmrc` tiedostot (Node 20). Jos build ympäristö silti käyttää eri versiota, aseta Cloudflare Pagesin build env vars:

- `NODE_VERSION=20`

## 4) Verify staging

1. Avaa Pages URL
2. Rekisteröidy + login
3. Varmista että API on ylhäällä:

- `GET https://<your-site>/api/health` → `{ ok: true }`

4. Aja Coinbase import UI:stä

## 5) Troubleshooting

- Jos `/api/*` palauttaa 404:
  - varmista että repo-rootissa on `functions/api/[[path]].ts`
- Jos DB error:
  - varmista että schema on ajettu
  - tarkista että `DATABASE_URL` sisältää `sslmode=require`

## 6) Next: production

Kun staging toimii:

- lukitse `JWT_SECRET` ja DB-branch
- tee erillinen `production` branch / Pages environment
- lisää (myöhemmin) cron/runner server alertsille (Cloudflare Worker Cron) ja push-sending.
