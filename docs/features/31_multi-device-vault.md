# Feature 31: Multi-device Vault

**Status:** ❌ EI TOTEUTETTU
**ADR:** ADR-011 (E2E Encryption), ADR-018 (Auth/Vault UX)
**Paketti:** `packages/platform-web`, `apps/api`, `functions/`, `apps/web`
**Prioriteetti:** P0 — kriittisin UX-ongelma ennen betaa

---

## Tavoite

Uudella laitteella kirjautuva käyttäjä ei tällä hetkellä pysty avaamaan vaultiaan ilman vault passphrasea — ja suurin osa käyttäjistä ei muista sitä. Tämä johtaa dead endiin.

**Ratkaisu:** Vault passphrase salataan käyttäjän login-salasanalla (PBKDF2 + AES-GCM) ja tallennetaan palvelimelle. Uudella laitteella kirjautuminen riittää vault-avaamiseen. Palvelin ei koskaan näe passphrasea selkotekstinä — zero-knowledge säilyy.

---

## Vaatimukset

### Toiminnalliset
- [ ] Uusi laite: kirjaudu sisään → vault auki automaattisesti (ei passphrase-promptia)
- [ ] Vanha laite (vault jo auki): toiminta ei muutu
- [ ] Vanhat käyttäjät (ei blobia palvelimella): fallback passphrase-syöttöön → blob luodaan ja tallennetaan kerralla
- [ ] Passphrase ei näy käyttäjälle normaalisti — ainoastaan Settings → Advanced → "Show recovery passphrase"
- [ ] Salasanan vaihto (`PUT /v1/auth/password`) re-enkryptaa blob uudella salasanalla

### Ei-toiminnalliset
- [ ] Zero-knowledge: palvelin tallentaa ainoastaan AES-GCM-ciphertextiä, ei koskaan selkotekstiä
- [ ] Blob puretaan vain onnistuneen login-salasanan jälkeen (väärä salasana → auth fail ennen kuin blobiin kosketaan)
- [ ] Offline-mode (`?offline=1`) säilyy muuttumattomana — vault avataan suoraan passphrasella

---

## Tekninen suunnitelma

### Kryptografiarakenne

```
loginPassword  ──PBKDF2──►  wrapKey (AES-GCM 256-bit)
                               │
vaultPassphrase ─encrypt──►  vault_key_blob  (tallennetaan palvelimelle)
                               │
loginPassword  ──PBKDF2──►  wrapKey
                               │
vault_key_blob  ─decrypt──►  vaultPassphrase  (uudella laitteella)
```

- **KDF:** PBKDF2-SHA-256, 150 000 iteraatiota, 16-tavuinen per-user salt
- **Salaus:** AES-GCM 256-bit, 12-tavuinen nonce
- **Format:** sama `VaultBlob`-skeema kuin `webVault.ts`:ssa (JSON → base64)
- **Salt:** erillinen `vault_key_salt` (ei sama kuin vault itsessään) — uniikki per käyttäjä, luodaan kerran

### Domain (packages/core)

Ei muutoksia domain-logiikkaan. Kaikki krypto tehdään `platform-web`-paketissa.

### Platform (packages/platform-web)

**Uusi tiedosto:** `src/vault/vaultKeyBlob.ts`

```typescript
export async function encryptVaultKeyBlob(
  passphrase: string,
  loginPassword: string,
): Promise<{ blob: VaultBlob; saltBase64: string }>

export async function decryptVaultKeyBlob(
  blob: VaultBlob,
  loginPassword: string,
): Promise<string>  // palauttaa passphrasen
```

- Käyttää olemassa olevaa `createVaultBlob` / `openVaultBlob` -apufunktiota
- Väärä `loginPassword` → `crypto.subtle.decrypt` heittää `DOMException` → wrapattaan `InvalidKeyError`
- Vienti `packages/platform-web/src/index.ts`:stä

### API (apps/api + functions/)

**DB-migraatio:** `scripts/migrations/2026-MM-DD-add-vault-key-blob.sql`

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_key_blob TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS vault_key_salt TEXT;
```

Myös päivitettävä `functions/_lib/db.ts` → `HOSTED_SCHEMA_SQL` (lisätään kolumnit `users`-tauluun).

**Fastify (apps/api/src/routes/vault-key.ts):**

```
GET  /v1/vault/key        → { blob, salt } | { blob: null }   (auth required)
PUT  /v1/vault/key        → { ok: true }                      (auth required)
  body: { blob: VaultBlob, salt: string }
