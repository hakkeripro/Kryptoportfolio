# Feature 32: Auth Simplification — Transparent Vault, No User Passphrase

**Status:** 📋 SUUNNITTEILLA
**ADR:** ADR-018 (päivitys), ADR-011
**Paketit:** `packages/platform-web`, `apps/web`, `apps/api`, `functions/`
**Prioriteetti:** P0 — pre-requisite Featurelle 33 (Google OAuth) ja 34 (Passkey)

---

## Tavoite

Poistetaan käyttäjältä näkyvä vault passphrase kokonaan. Vault-avain generoidaan automaattisesti rekisteröinnissä ja siirretään laitteiden välille taustalla läpinäkyvästi. Käyttäjä kirjautuu **vain email + salasanalla** — vault aukeaa automaattisesti ilman erillistä vaihetta.

### Ennen → Jälkeen

| | Ennen | Jälkeen |
|---|---|---|
| **Rekisteröinti** | email + salasana + vault passphrase + confirm + veromaa | email + salasana + confirm + veromaa |
| **Kirjautuminen** | email + salasana → (mahdollinen passphrase-fallback) → /home | email + salasana → /home |
| **Uusi laite** | email + salasana → vault passphrase manuaalisesti | email + salasana → /home (blob auto-decrypt) |
| **Sessio vanhenee** | "Enter vault passphrase" | "Enter your password to continue" |

---

## Arkkitehtuuriperiaate

Vault-avain on **satunnainen 256-bit avain** (ei johdettu salasanasta). Se salataan login-salasanalla (PBKDF2+AES-GCM, sama logiikka kuin nyt) ja tallennetaan serverille. Tämä:
- Säilyttää zero-knowledge-mallin (serveri ei koskaan näe vault-avainta tai login-salasanaa cleartext-muodossa)
- Irrottaa vault-avaimen login-salasanasta → salasanan vaihto ei riko vaultia (vain blob re-enkryptoidaan)
- Mahdollistaa Feature 33:n (OAuth) — OAuth-käyttäjillä vault-avain voidaan suojata PIN:llä tai Passkeyllä

**Olemassa oleva blob-infrastruktuuri säilyy** (`vaultKeyBlob.ts`, `/v1/vault/key`). Muutos on UX-taso: passphrase häviää käyttäjältä, ei kryptologiikasta.

---

## Vaatimukset

### Rekisteröinti
- [ ] Vault-avain generoidaan automaattisesti (`crypto.getRandomValues`, 32 tavua, base64-enkoodattu)
- [ ] Vault blob uploataan serverille **pakollisena** osana rekisteröintiä (ei non-fatal)
- [ ] Jos blob-upload epäonnistuu, rekisteröinti epäonnistuu virheviestillä — käyttäjä voi yrittää uudelleen
- [ ] Käyttäjältä ei kysytä passphrasea missään vaiheessa

### Kirjautuminen
- [ ] Login hakee blob serveriltä, dekryptaa login-salasanalla, avaa vaultin — kaikki automaattisesti
- [ ] Jos blob puuttuu serveriltä (vanha käyttäjä / poikkeustila): näytetään selkeä virheviesti, ei passphrase-lomaketta
- [ ] Kirjautuminen ohjaa suoraan `/home`

### Session vanheneminen / Vault lock
- [ ] Kun vault on lukittu mutta token on voimassa (sessio vanhentunut, sivu päivitetty): `UnlockPage` pyytää **login-salasanaa** (ei passphrasea)
- [ ] Unlock-flow: käyttäjä syöttää login-salasanan → blob haetaan serveriltä tokenilla → vault avataan automaattisesti

### Salasanan vaihto
- [ ] Salasanan vaihto re-enkryptaa vault-blobiin tallennetun vault-avaimen uudella salasanalla
- [ ] Vault-avain itsessään ei muutu → sync-envelopes pysyvät ehjinä
- [ ] Olemassa oleva `changePassword`-logiikka pätee: blob re-enkryptoidaan (jo toteutettu, säilyy)

