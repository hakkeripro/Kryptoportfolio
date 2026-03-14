# Feature 12: Auth/Vault UX Redesign

**Status:** 🚧 TOTEUTUKSESSA
**ADR:** ADR-018
**Paketti:** `packages/core`, `packages/platform-web`, `apps/api`, `functions/`, `apps/web`
**Prioriteetti:** P1

## Tavoite

Uudistaa auth ja vault -UX niin etta kayttaja ympartaa mallin: **yksi tili + yksi vault passphrase + passkey helpottaa**. Nykyinen onboarding on sekava multi-device-kaytossa (KP-UX-001). Uusi flow: selkeat erilliset vaiheet (login → vault setup → passkey), Account-sivu passkey-hallintaan ja salasanan/passphrasen vaihtoon.

## Scope

**Mukana:**
- Route-uudistus (Welcome, Signup, Signin, Vault Setup Wizard, Vault Unlock)
- Vault Setup Wizard (passphrase + passkey step + done)
- Vault Unlock redesign (passkey primary, passphrase fallback)
- Account-sivu (passkeys, change password, change vault passphrase)
- Auth-jarjestyksen muutos: login/signup → vault setup (auth ensin)
- "Offline-only" -polku sailyy: vault setup ilman tilia (ei syncia)

**Ei mukana (myohemmin):**
- Sync modal UX (KP-UI-005)
- Dashboard alert popup (F15)
- Imports provider registry (F13)
- Billing/subscription (F14)

## Vaatimukset

### Auth flow
- [ ] `/welcome` -sivu: "Sign in" + "Create account" CTA:t + "What is Vault Passphrase?" -drawer
- [ ] `/auth/signup`: email + password + confirm password → onnistuminen ohjaa vault setupiin
- [ ] `/auth/signin`: email + password → onnistuminen ohjaa vault unlockiin (tai vault setupiin jos ei ole)
- [ ] Signup/signin virheviestit inhimillisia (ei raw stack trace, ei generic "error")
- [ ] Password validointi: vahintaan 8 merkkia, nayta virhe reaaliajassa
- [ ] "Offline-only" -polku: `/welcome` → "Use without account" → vault setup → dashboard (ei syncia)

### Vault Setup Wizard
- [ ] Step 1 (`/vault/setup`): passphrase + confirm + "I saved it somewhere safe" -checkbox
- [ ] Step 1: "Generate passphrase" -nappi luo 5-7 sanan passphrase-nauhan + copy-to-clipboard
- [ ] Step 2 (`/vault/setup/passkey`): "Enable Passkey (recommended)" + "Skip for now"
- [ ] Step 2: Jos laite ei tue passkeyta → nayta info + tarjoa "Skip"
- [ ] Done (`/vault/setup/done`): yhteenveto (account, passphrase, passkey) + "Go to Dashboard"
- [ ] Vault passphrase tallentuu sessionStorageen setupin jalkeen (ei tarvitse syottaa heti uudelleen)

### Vault Unlock
- [ ] `/vault/unlock`: kaksi korttia — Passkey (default, jos saatavilla) + Vault Passphrase
- [ ] Passkey-unlock kaynnistyy yhdella napinpainalluksella (ei extra-steppeja)
- [ ] Passphrase-unlock: syota passphrase + "Unlock" -nappi
- [ ] Microcopy: "Same Vault Passphrase works on all devices" + "Passkey is device-specific"
- [ ] Vaara passphrase nayttaa selkean virheviestin ("Wrong passphrase. Try again.")
- [ ] Onnistunut unlock ohjaa `?next=` -parametrin mukaan (default `/dashboard`)

### Multi-device (kriittinen)
- [ ] Device A: signup + vault setup (passphrase) → data toimii
- [ ] Device B: signin (sama tili) + syota sama passphrase → data aukeaa
- [ ] Device B: voi lisata oman passkeyn (Account → Passkeys)
- [ ] Passkey on laitekohtainen: poistaminen yhdelta laitteelta ei vaikuta toiseen

