# UX Acceptance Criteria

Päivitetty: 2026-01-06

Tämä dokumentti tekee UI-mockista testattavan: jokaiselle flow’lle on hyväksymiskriteerit.

## A) Auth & Vault

### A1. Welcome (`/welcome`)
- [ ] Näyttää “Sign in” ja “Create account” ensisijaisina CTA:na
- [ ] “What is Vault Passphrase?” avaa drawerin, jossa kerrotaan:
  - [ ] E2E / zero-knowledge (server ei näe dataa)
  - [ ] Yksi passphrase per käyttäjä, toimii kaikilla laitteilla
  - [ ] Passkey helpottaa (ei pakollinen)

### A2. Signup (`/auth/signup`)
- [ ] Virheet ovat inhimillisiä (ei raw stack)
- [ ] Onnistuneen signupin jälkeen ohjaa vault setupiin
- [ ] Ei mahdollista jatkaa sovellukseen ilman vault setupia (ensikertalainen)

### A3. Vault setup Step 1 (`/vault/setup`)
- [ ] Passphrase + confirm vaaditaan
- [ ] “I saved it somewhere safe” vaaditaan (tai vastaava)
- [ ] “Use a generated passphrase” luo 5–7 sanan passphrase-nauhan ja copy-to-clipboard toimii
- [ ] On success:
  - [ ] vault luodaan
  - [ ] passphrase tallentuu **sessioniin** (fix KP-UI-001)

### A4. Vault setup Step 2 (`/vault/setup/passkey`)
- [ ] “Enable Passkey” kutsuu WebAuthn/Passkeys promptia tuetulla laitteella
- [ ] Jos laite ei tue passkeyta:
  - [ ] näytä info ja tarjoa “Skip”
- [ ] “Skip” ei estä käyttöä

### A5. Sign in (`/auth/signin`) + Unlock (`/vault/unlock`)
- [ ] Sign in käyttää vain email+password
- [ ] Unlock ruutu tarjoaa 2 tapaa:
  - [ ] Passkey (default) jos saatavilla
  - [ ] Vault passphrase
- [ ] Uudella laitteella:
  - [ ] käyttäjä voi kirjautua sisään
  - [ ] syöttää saman vault passphrase'n ja avata vaultin
  - [ ] voi lisätä passkeyn tälle laitteelle (Account → Security tai setup)

### A6. Multi-device (tärkein vaatimus)
- [ ] Sama käyttäjä + sama Vault Passphrase toimii vähintään kahdessa laitteessa:
  - [ ] Device A: setup passphrase
  - [ ] Device B: login + syötä sama passphrase → data aukeaa
- [ ] Passkey on laitekohtainen convenience, ei vaihda passphrasea.

## B) Sync (top bar)

- [ ] Sync-nappi näyttää tooltipin: mitä se tekee
- [ ] Klikkaus avaa modalin, jossa näkyy:
  - [ ] progress (upload/pull/merge)
  - [ ] tulosyhteenveto (Uploaded X, Pulled Y)
  - [ ] “Last synced …”
- [ ] Sync jälkeen Dashboard ja Transactions refetch/refresh tapahtuu automaattisesti

## C) Dashboard alerts (⏰)

- [ ] Jokaisella positiolla on ⏰-ikoni
- [ ] Klikkaus avaa “Create alert for <asset>”
- [ ] Alert modalissa:
  - [ ] Price tab: above/below/% move
  - [ ] Cooldown valittavissa
  - [ ] Delivery togglet (server/device)
  - [ ] “Test notification” toimii (näyttää onnistui/ei)
- [ ] Create alert luo alertin ja näyttää toastin

## D) Imports (provider registry)

- [ ] Imports-näkymä näyttää provider gridin (Coinbase, Binance, MEXC, Bitvavo, Ledger, MetaMask)
- [ ] Provider “Connect” avaa wizardin, jossa:
  - [ ] Method: API default, CSV secondary
  - [ ] Credentials step: “Test connection” pakollinen
  - [ ] First sync step: progress + summary + link to transactions
- [ ] Uuden providerin lisääminen ei vaadi muutoksia imports root UI:hin (registry)

## E) Strategy (MVP)

- [ ] Strategy home näyttää:
  - [ ] Target allocation table (editable)
  - [ ] Drift alerts
  - [ ] Rebalance suggestions (paper)
- [ ] Selkeä raja: ei automaattisia tradeja tässä MVP:ssä

## F) Account & Settings

### Account
- [ ] Näyttää subscription statuksen (Free/Premium)
- [ ] Passkeys list + add/remove
- [ ] Change password
- [ ] Change vault passphrase (vaatii nykyisen)
- [ ] Export encrypted backup

### Settings
- [ ] “API base URL” on Advanced/Dev -osiossa ja selitetty
- [ ] Enable server alerts persistoi ja näyttää “Enabled on server” tai virheen

## G) Premium (feature gating)

- [ ] Premium-featuret ovat merkitty badge:llä
- [ ] Klikkaus premium-featureen avaa upgrade-modal
- [ ] Free tier toimii silti ilman rikkinäistä UX:ää