```

**Hono (functions/api/routes/vault-key.ts):**

Identtiset endpointit Hono-routerina. Rekisteröidään `functions/api/[[path]].ts`:een.

Molemmissa:
- `requireAuth` → userId
- `PUT`: validointi Zod-skeemalla (`VaultBlobSchema` + `z.string()` salt)
- `GET`: palautetaan `{ blob: null, salt: null }` jos käyttäjällä ei vielä blobi

**Huomio salt-käsittelystä:** Salt luodaan clientillä ensimmäisellä tallennuksella ja palautetaan `GET`-kutsulla. Palvelin ei koskaan generoi salttia — client on authoritative.

**Salasananvaihto (`PUT /v1/auth/password`):**

Nykytoteutus vaihtaa vain `password_hash`. Feature 31 jälkeen client lähettää myös uuden blobin:
- Optionaalinen kenttä `newVaultKeyBlob` + `newVaultKeySalt` `PUT /v1/auth/password` -bodyssa
- Jos mukana → palvelin päivittää blobin samalla transaktiolla

### Web (apps/web)

#### `useAuthStore.ts` — signin-flow

Uusi `signInAndUnlockVault(email, password)` -action:
1. `POST /v1/auth/login` → token
2. `GET /v1/vault/key` → `{ blob, salt }`
3. Jos blob löytyy → `decryptVaultKeyBlob(blob, password)` → passphrase → `setupVault(passphrase)`
4. Jos blob puuttuu → fallback: navigoi `SigninPage` → näyttää passphrase-input-lomakkeen → setup + blob tallennetaan kerralla
5. Onnistuu → navigoi `/home`

#### `SigninPage.tsx`

- Normaali käyttö: ei passphrase-kenttää näkyvissä
- Fallback-tila: jos `GET /v1/vault/key` palauttaa `{ blob: null }` → pieni info ("Enter your vault passphrase to continue") + passphrase-input + "Continue"-nappi
- Fallback onnistuu → `encryptVaultKeyBlob` → `PUT /v1/vault/key` → `setupVault` → `/home`

#### `VaultSetupPage.tsx`

- `handlePassphraseSubmit` lopussa: jos `token` on asetettu (kirjautunut käyttäjä, ei offline) → `encryptVaultKeyBlob` + `PUT /v1/vault/key`
- `isOffline`-modessa: ei lähetetä blobi palvelimelle (ei tokenia)

#### `AccountPage.tsx` / Settings → Advanced

- Uusi osio: "Recovery Passphrase"
- Piilotettu oletuksena — "Show" -nappi paljastaa passphrasen vault-storesta
- Teksti: "Store this somewhere safe. It lets you recover your vault if you forget your password."

---

## UI-suunnitelma

### Normaali kirjautumispolku (uusi laite, blob löytyy)

```
SigninPage: email + password → [Sign In]
  → blob haetaan
  → vault auki automaattisesti
  → /home
```

Käyttäjä ei näe passphrase-kenttiä lainkaan.

### Fallback (uusi laite, ei blobi — vanha käyttäjä)

```
SigninPage: email + password → [Sign In]
  → blob ei löydy
  → SigninPage laajenee: "Enter your vault passphrase to continue"
  → passphrase-input + [Continue]
  → blob luodaan + tallennetaan → vault auki → /home