### Account-sivu
- [ ] `/account` -reitti, navigaatiossa "Account" -linkki
- [ ] **Passkeys-osio:** lista tallennetuista passkeista + "Add Passkey" + "Remove" per passkey
- [ ] **Security-osio:** "Change password" (vaatii nykyisen) + "Change vault passphrase" (vaatii nykyisen)
- [ ] **Data-osio:** "Export encrypted backup" (tulevaisuudessa, nyt placeholder/disabled)
- [ ] Nayta passkey-tuki: jos laite ei tue → "Your device does not support passkeys" info

### Siirtyminen vanhasta uuteen
- [ ] Nykyinen `/onboarding` redirectaa uuteen flowiin (backward compat)
- [ ] Olemassa oleva vault data sailyy — ei migraatiota, pelkka UI-muutos
- [ ] Olemassa oleva passkey wrap (localStorage `kp_vault_passkey_wrap_v1`) toimii edelleen

## Tekninen suunnitelma

### Domain (packages/core)

Ei uusia skeemoja — auth ja vault ovat platform-tason konsepteja.

Mahdollinen lisays:
- `packages/core/src/utils/passphraseGenerator.ts`: generoi 5-7 sanan passphrase (EFF wordlist subset, ~200 sanaa riittaa). Pure function, ei side effecteja.

### Platform (packages/platform-web)

**Ei DB-skeemamuutoksia** — vault blob ja passkey wrap sailyvat nykyisilla formaateilla.

Muutokset:
- `packages/platform-web/src/vault/webVault.ts`: ei muutoksia (createVaultBlob / openVaultBlob toimivat)
- `apps/web/src/vault/passkey.ts`: pienet parannukset:
  - `listPasskeyWraps()` → palauta lista (nyt vain yksi; tulevaisuudessa multi)
  - `removePasskeyWrap(credId)` → poista tietty passkey
  - Sailyta nykyinen hmac-secret/PRF -lahestymistapa

### API (apps/api + functions/)

**Uusi endpoint:**
- `PUT /v1/auth/password` — vaihda salasana (vaatii `{currentPassword, newPassword}`, JWT auth)
  - Validoi nykyinen salasana ensin
  - Hashaa uusi salasana (PBKDF2)
  - Palauta `{ok: true}` tai `401`

**Ei muita API-muutoksia** — vault passphrase on puhtaasti client-side, serveri ei koskaan nae sita.

Shared logic:
- `packages/core/src/api/authCrypto.ts`: lisaa `changePassword(currentPw, newPw, storedHash)` -funktio

### Web (apps/web)

#### Uudet sivut/komponentit

| Tiedosto | Kuvaus | Arvio rivit |
|----------|--------|-------------|
| `pages/WelcomePage.tsx` | Welcome-sivu: CTA:t + passphrase info drawer | ~80 |
| `pages/SignupPage.tsx` | Rekisterointi: email + password + confirm | ~90 |
| `pages/SigninPage.tsx` | Kirjautuminen: email + password | ~70 |
| `pages/VaultSetupPage.tsx` | Wizard: Step 1 (passphrase) → Step 2 (passkey) → Done | ~150 |
| `pages/AccountPage.tsx` | Account-sivu: passkeys + security + data | ~120 |
| `components/PassphraseGenerator.tsx` | "Generate passphrase" -komponentti (nayta + copy) | ~40 |
| `components/PasskeyCard.tsx` | Passkey info/action -kortti (kaytossa Unlock + Setup + Account) | ~50 |

#### Muokattavat tiedostot

