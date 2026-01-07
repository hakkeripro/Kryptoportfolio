# Coinbase integration (CDP Secret API Keys)

## Key formats

- **Recommended:** paste the downloaded **JSON key file** content (Coinbase CDP Secret API Key).
- The app can extract `key_name` and `private_key` from JSON. If you prefer manual entry, paste just the private key and provide the key name.

⚠️ If the UI currently insists on a `keyName` field even when pasting JSON, track it as **KP-IMPORT-001** in `docs/ISSUE_LOG.md` (planned fix).

This repo uses **Coinbase CDP “Secret API Keys”** (JWT / ES256) to read **accounts + transactions** and import them into the append-only ledger.

## Create a read-only key

1. In Coinbase, open **Settings → API** (or the CDP developer portal → **API Keys**).
2. Create a new **Secret API Key**.
3. Under **Advanced Settings → Signature algorithm**, select **ECDSA** (required for ES256).
4. Under permissions, enable at least **View (read-only)** for the portfolio you want to import.
5. Click **Download API key** and save the JSON file — Coinbase only shows it once.

## Connect in Kryptoportfolio v3

Go to **Imports → Coinbase** and paste either:

- **The full JSON file** into **Private key**, or
- `name` into **API Key name** and `privateKey` into **Private key**.

Then click **Connect**.

## Import behaviour (v3)

- **Fetch newest** pulls transactions since the last-seen transaction id per account.
- **Fetch all history** paginates all available history for all accounts.
- **Auto commit** is enabled by default:
  - If the preview has **no blocking issues**, the app commits immediately (deduped by `externalRef`).
  - If issues exist (missing FX, missing fee valuation, missing swap valuation, reward FMV missing...), you will see a preview and can fix the missing values before committing.
- **Auto sync** (foreground) is enabled by default. It runs while the app is open. Auto-sync is conservative: it will not advance cursors if the import is blocked by issues.

## Mapping rules (high level)

The importer normalizes Coinbase v2 transaction types into v3 **ledger events**:

- Ledger is **append-only**. Edit = replacement event + soft-delete of the old one.
- Default lot method is **FIFO** (configurable).
- **Swap** is treated as **disposal (assetIn) + acquisition (assetOut)** and recorded as a single `SWAP` ledger event.
- Fees:
  - BUY fee increases **cost basis**.
  - SELL/SWAP disposal fee reduces **proceeds**.
  - If the fee is paid in a token, the ledger event stores `feeAssetId`, `feeAmount`, and a deterministic `feeValueBase` (requires a price or user input).
- Rewards cost basis defaults to **ZERO**. FMV mode requires an explicit base valuation.
- Multi-currency: the import uses a deterministic base currency (`settings.baseCurrency`). FX rates can come from the provider or user input.

## Disconnect semantics

**Disconnect** removes stored Coinbase credentials + integration preferences + cursors from the encrypted Vault.

Previously imported ledger events remain (append-only).

## Hosted deployment notes

- In the hosted deployment, the Coinbase integration uses the same URL contract under `/api`.
- The backend acts as a **proxy** for Coinbase requests (to avoid CORS and to keep a single signing implementation), but it **does not store** Coinbase secrets.
- Credentials still live inside the local encrypted Vault; the web app sends them to the proxy only when making Coinbase calls.

Relevant endpoints:

- `POST /api/v1/import/coinbase/accounts`
- `POST /api/v1/import/coinbase/transactions/page`
- `POST /api/v1/import/coinbase/transactions/show` (optional)
- `GET /api/v1/import/coinbase/exchange-rates?...`

## Troubleshooting

### 401 Unauthorized

This means Coinbase rejected the JWT. Common causes:

- The key was created with **Ed25519** instead of **ECDSA**.
- You pasted the wrong field: the app expects the full key name (`organizations/.../apiKeys/...`) and the matching `privateKey`.
- The key does not have **View** permission for the portfolio.
- Your system clock is significantly off.

### Non-JSON errors

Coinbase sometimes returns plain-text errors (e.g. `Unauthorized`). The API proxy normalizes these into JSON (`coinbase_unauthorized`) so the UI can show a helpful message.

## Removing the integration

Use **Disconnect** on the Coinbase card. This removes stored credentials from the encrypted vault. Previously imported ledger events remain (append-only).