# Phase 6 runbook: server alerts + cron runner + web push (hosted)

This runbook describes how to enable **server-side alerts** + **scheduled runner** + **web push** in the hosted environment (Cloudflare Pages + Neon).

## What gets evaluated on the server

- The server never decrypts the user vault.
- The web app periodically uploads a **derived MirrorState** (portfolio snapshot + current prices) to the server.
- The runner evaluates enabled alerts against MirrorState and writes:
  - `alert_trigger_logs` (append-only)
  - `server_alerts.last_triggered_at_iso` (cooldown)
  - `alert_runner_state` telemetry

## 1) Generate VAPID keys

Run locally:

```bash
pnpm dlx web-push generate-vapid-keys --json
```

You will get a `{ publicKey, privateKey }` pair.

Pick a subject (required by Web Push spec), e.g.:

- `mailto:you@example.com` or
- `https://kryptoportfolio.pages.dev`

## 2) Configure Cloudflare Pages (API) environment variables

Cloudflare Pages → Project → Settings → Environment variables:

**Production + Preview** (same values are fine):

- `DATABASE_URL` (Neon connection string, `sslmode=require`)
- `JWT_SECRET`

Add for Phase 6:

- `VAPID_PUBLIC_KEY` (from step 1)
- `VAPID_PRIVATE_KEY` (from step 1)
- `VAPID_SUBJECT` (e.g. `mailto:you@example.com`)
- `CRON_SECRET` (random long secret; used by the runner to call `/v1/alerts/server/runAll`)

Optional (recommended for live prices):

- `COINGECKO_BASE_URL` (default: `https://api.coingecko.com/api/v3`)
- `COINGECKO_DEMO_API_KEY` (free demo key from CoinGecko dashboard; enables higher rate limits than anonymous)

## 3) Deploy the Cloudflare Worker cron runner

The runner project lives in `apps/runner` and calls the hosted Pages Functions endpoint:

- `POST <API_BASE_URL>/v1/alerts/server/runAll`
- with header `Authorization: Bearer <CRON_SECRET>`

### 3.1 Login to Cloudflare (one time)

```bash
pnpm dlx wrangler login
```

### 3.2 Set runner vars and secret

Edit `apps/runner/wrangler.toml` if your domain differs.

Then, in `apps/runner`:

```bash
cd apps/runner

# set CRON_SECRET (must match Pages env var)
pnpm dlx wrangler secret put CRON_SECRET

# deploy
pnpm dlx wrangler deploy
```

The default cron schedule is every 15 minutes:

- `*/15 * * * *`

Change it in `apps/runner/wrangler.toml` as needed.

## 4) Verify endpoints (smoke)

### 4.1 API health

- `GET https://kryptoportfolio.pages.dev/api/health` → `{"ok":true}`

### 4.2 Runner endpoint (manual)

Call:

- `POST https://kryptoportfolio.pages.dev/api/v1/alerts/server/runAll`
- header: `Authorization: Bearer <CRON_SECRET>`

Expected:

- `{ ok: true, users: <n>, usersOk: <n>, ... }`

## 5) UI smoke test checklist

1) **Login**
- Open `https://kryptoportfolio.pages.dev`
- Register/login

2) **Enable push**
- Settings → Notifications
- Click **Enable push** (browser prompt)
- Click **Send test notification** → you should get a notification

3) **Create + enable server alerts**
- Alerts page
- Create a `Portfolio value ABOVE 1` alert
- Click **Enable on server**
  - Expected: status shows enabled alerts
  - Expected: trigger log updates (should trigger immediately if threshold is met)

4) **Cron evaluation**
- Wait for cron (or trigger runner manually)
- Alerts page → Trigger log should show new entries

## Notes

- Expired push subscriptions are auto-deactivated (HTTP 404/410).
- Other push failures back off exponentially (`web_push_subscriptions.next_attempt_at_iso`).
