# Alert runner (Cloudflare Worker Cron)

This Worker calls the Pages Functions endpoint `POST /v1/alerts/server/runAll` on a schedule.

## Required secrets/vars

- `API_BASE_URL` (var) – e.g. `https://kryptoportfolio.pages.dev/api`
- `CRON_SECRET` (secret) – must match `CRON_SECRET` configured in Cloudflare Pages
- `BATCH_LIMIT` (var) – max users per run (default 200)