| Tiedosto | Muutos |
|----------|--------|
| `app/App.tsx` | Uudet reitit: `/welcome`, `/auth/signup`, `/auth/signin`, `/vault/setup`, `/account`. Poista `/onboarding` (redirectaa). |
| `pages/UnlockPage.tsx` | Refaktoroi: kaksi korttia (passkey + passphrase), microcopy. |
| `components/RequireUnlocked.tsx` | Muuta: `vaultSetup = false` → ohjaa `/welcome` (ei `/onboarding`). |
| `components/Shell.tsx` | Lisaa "Account" navigaatiolinkki. |
| `store/useAuthStore.ts` | Lisaa: `changePassword(current, new)` action. |
| `store/useVaultStore.ts` | Lisaa: `changePassphrase(current, new)` action (re-encrypt vault blob). |

#### Poistettavat tiedostot

| Tiedosto | Syy |
|----------|-----|
| `pages/OnboardingPage.tsx` | Korvattu WelcomePage + SignupPage + VaultSetupPage -flowlla. Sailyta redirect. |

#### Routing

```
/welcome              → WelcomePage (public)
/auth/signup           → SignupPage (public)
/auth/signin           → SigninPage (public)
/vault/setup           → VaultSetupPage (vaatii auth TAI offline-mode)
/vault/setup/passkey   → VaultSetupPage step 2 (ei erillinen sivu, wizard state)
/vault/setup/done      → VaultSetupPage step 3
/vault/unlock          → UnlockPage (public, vaatii vault blob)
/account               → AccountPage (vaatii unlocked vault)
/dashboard, /portfolio, ... → sailyvat ennallaan (RequireUnlocked)
```

#### Flow-kaavio

```
Uusi kayttaja:
  /welcome → /auth/signup → /vault/setup (step1→step2→done) → /dashboard

Palaava kayttaja (sama laite):
  /welcome → /auth/signin → /vault/unlock (passkey) → /dashboard

Palaava kayttaja (uusi laite):
  /welcome → /auth/signin → /vault/unlock (passphrase) → /dashboard
  Myohemmin: /account → Add Passkey

Offline-only:
  /welcome → "Use without account" → /vault/setup → /dashboard (ei syncia)
```

## UI-suunnitelma

Perustuu `docs/UI_MOCK_SPEC.md` osioihin 1-5 ja 10. Tailwind UI, ei ulkoisia komponenttikirjastoja.

### Welcome-sivu
- Keskitetty layout, logo + tagline
- Kaksi isoa CTA-nappia: "Sign in" (primary), "Create account" (secondary)
- Pieni linkki: "Use without account" (tertiary, muted)
- "What is Vault Passphrase?" → avaa alhaalta drawer/accordion

### Vault Setup Wizard
- Progress indicator (step 1/3, 2/3, 3/3)
- Step 1: Passphrase-kentta + confirm + checkbox + "Generate passphrase" -painike
- Step 2: Passkey CTA + skip + laitetuki-info
- Done: checklist-yhteenveto + "Go to Dashboard" CTA

### Vault Unlock
- Kaksi korttia vierekkain (tai paallekkain mobiilissa):
  - Kortti 1: "Unlock with Passkey" (iso, primary, oletusvalinta)
  - Kortti 2: "Use Vault Passphrase" (pienempi, secondary)
- Microcopy korttien alla

### Account-sivu
- Kolme section-korttia: Passkeys, Security, Data
- Passkeys: taulukko (created date, device name) + "Add Passkey" + "Remove"
- Security: kaksi lomaketta (change password, change passphrase)

## Testaussuunnitelma

### Unit-testit (vitest)

| Testi | Kohde | Kuvaus |
|-------|-------|--------|
| passphraseGenerator.test.ts | `core/utils` | Generoi 5-7 sanaa, ei duplikaatteja, entropiariittava |
| authCrypto.test.ts | `core/api` | changePassword: validoi nykyinen, hashaa uusi, hylkaa vaara |

### E2E-testit (playwright)

