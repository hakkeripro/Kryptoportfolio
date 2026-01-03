# Kryptoportfolio v3 (monorepo)

## Vaatimukset
- Node >= 20
- pnpm >= 9

## Asennus
```bash
pnpm install
```

## Kehitys
```bash
pnpm dev
```

## Testit
```bash
pnpm test
pnpm test:e2e
```

## Build
```bash
pnpm build
```

## Repo-rakenne
- `packages/core` — domain-skeemat + server alert eval (laajennetaan: lots/snapshots/tax/strategy)
- `packages/platform-web` — Dexie IndexedDB + WebCrypto vault + E2E sync client
- `apps/web` — React/Vite PWA (onboarding + vault lock + login + E2E sync + server alerts opt-in)
- `apps/api` — Fastify + sql.js (SQLite) (auth/sync/alerts runner/push)

> Huom: `packages/platform-native` ja `apps/native` eivät ole vielä tässä repo-versiossa.

## Dokumentaatio
- `docs/adr/*`
- `docs/known-limitations.md`
- `docs/next-steps.md`
- `docs/integrations/coinbase.md` — Coinbase CDP import setup
- `docs/hosted-mvp-cloudflare-pages.md` — hosted MVP overview (Cloudflare Pages + Functions)
- `docs/hosted/PHASE5_HOSTED_STAGING_RUNBOOK.md` — staging runbook (Neon + Pages)
- `docs/PROJECT_STATE.md` — handoff / project status
