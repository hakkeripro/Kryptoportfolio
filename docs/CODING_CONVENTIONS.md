# Coding Conventions

Paivitetty: 2026-03-12

## Kieli
- **Koodi:** englanti (muuttujat, funktiot, kommentit)
- **Dokumentaatio:** suomi (docs/, CLAUDE.md, commit-viestit voivat olla suomeksi tai englanniksi)
- **UI-tekstit:** englanti (kayttajalle nakyvat tekstit)

## TypeScript
- **Strict mode** aina (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Target:** ES2022, module ESNext, moduleResolution Bundler
- **Skeemamaarittely:** Zod (ei erillisia interface-tyyppeja domain-datalle)
  - `z.infer<typeof Schema>` tyyppien johdannaisena
  - Skeemat `packages/core/src/domain/` -kansiossa
- **Decimal-arvot:** `Decimal.js` (ei float-aritmetiikkaa rahalle/maärille)
- **Paivamaarat:** ISO 8601 stringeina (`IsoString` Zod-tyyppi), kasittely `date-fns`:lla
- **UUID:t:** `UuidString` Zod-tyyppi, generointi `@kp/core` `uuid()`-funktiolla

## Nimeamiskaytannot
- **Muuttujat/funktiot:** camelCase (`getLotPool`, `rebuildDerived`)
- **Tyypit/Interfacet:** PascalCase (`LedgerEvent`, `AppState`)
- **Zod-skeemat:** PascalCase (`LedgerEventBase`, `AlertSchema`)
- **Tiedostot:** camelCase (`lotEngine.ts`, `useAppStore.ts`)
  - Poikkeus: React-komponentit PascalCase (`DashboardPage.tsx`)
- **Vakiot/enumit:** UPPER_SNAKE_CASE (`HOSTED_SCHEMA_SQL`, `LedgerEventType`)
- **DB-sarakkeet (hosted):** snake_case SQL:ssa (`user_id`, `created_at`)

## Projektirakenne
- **Domain-logiikka** aina `@kp/core`:ssa — EI web/api-paketteihin
- **Platform-spesifinen** (IndexedDB, WebCrypto) → `@kp/platform-web`
- **Importit:** workspace-paketit `@kp/core`, `@kp/platform-web` (ei suhteellisia polkuja pakettien valilla)
- **Exports:** jokainen paketti kayttaa `exports`-kenttaa `package.json`:ssa

## React (apps/web)
- **State:** Zustand store (`useAppStore`) — globaali tila
- **DB-reaktiivisuus:** Dexie `liveQuery` — tietokantadata
- **Routing:** React Router v6
- **Styling:** Tailwind CSS (ei erillisia CSS-tiedostoja)
- **Sivut:** `src/pages/` (yksi tiedosto per sivu)
- **Komponentit:** `src/components/` (jaetut), `src/app/` (shell/layout)

## API (apps/api + functions/)
- **Local:** Fastify + sql.js (SQLite muistissa/tiedostossa)
- **Hosted:** Hono + Neon Postgres (Cloudflare Pages Functions)
- **Auth:** JWT (jose) + Passkey/WebAuthn
- **Endpointit:** samat polut molemmissa (`/api/auth/*`, `/api/sync/*`, `/api/alerts/*`, jne.)

## Testaus
- **Unit:** Vitest (`pnpm test`)
- **E2E:** Playwright (`pnpm test:e2e`)
  - Testit: `apps/web/e2e/`
  - E2E kayttaa omaa Fastify-instanssia (portti 8788)
- **Testaa aina** muutosten jalkeen: vahintaan `pnpm test`, isommissa `pnpm test:e2e`

## Ledger-kaytannot (kriittinen)
- **Append-only:** aelä koskaan muokkaa olemassa olevaa tapahtumaa
- **Muutos:** luo uusi event `replacesEventId`-viittauksella alkuperaiseen
- **Poisto:** luo tombstone-event
- **Rebuild:** derived data (portfolio, snapshots, tax) rebuildetaan aina muutoksen jalkeen

## Git
- Commit-viestit: lyhyet, kuvaavat muutoksen tarkoituksen
- Ala commitoi `.env`-tiedostoja tai salaisuuksia
- CI ajaa: unit test → build → e2e (Playwright)
