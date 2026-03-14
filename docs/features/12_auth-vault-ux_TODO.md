# Feature 12: Auth/Vault UX Redesign - Implementation TODO

## Phase 1: Core Domain
- [x] Luo `packages/core/src/utils/passphraseGenerator.ts` — EFF wordlist subset (~200 sanaa), generoi 5-7 sanaa
- [x] Lisaa `changePassword()` funktioon `packages/core/src/api/authCrypto.ts`
- [x] Unit-testi: `passphraseGenerator.test.ts` (9 testia: word count, duplikaatit, entropia)
- [x] Unit-testi: `authCrypto.test.ts` (3 testia: oikea pw, vaara pw, eri hash)
- [x] `pnpm test` lapaistava (103/103)

## Phase 2: Platform + Passkey
- [x] `apps/web/src/vault/passkey.ts`: lisaa `listPasskeyWraps()` (palauta lista localStorage-avaimista)
- [x] `apps/web/src/vault/passkey.ts`: lisaa `removePasskeyWrap(credId)` (poista tietty passkey wrap)
- [x] Sailyta nykyinen hmac-secret/PRF -lahestymistapa

## Phase 3: API Endpoint
- [x] `apps/api/src/routes/auth.ts`: lisaa `PUT /v1/auth/password` (Fastify)
- [x] `functions/api/routes/auth.ts`: lisaa `PUT /v1/auth/password` (Hono)
- [x] Validoi nykyinen salasana ensin, hashaa uusi (PBKDF2)
- [x] Palauta `{ok: true}` tai 401

## Phase 4: Store Actions
- [x] `apps/web/src/store/useAuthStore.ts`: lisaa `changePassword(currentPw, newPw)` action
- [x] `apps/web/src/store/useVaultStore.ts`: lisaa `changePassphrase(currentPp, newPp)` action
- [x] changePassphrase: re-encrypt vault blob uudella passphrasella

## Phase 5: New Pages
- [x] `pages/WelcomePage.tsx` — Sign in + Create account CTA + "Use without account" + passphrase info drawer
- [x] `pages/SignupPage.tsx` — email + password + confirm, validointi (8+ merkkia), ohjaus vault setupiin
- [x] `pages/SigninPage.tsx` — email + password, ohjaus vault unlock/setupiin
- [x] `pages/VaultSetupPage.tsx` — 3-step wizard:
  - [x] Step 1: passphrase + confirm + "I saved it" checkbox + "Generate passphrase"
  - [x] Step 2: "Enable Passkey" + "Skip for now" + laitetuki-tarkistus
  - [x] Step 3 (Done): yhteenveto + "Go to Dashboard"
- [x] `pages/AccountPage.tsx` — 3 osiota:
  - [x] Passkeys: lista + Add + Remove
  - [x] Security: Change password + Change vault passphrase
  - [x] Data: Export placeholder (disabled)

## Phase 6: New Components
- [x] `components/PassphraseGenerator.tsx` — generoi + nayta + copy-to-clipboard
- [x] `components/PasskeyCard.tsx` — passkey info/action kortti (kaytossa Setup, Unlock)

## Phase 7: Modified Files
- [x] `app/App.tsx`: lisaa uudet reitit, `/onboarding` → redirect `/welcome`, `/unlock` → `/vault/unlock`
- [x] `pages/UnlockPage.tsx`: paremmat virheviestit, "Account → Passkeys" tip
- [x] `components/RequireUnlocked.tsx`: ohjaa `/welcome` + `/vault/unlock` (ei `/onboarding` / `/unlock`)
- [x] `components/Shell.tsx`: lisaa "Account" navigaatiolinkki

## Phase 8: Testing
- [x] Unit-testit: 103/103 pass (passphraseGenerator 9, authCrypto 3)
- [x] Build: OK (Vite code splitting, uudet chunk-tiedostot)
- [x] E2E-testit paivitetty uuteen auth flowiin (shared helpers.ts)
- [ ] E2E: `auth-signup-flow.spec.ts` — erillinen testi (ei viela)
- [ ] E2E: `auth-signin-flow.spec.ts` — erillinen testi (ei viela)
- [ ] E2E: `auth-offline-flow.spec.ts` — erillinen testi (ei viela)
- [ ] E2E: `account-change-password.spec.ts` — erillinen testi (ei viela)

## Phase 9: Documentation
- [x] Paivita `docs/features/12_auth-vault-ux_TODO.md`
- [x] Paivita `docs/features/FEATURES_TODO.md` — Feature 12 status
- [x] Paivita `docs/SESSION_CONTEXT.md` — muutosloki

## Files Created
- [x] `packages/core/src/utils/passphraseGenerator.ts`
- [x] `packages/core/src/utils/passphraseGenerator.test.ts`
- [x] `packages/core/src/api/authCrypto.test.ts`
- [x] `apps/web/src/pages/WelcomePage.tsx`
- [x] `apps/web/src/pages/SignupPage.tsx`
- [x] `apps/web/src/pages/SigninPage.tsx`
- [x] `apps/web/src/pages/VaultSetupPage.tsx`
- [x] `apps/web/src/pages/AccountPage.tsx`
- [x] `apps/web/src/components/PassphraseGenerator.tsx`
- [x] `apps/web/src/components/PasskeyCard.tsx`
- [x] `apps/web/tests-e2e/helpers.ts`

## Files Modified
- [x] `packages/core/src/api/authCrypto.ts`
- [x] `packages/core/src/api/index.ts`
- [x] `packages/core/src/index.ts`
- [x] `apps/web/src/vault/passkey.ts`
- [x] `apps/api/src/routes/auth.ts`
- [x] `apps/api/src/services/auth.ts`
- [x] `functions/api/routes/auth.ts`
- [x] `functions/_lib/auth.ts`
- [x] `apps/web/src/store/useAuthStore.ts`
- [x] `apps/web/src/store/useVaultStore.ts`
- [x] `apps/web/src/app/App.tsx`
- [x] `apps/web/src/pages/UnlockPage.tsx`
- [x] `apps/web/src/components/RequireUnlocked.tsx`
- [x] `apps/web/src/components/Shell.tsx`
- [x] `apps/web/tests-e2e/smoke.spec.ts`
- [x] `apps/web/tests-e2e/auth-errors.spec.ts`
- [x] `apps/web/tests-e2e/alerts-server.spec.ts`
- [x] `apps/web/tests-e2e/assets-mapping.spec.ts`
- [x] `apps/web/tests-e2e/coinbase-import.fixture.spec.ts`
- [x] `apps/web/tests-e2e/tax-report.spec.ts`