### Poistettavat
- [ ] `VaultSetupPage.tsx` — sivu poistetaan kokonaan
- [ ] `SignupWithVaultPage.tsx` → korvataan `SignupPage.tsx`:llä (ilman vault-osiota)
- [ ] Fallback-lomake `SigninPage`:lta (passphrase-syöttö autoUnlocked=false -tapauksessa)
- [ ] `PassphraseGenerator.tsx` — komponentti poistetaan
- [ ] `/vault/setup` -reitti `App.tsx`:stä
- [ ] `uploadVaultKeyBlob`, `signInAndUnlockVault` storeista — korvataan yksinkertaisemmilla funktioilla

---

## Tekninen suunnitelma

### 1. Platform (`packages/platform-web`)

**Uusi funktio** `packages/platform-web/src/vault/vaultKey.ts`:
```ts
/** Generates a cryptographically random vault key (base64, 256-bit). */
export function generateVaultKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}
```

**Ei muutoksia:**
- `webVault.ts` — core PBKDF2/AES-GCM logiikka säilyy täysin
- `vaultKeyBlob.ts` — blob encrypt/decrypt säilyy
- `syncClient.ts` — sync-envelopes käyttävät vault-avainta passphrasena, täysin yhteensopiva

**Viedään julkiseksi** `index.ts`:ssä:
```ts
export { generateVaultKey } from './vault/vaultKey.js';
```

---

### 2. Store (`apps/web/src/store`)

#### `useAuthStore.ts` — muutokset

**Poistetaan:**
- `uploadVaultKeyBlob()` — logiikka siirtyy `register()`:n sisälle
- `signInAndUnlockVault()` — korvataan uudistetulla `login()`-funktiolla

**Uudistettu `register()`:**
```ts
register: async (email, password) => {
  // 1. Rekisteröi tili
  const token = await callRegisterApi(email, password);
  set({ token, email, ... });

  // 2. Rekisteröi laite
  await registerDevice(base, token, deviceId, 'web');

  // 3. Generoi vault-avain automaattisesti
  const vaultKey = generateVaultKey();

  // 4. Luo paikallinen vault
  await useVaultStore.getState().setupVault(vaultKey);

  // 5. Upload blob serverille — PAKOLLINEN (throws on failure)
  const { blob, saltBase64 } = await encryptVaultKeyBlob(vaultKey, password);
  await apiFetch(base, '/v1/vault/key', {
    method: 'PUT',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ blob, salt: saltBase64 }),
  });
}
```

**Uudistettu `login()`:**
```ts
login: async (email, password) => {
  // 1. Autentikointi
  const token = await callLoginApi(email, password);
  set({ token, email, ... });

  // 2. Laite rekisteröinti
  await registerDevice(...);

  // 3. Hae blob ja avaa vault automaattisesti
  const { blob, salt } = await apiFetch(base, '/v1/vault/key', { ... });
  if (!blob || !salt) throw new Error('vault_not_found');
  const vaultKey = await decryptVaultKeyBlob(blob, password);
  await useVaultStore.getState().setupVault(vaultKey);
}
```

**Uusi `unlockWithPassword()`** — käytetään UnlockPage:ssa:
```ts
unlockWithPassword: async (password) => {
  const { token, apiBase } = get();
  if (!token) throw new Error('not_authenticated');
  const { blob } = await apiFetch(apiBase, '/v1/vault/key', { ... });
  if (!blob) throw new Error('vault_not_found');
  const vaultKey = await decryptVaultKeyBlob(blob, password);
  await useVaultStore.getState().setupVault(vaultKey);
}
```

**`changePassword()` säilyy** — re-enkryptaa vault-blobissa olevan vault-avaimen uudella salasanalla (jo toimii).

---

#### `useVaultStore.ts` — ei merkittäviä muutoksia

`loadVaultStatus()`, `setupVault()`, `unlockVault()`, `lockVault()` pysyvät. `changePassphrase()` voidaan poistaa (feature not needed anymore).

---

### 3. API — ei muutoksia

`/v1/vault/key` GET ja PUT säilyvät täysin ennallaan. Molemmat backends (`apps/api`, `functions/`) koskematta.

---

### 4. Web UI (`apps/web/src`)

#### Poistetaan kokonaan
- `pages/VaultSetupPage.tsx`
- `pages/SignupWithVaultPage.tsx`
- `components/PassphraseGenerator.tsx`
- Reitti `/vault/setup` App.tsx:stä

