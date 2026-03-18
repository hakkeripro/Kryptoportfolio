# Show HN: PrivateLedger – crypto portfolio tracker where the server never sees your data

**Draft — to be posted on news.ycombinator.com**

---

## Post Title

Show HN: PrivateLedger – a crypto portfolio tracker that can't see your data (zero-knowledge, Finnish tax)

---

## Post Body

Hi HN,

I've been working on PrivateLedger, a crypto portfolio tracker built around a zero-knowledge architecture. The short version: your data is encrypted on your device before it leaves it. Our server stores only AES-256-GCM ciphertext. We mathematically cannot see your balances, trades, or portfolio value.

**How it works:**

1. When you set up the app, you generate a passphrase (or bring your own). This passphrase is used as the AES key material via PBKDF2 derivation.
2. Every write to our backend is encrypted client-side using the Web Crypto API. The server receives only ciphertext blobs — never plaintext.
3. When you open the app, decryption happens in your browser. Your key never leaves your device.

The encryption path is ~80 lines of vanilla Web Crypto API code, no third-party crypto libraries:

```typescript
// Derive key from passphrase (client only, never sent to server)
const keyMaterial = await crypto.subtle.importKey(
  "raw",
  new TextEncoder().encode(passphrase),
  "PBKDF2",
  false,
  ["deriveKey"]
);
const key = await crypto.subtle.deriveKey(
  { name: "PBKDF2", salt, iterations: 310_000, hash: "SHA-256" },
  keyMaterial,
  { name: "AES-GCM", length: 256 },
  false,
  ["encrypt", "decrypt"]
);
// Every sync envelope is encrypted before leaving the browser
const ciphertext = await crypto.subtle.encrypt(
  { name: "AES-GCM", iv },
  key,
  plaintext
);
```

**Why I built this:**

The dominant crypto portfolio apps (CoinTracking, Koinly, Accointing) require you to upload your complete transaction history to their servers. If they get breached, an attacker learns your full financial picture: what you own, when you bought it, and roughly what you're worth. This felt unnecessary — the calculations can be done client-side.

**What it does:**

- Portfolio tracking (FIFO/LIFO/HIFO/AVG lot engine)
- Exchange import: Coinbase, Binance, Kraken (API or CSV)
- Price alerts with web push
- Finnish tax calculation (this was the original motivation — Finnish tax law is unusually specific about crypto)
- The "HMO" Finnish tax optimization (equivalent of German "Haltedauer-Prinzip")
- OmaVero fill guide (Finland's tax portal)

**Tech stack:**

- React 18 + Vite PWA (TypeScript)
- Tailwind + Framer Motion
- Zustand + Dexie (IndexedDB)
- Cloudflare Pages Functions + Neon Postgres (hosted)
- Fastify + SQLite (local dev / self-host)
- Zero third-party auth — passphrase + optional passkey (WebAuthn)

**What I'm not sure about:**

The main tension is UX vs security. Zero-knowledge means: if you forget your passphrase, your data is gone. We can't recover it. This is technically honest but hard to communicate to non-technical users. I've tried to be upfront about it, but I'm still calibrating how much to hedge.

Also curious whether the Finnish tax features are interesting to anyone outside Finland — the HMO concept (tax-optimization via imputed acquisition cost) has equivalents in Germany, Sweden, and a few others.

Live at: https://private-ledger.app
App: https://app.private-ledger.app

Happy to answer questions about the ZK architecture or the Finnish tax math.

---

## Notes for posting

- Post on a weekday morning (9-10 AM EST / 4-5 PM Finnish time)
- Respond to every comment in the first 2 hours
- Be ready to discuss: WebCrypto API security, passphrase recovery UX, comparison to Koinly/CoinTracking
- If downvoted for "not open source" — consider open-sourcing the core package first
