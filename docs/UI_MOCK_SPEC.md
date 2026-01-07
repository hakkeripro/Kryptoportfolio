# UI mock spec (tekstimuotoinen wireframe)

Tämä dokumentti kuvaa ruudut ja flow’t **tekstimockina**. Tarkoitus on ohjata implementaatiota ilman Figmaa.

## Perusperiaate (näkyy UI:ssa)

- **Login (email + password)** = tilin tunnistus, session ja sync
- **Vault Passphrase (yksi per käyttäjä)** = E2E-salauksen “master avain” vaultin avaamiseen (toimii kaikilla laitteilla)
- **Passkey (FaceID/TouchID/Windows Hello)** = “pikakirjautuminen” vaultiin tällä laitteella (korvaa passphrase-syötön, ei vaihda passphrasea)

Tavoite: käyttäjä ymmärtää: “Yksi tili + yksi vault-passphrase, ja passkey tekee siitä helppoa.”

---

## 1) Welcome

Route: `/welcome`

- Logo + tagline
- CTA:
  - **Sign in**
  - **Create account**
- Secondary: “What is Vault Passphrase?” (drawer)

Drawer copy:
- “Vault Passphrase encrypts your portfolio data end-to-end. We can’t read it.”
- “You set it once. Use it on any device.”
- “Enable Passkey to unlock without typing.”

---

## 2) Create account

Route: `/auth/signup`

Fields:
- Email
- Password
- Confirm password

On success → Vault Setup Wizard (pakollinen ensimmäisellä kerralla)

---

## 3) Sign in

Route: `/auth/signin`

Fields:
- Email
- Password

On success:
- if vault not setup → Vault Setup Wizard
- else → Vault Unlock

---

## 4) Vault Setup Wizard (yksi passphrase per käyttäjä)

### Step 1 — Create your Vault Passphrase
Route: `/vault/setup`

- Vault Passphrase
- Confirm
- Checkbox: “I saved it somewhere safe”
- Button: **Continue**
- Secondary: “Use a generated passphrase” (5–7 sanaa)

### Step 2 — Enable Passkey (recommended)
Route: `/vault/setup/passkey`

- Copy: “Use Face ID / Touch ID / Windows Hello”
- Buttons:
  - **Enable Passkey (recommended)**
  - “Skip for now”

### Done
Route: `/vault/setup/done`
- ✅ Account created
- ✅ Vault passphrase set
- ✅ Passkey enabled (if yes)
- Button: **Go to Dashboard**
- Link: “Import transactions”

---

## 5) Vault Unlock

Route: `/vault/unlock`

Cards:
1) **Use Passkey** (default)
   - Button: **Unlock with Passkey**
2) **Use Vault Passphrase**
   - Field: Vault passphrase
   - Button: **Unlock**

Microcopy:
- “Same Vault Passphrase works on all devices.”
- “Passkey is device-specific; add it per device.”

---

## 6) Top bar: Sync selkeäksi

Right side:
- **Sync** button (icon + label)

Tooltip:
- “Sync uploads your encrypted Vault data and pulls updates from other devices.”

On click: modal “Sync Vault”
- progress: Uploading… Pulling… Merging…
- result:
  - Uploaded: X
  - Pulled: Y
  - Last synced: just now
- Link: “View sync log”

---

## 7) Dashboard: Alert popup per positio

Route: `/dashboard`

Positions table:
- Token icon + symbol + name
- Amount, value, P/L
- Actions:
  - **⏰** (Add alert)
  - ⋯

Modal: “Create alert for BTC”
Tabs:
- Price
- Allocation
- P/L
- Advanced

Price tab:
- Condition: crosses above/below, moves by %
- Threshold
- Cooldown
- Delivery: Server alerts toggle + Device notifications toggle
- **Create alert**
- “Test notification”

---

## 8) Imports: provider registry + wizard

Route: `/imports`

Grid of providers:
- Coinbase, Binance, MEXC, Bitvavo, Ledger, MetaMask
- Status: Connected / Not connected / Needs attention
- Primary action: Manage / Connect

Wizard: `/imports/:provider/connect`
Step 1: Method
- API (recommended)
- CSV (secondary)

Step 2: Credentials
- fields + “Where to find this?”
- “Test connection” (pakollinen ennen save)

Step 3: Sync options
Step 4: Run first sync + summary

---

## 9) Strategy (MVP)

Route: `/strategy`
- Target allocation (pie + table)
- Rebalance suggestions (paper)
- Rules (drift alerts)

Create strategy wizard:
- template → allocation → rules → save

---

## 10) Account + Settings

Account: `/account`
- Subscription + Upgrade
- Devices & Passkeys
- Security: change password / change vault passphrase
- Data export (encrypted backup)

Settings: `/settings`
- Base currency
- Tax country
- Notifications (server/device)
- Theme/branding
- Advanced (collapsed): API base URL (dev only) + selitys