#### Uusi `pages/SignupPage.tsx`
Selkeä, yksinkertainen rekisteröintilomake:

```
// YOUR ACCOUNT
  Email
  Password (min 8 merkkiä)
  Confirm password

// TAX COUNTRY
  [FI] [SE] [DE] [OTHER]

[Create account →]
```

**Ei vault-osiota, ei passphrase-kenttiä.** Nappi on disabled kunnes email + salasana validit. Submit:
1. `register(email, password)` → navigoi `/home`
2. Jos epäonnistuu: näytetään virhe inline

UI-taso: "Encrypted Luxury" -teema. Logo ylhäällä. Minimalistinen, laadukas.

#### Uudistettu `pages/SigninPage.tsx`
Puhdas, symmetrinen signup:in kanssa:

```
Logo

// SIGN IN
  Email
  Password

[Sign in →]

Don't have an account? Create one →
```

**Ei fallback-lomaketta.** Jos vault_not_found error: selkeä virhe "We couldn't access your vault. Please contact support." — ei salasanasyöttöä.

#### Uudistettu `pages/UnlockPage.tsx`
Kun vault on lukittu mutta token on voimassa:

```
Logo

Your session expired. Enter your
password to continue.

  Password

[Continue →]
```

Kutsuu `unlockWithPassword(password)`. Ei mainintaa "vault passphrasesta".

#### `App.tsx` — routing
```ts
// Poistetaan:
<Route path="/vault/setup" element={<VaultSetupPage />} />
<Route path="/auth/signup" element={<SignupWithVaultPage />} />

// Lisätään:
<Route path="/auth/signup" element={<SignupPage />} />
```

#### `WelcomePage.tsx`
Poistetaan vault-setup-redirect (`!vaultSetup → /vault/setup?ondevice=1`). Uusi logiikka:
- `token && vaultReady && passphrase` → `/home`
- `token && vaultReady && !passphrase` → `/vault/unlock`
- muuten → welcome-näkymä

---

### 5. Error handling — vault_not_found

Tämä tapaus (blob puuttuu serveriltä) tulee olemaan erittäin harvinainen production-käytössä, koska blob-upload on nyt pakollinen osa rekisteröintiä. Mutta se täytyy käsitellä:

**SigninPage**: jos `vault_not_found` → `"We couldn't restore your vault. This may happen if your account was created with an older version of the app. Please sign out and create a new account, or contact support."`

**Ei passphrase-fallbackia.** Zero-knowledge tarkoittaa: jos avain on hukassa, data on hukassa. Tämä pitää kommunikoida selkeästi, ei piilottaa monimutkaisella UI:lla.

---

## UI/UX-spesifikaatio

### Yleiset periaatteet
- Kaikilla auth-sivuilla **Logo ylhäällä** (symmetrisyys)
- Section-headerit `// SECTION` -tyylillä (font-mono, uppercase, white/30)
- Input-kentät: `bg-surface-base border border-border` (ei `bg-white` / `bg-gray`)
- Submit-nappi: `bg-brand` + disabled-state `opacity-60`
- Error-viestit: inline, `text-semantic-error`, ei toast-poppareita
- Loading: napissa teksti muuttuu ("Creating account…" / "Signing in…")
- Siirtymät: `motion.div` fade-in ylhäältä (kuten WelcomePage)

### SignupPage layout (max-w-sm, centered)
```
[Logo]

Create your account

// YOUR ACCOUNT
  Email ___________
  Password ___________
  Confirm password ___________

// TAX COUNTRY
  [🇫🇮 Finland] [🌍 Other]

[Create account →]

Already have an account? Sign in →
Use without account →
```

### SigninPage layout (max-w-sm, centered)
```
[Logo]

Sign in

// SIGN IN
  Email ___________
  Password ___________

[Sign in →]

Don't have an account? Create one →
```

### UnlockPage layout (max-w-sm, centered)
```
[Logo]

[Lock icon]

Session expired

Enter your password to continue.

  Password ___________

[Continue →]

Sign out →
```

---

## Testaussuunnitelma

### Unit-testit (`pnpm test`)

**`vaultKey.test.ts`** (uusi):
- `generateVaultKey()` palauttaa 32-tavuisen base64-merkkijonon
- Kaksi peräkkäistä kutsua eivät palauta samaa arvoa