```

### VaultSetupPage — ei muutosta käyttäjälle

Blob tallennetaan automaattisesti taustalla setup-vaiheen lopussa.

### Settings → Advanced → Recovery Passphrase

"Show recovery passphrase" -linkki → vault tulee auki olla → passphrase näytetään blur-efektillä / copy-napilla.

---

## Testaus

### Unit-testit (vitest) — `packages/platform-web/src/vault/vaultKeyBlob.test.ts`

- [ ] `encryptVaultKeyBlob` + `decryptVaultKeyBlob` palauttaa alkuperäisen passphrasen
- [ ] Väärä `loginPassword` → heittää virheen (ei palauta passphrasea)
- [ ] Eri `loginPassword` → heittää virheen
- [ ] Tyhjä passphrase → enkryptaa ja dekryptaa oikein
- [ ] Blob-skeema vastaa `VaultBlobSchema`:a

### Unit-testit — `apps/api/src/routes/vault-key.test.ts` + `functions/api/routes/vault-key.test.ts`

- [ ] `PUT /v1/vault/key` tallentaa blobin (autentikoitu käyttäjä)
- [ ] `GET /v1/vault/key` palauttaa tallennetun blobin
- [ ] `GET /v1/vault/key` palauttaa `{ blob: null, salt: null }` jos ei ole tallennettu
- [ ] Ilman tokenia → 401

### E2E-testit (playwright) — `apps/web/tests-e2e/multi-device-vault.spec.ts`

- [ ] Uusi käyttäjä: signup → vault setup → logout → signin → `/home` (ei passphrase-promptia)
- [ ] Fallback: simuloi tilanne jossa blob puuttuu → passphrase-kenttä näkyy → syötetään → vault auki
- [ ] VaultSetupPage tallentaa blobin: tarkista `GET /v1/vault/key` palauttaa non-null blobin setupin jälkeen

---

## Riippuvuudet

- Ei riipu muista avoimista featureista
- ADR-011 (E2E Encryption) — noudatetaan zero-knowledge-periaatetta
- ADR-018 (Auth/Vault UX) — passphrase piilotetaan käyttäjältä

---

## Riskit / rajoitteet

| Riski | Todennäköisyys | Mitigaatio |
|-------|---------------|------------|
| Käyttäjä vaihtaa salasanan → blob vanhenee | Matala | `PUT /v1/auth/password` lähettää uuden blobin samalla kertaa |
| Blob korruptoituu palvelimella | Hyvin matala | Fallback passphrase-syöttöön toimii aina |
| Brute-force blob + offline | Matala | PBKDF2 150k iteraatiota + salasanavahvuusvaatimus 8 merkkiä |
| WebCrypto API ei tue vanhoja selaimia | Hyvin matala | Sama kuin vault itse — vaatimus jo olemassa |
| `vault_key_salt` siirtyy plaintext palvelimelle | Hyväksytty | Salt ei ole salainen — on julkinen KDF-parametri |

---

## Toteutuksen jälkeen täytettävät

### Tehdyt muutokset
- [ ] `packages/platform-web/src/vault/vaultKeyBlob.ts` — uusi
- [ ] `packages/platform-web/src/vault/vaultKeyBlob.test.ts` — uusi
- [ ] `packages/platform-web/src/index.ts` — lisätty exportit
- [ ] `scripts/migrations/YYYY-MM-DD-add-vault-key-blob.sql` — uusi
- [ ] `functions/_lib/db.ts` — `HOSTED_SCHEMA_SQL` päivitetty
- [ ] `apps/api/src/db/db.ts` — `ensureColumn` (vault_key_blob, vault_key_salt)
- [ ] `apps/api/src/routes/vault-key.ts` — uusi
- [ ] `apps/api/src/server.ts` — rekisteröi vault-key route
- [ ] `functions/api/routes/vault-key.ts` — uusi
- [ ] `functions/api/[[path]].ts` — rekisteröi vault-key route
- [ ] `apps/web/src/store/useAuthStore.ts` — `signInAndUnlockVault` action
- [ ] `apps/web/src/pages/SigninPage.tsx` — fallback passphrase-kenttä
- [ ] `apps/web/src/pages/VaultSetupPage.tsx` — blob tallennus setupin lopussa
- [ ] `apps/web/src/pages/AccountPage.tsx` — Recovery Passphrase -osio
- [ ] `apps/web/tests-e2e/multi-device-vault.spec.ts` — uusi

### Env-muutokset
- Ei uusia ympäristömuuttujia

### Deploy-ohjeet
1. Aja DB-migraatio Neon-kantaan: `DATABASE_URL="..." pnpm migrate:run`
2. Deploy Cloudflare Pages (automaattinen `main`-branchilta)
3. Paikallinen: `pnpm dev` — `ensureColumn` hoitaa SQLite-muutokset automaattisesti