| Testi | Flow | Kuvaus |
|-------|------|--------|
| auth-signup-flow.spec.ts | Signup | Welcome → Signup → Vault Setup → Dashboard |
| auth-signin-flow.spec.ts | Signin | Welcome → Signin → Unlock → Dashboard |
| auth-offline-flow.spec.ts | Offline | Welcome → "Use without account" → Vault Setup → Dashboard |
| account-passkey.spec.ts | Account | Passkey add/remove (vain jos CI-ymparisto tukee WebAuthn mockia) |
| account-change-password.spec.ts | Account | Change password: oikea nykyinen → onnistuu, vaara → epaonnistuu |
| account-change-passphrase.spec.ts | Account | Change passphrase: re-encrypt vault, unlock toimii uudella |

### Manuaalinen testaus

- [ ] Multi-device: Desktop + mobiili, sama tili, sama passphrase → data aukeaa
- [ ] Passkey: enable laitteella A, poista, enable uudelleen
- [ ] Offline-only: kaytto ilman tilia, myohemmin tilin luonti

## Riippuvuudet

| Riippuvuus | Status | Kommentti |
|------------|--------|-----------|
| Vaihe 0: T-003 (store hajotus) | ✅ Valmis | useAuthStore, useVaultStore eriytetty |
| P0: KP-UI-001 (passphrase session) | ✅ Korjattu | sessionStorage-ratkaisu toimii |
| ADR-011 (E2E encryption) | ✅ Voimassa | Zero-knowledge sailyy |
| ADR-018 (Auth/Vault UX) | ✅ PROPOSED | Tama speksi toteuttaa ADR:n |

## Riskit / rajoitteet

1. **WebAuthn hmac-secret -tuki**: Nykyinen passkey.ts kayttaa hmac-secret extensiota, joka ei ole universaalisti tuettu. PRF-extension olisi laajemmin tuettu mutta vaatisi refaktorointia. **Paatos:** sailytetaan nykyinen, lisataan fallback-viesti ("Your device does not support passkeys").

2. **Passphrase vaihto**: Vault passphrase vaihto vaatii kaiken datan re-encryptiota (vault blob). Tama on O(1) koska vault blob sisaltaa vain avainmateriaalin, ei kaikkea dataa. Sync-kirjekuoret on jo salattu erikseen.

3. **Offline-only → online -siirtyma**: Kayttaja voi aloittaa offline-only ja myohemmin luoda tilin. Vault data sailyy, mutta sync vaatii uuden uploadin. Tama flow on toistaiseksi manuaalinen (Settings → Login).

4. **Backward compatibility**: Nykyiset kayttajat joilla on vault + tili → `/onboarding` redirectaa `/welcome`iin. Vault blob ja passkey wrap sailyvat, ei migraatiota.

---

## Toteutuksen jalkeen taytettavat

### Tehdyt muutokset
- [x] Core: passphraseGenerator (EFF wordlist ~200, 5-7 sanaa) + changePassword
- [x] Platform: passkey listPasskeyWraps + removePasskeyWrap
- [x] API: PUT /v1/auth/password (Fastify + Hono)
- [x] Store: useAuthStore.changePassword + useVaultStore.changePassphrase
- [x] Pages: WelcomePage, SignupPage, SigninPage, VaultSetupPage (3-step wizard), AccountPage
- [x] Components: PassphraseGenerator, PasskeyCard
- [x] Routing: /welcome, /auth/signup, /auth/signin, /vault/setup, /vault/unlock, /account
- [x] Backward compat: /onboarding → /welcome, /unlock → /vault/unlock
- [x] E2E-testit paivitetty (shared helpers.ts)
- [ ] Erilliset E2E-testit (signup, signin, offline, change-password)

### Env-muutokset
- Ei uusia ymparistomuuttujia

### Deploy-ohjeet
- Ei erityisia deploy-vaiheita (puhtaasti frontend + yksi uusi API-endpoint)
- Hosted API: `PUT /v1/auth/password` lisattava Hono-routeihin + Fastify-routeihin