**`useAuthStore` (olemassa oleva testi päivitetään):**
- `register()` kutsuu `setupVault()` ja vault/key PUT:ia
- `register()` heittää virheen jos blob-upload epäonnistuu
- `login()` kutsuu vault/key GET:iä ja avaa vaultin automaattisesti
- `login()` heittää `vault_not_found` jos blob puuttuu

### E2E-testit (Playwright)

**`auth-signup.spec.ts`** (päivitetään):
- Rekisteröinti onnistuu email + salasana + country → ohjaa /home
- Rekisteröintilomakkeessa ei vault passphrase -kenttiä
- Virheellinen email → inline virhe
- Liian lyhyt salasana → inline virhe

**`auth-signin.spec.ts`** (päivitetään):
- Kirjautuminen email + salasana → /home
- Virheelliset tunnukset → inline virhe
- Ei fallback-lomaketta missään tilanteessa

**`auth-unlock.spec.ts`** (päivitetään):
- Vault lock + token voimassa → UnlockPage näytetään
- Oikea salasana → /home
- Väärä salasana → inline virhe

---

## Riippuvuudet

- Feature 31 (Multi-device Vault) — toteutettu, tämä feature refaktoroi sen UX:ää
- Ei riippuvuuksia muihin avoimiin featureihin

**Täytyy toteuttaa ennen:**
- Feature 33 (Google OAuth + PIN)
- Feature 34 (Passkey / WebAuthn)

---

## Riskit ja rajoitteet

| Riski | Todennäköisyys | Mitigaatio |
|-------|----------------|------------|
| Blob-upload epäonnistuu rekisteröinnissä (verkko) | Matala | Näytetään selkeä virhe, käyttäjä voi yrittää uudelleen |
| `vault_not_found` olemassa olevilla käyttäjillä | Erittäin matala (ei tuotantokäyttäjiä) | Selkeä virheviesti + ohje luo uusi tili |
| `changePassword` rikkoo vaultin | Ei riski — vault-avain pysyy samana, vain blob re-enkryptoidaan | - |
| `UnlockPage` — käyttäjä unohtaa salasanansa | Harvinainen | Standard "forgot password" flow riittää (ei ZK-ongelma, koska salasana ei ole vault-avain) |

**Ei tarvita DB-migraatioita** — `vault_key_blob` ja `vault_key_salt` -sarakkeet pysyvät.

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/platform-web/src/vault/vaultKey.ts` — uusi: `generateVaultKey()`
- [ ] `packages/platform-web/src/index.ts` — exportoi `generateVaultKey`
- [ ] `apps/web/src/store/useAuthStore.ts` — uudistettu `register()`, `login()`, uusi `unlockWithPassword()`; poistettu `signInAndUnlockVault()`, `uploadVaultKeyBlob()`
- [ ] `apps/web/src/store/useVaultStore.ts` — poistettu `changePassphrase()`
- [ ] `apps/web/src/pages/SignupPage.tsx` — uusi (korvaa SignupWithVaultPage)
- [ ] `apps/web/src/pages/SignupWithVaultPage.tsx` — poistettu
- [ ] `apps/web/src/pages/VaultSetupPage.tsx` — poistettu
- [ ] `apps/web/src/pages/SigninPage.tsx` — uudistettu (poistettu fallback)
- [ ] `apps/web/src/pages/UnlockPage.tsx` — uudistettu ("enter password")
- [ ] `apps/web/src/pages/WelcomePage.tsx` — uudistettu redirect-logiikka
- [ ] `apps/web/src/components/PassphraseGenerator.tsx` — poistettu
- [ ] `apps/web/src/app/App.tsx` — routing päivitetty
- [ ] `packages/platform-web/src/vault/vaultKey.test.ts` — uudet unit-testit
- [ ] E2E-testit päivitetty

### ADR-päivitys
- [ ] `docs/adr/ADR-018-auth-vault-ux.md` — päivitetty "Accepted" statukseen, kirjattu uusi päätös

### Deploy-ohjeet
- Ei DB-migraatioita tarvita
- Ei ympäristömuuttuja-muutoksia
- Standard deploy Cloudflare Pages:iin
