// Device-specific Passkey wrapper for the Vault passphrase.
//
// Goal: "one user = one Vault Passphrase" across devices, while allowing
// passphrase-less unlock on devices where a Passkey has been enabled.
//
// Uses WebAuthn PRF extension (modern, widely supported) with hmac-secret
// fallback for older authenticators.

type SecretMethod = 'prf' | 'hmac';

type StoredWrap = {
  version: 1;
  credIdBase64: string;
  saltBase64: string;
  nonceBase64: string;
  ciphertextBase64: string;
  createdAtISO: string;
  /** Which extension was used. Defaults to 'hmac' for legacy wraps. */
  method?: SecretMethod;
};

const LS_KEY_PREFIX = 'kp_vault_passkey_wrap_v1';
const LS_KEY = LS_KEY_PREFIX;

function b64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]!);
  return btoa(bin);
}

function b64Decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' && typeof (window as any).PublicKeyCredential !== 'undefined'
  );
}

export function getStoredPasskeyWrap(): StoredWrap | null {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.version !== 1) return null;
    return parsed as StoredWrap;
  } catch {
    return null;
  }
}

export function clearPasskeyWrap(): void {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }
}

/** List all stored passkey wraps (currently max 1, future: multi). */
export function listPasskeyWraps(): Array<{
  credIdBase64: string;
  createdAtISO: string;
}> {
  const stored = getStoredPasskeyWrap();
  if (!stored) return [];
  return [{ credIdBase64: stored.credIdBase64, createdAtISO: stored.createdAtISO }];
}

/** Remove a specific passkey wrap by credential ID. */
export function removePasskeyWrap(credIdBase64: string): boolean {
  const stored = getStoredPasskeyWrap();
  if (!stored || stored.credIdBase64 !== credIdBase64) return false;
  clearPasskeyWrap();
  return true;
}

// ---------------------------------------------------------------------------
// Secret derivation via PRF or hmac-secret
// ---------------------------------------------------------------------------

async function deriveSecretPrf(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'preferred',
      extensions: { prf: { eval: { first: salt } } },
    } as any,
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('passkey_cancelled');

  const ext: any = assertion.getClientExtensionResults?.() ?? {};
  const result: ArrayBuffer | undefined = ext.prf?.results?.first;
  if (!result) throw new Error('passkey_prf_not_supported');
  return new Uint8Array(result);
}

async function deriveSecretHmac(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'preferred',
      extensions: { hmacGetSecret: { salt1: salt } } as any,
    } as any,
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('passkey_cancelled');

  const ext: any = assertion.getClientExtensionResults?.() ?? {};
  const out1: ArrayBuffer | undefined = ext.hmacGetSecret?.output1;
  if (!out1) throw new Error('passkey_hmac_secret_not_supported');
  return new Uint8Array(out1);
}

async function importAesGcmKey(secret32: Uint8Array): Promise<CryptoKey> {
  if (secret32.byteLength < 32) throw new Error('passkey_secret_too_short');
  const raw = secret32.slice(0, 32);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptString(
  key: CryptoKey,
  plaintext: string,
): Promise<{ nonce: Uint8Array; ciphertext: ArrayBuffer }> {
  const nonce = randomBytes(12);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    new Uint8Array(data),
  );
  return { nonce, ciphertext };
}

async function decryptString(
  key: CryptoKey,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
): Promise<string> {
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: new Uint8Array(nonce) },
    key,
    new Uint8Array(ciphertext),
  );
  return new TextDecoder().decode(pt);
}

// ---------------------------------------------------------------------------
// Registration: detect PRF support, fall back to hmac-secret
// ---------------------------------------------------------------------------

export async function createOrReplacePasskeyWrap(passphrase: string): Promise<void> {
  if (!isPasskeySupported()) throw new Error('passkey_not_supported');

  // Try creating with PRF extension first
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Kryptoportfolio' },
      user: {
        id: randomBytes(16),
        name: 'vault',
        displayName: 'Vault',
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { userVerification: 'preferred' },
      timeout: 120_000,
      extensions: {
        prf: {},
        hmacCreateSecret: true,
      } as any,
    } as any,
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('passkey_cancelled');

  const ext: any = cred.getClientExtensionResults?.() ?? {};
  const prfEnabled = ext.prf?.enabled === true;
  const hmacEnabled = ext.hmacCreateSecret === true;

  if (!prfEnabled && !hmacEnabled) {
    throw new Error('passkey_hmac_secret_not_supported');
  }

  const method: SecretMethod = prfEnabled ? 'prf' : 'hmac';
  const credId = new Uint8Array(cred.rawId);
  const salt = randomBytes(32);

  const deriveFn = method === 'prf' ? deriveSecretPrf : deriveSecretHmac;
  const secret = await deriveFn(credId, salt);
  const key = await importAesGcmKey(secret);
  const { nonce, ciphertext } = await encryptString(key, passphrase);

  const stored: StoredWrap = {
    version: 1,
    credIdBase64: b64Encode(cred.rawId),
    saltBase64: b64Encode(salt.buffer as ArrayBuffer),
    nonceBase64: b64Encode(nonce.buffer as ArrayBuffer),
    ciphertextBase64: b64Encode(ciphertext),
    createdAtISO: new Date().toISOString(),
    method,
  };

  localStorage.setItem(LS_KEY, JSON.stringify(stored));
}

// ---------------------------------------------------------------------------
// Unlock: use stored method (defaults to hmac for legacy wraps)
// ---------------------------------------------------------------------------

export async function unwrapPassphraseWithPasskey(): Promise<string> {
  if (!isPasskeySupported()) throw new Error('passkey_not_supported');
  const stored = getStoredPasskeyWrap();
  if (!stored) throw new Error('passkey_not_enabled');

  const credId = b64Decode(stored.credIdBase64);
  const salt = b64Decode(stored.saltBase64);
  const nonce = b64Decode(stored.nonceBase64);
  const ciphertext = b64Decode(stored.ciphertextBase64);

  const method: SecretMethod = stored.method ?? 'hmac';
  const deriveFn = method === 'prf' ? deriveSecretPrf : deriveSecretHmac;
  const secret = await deriveFn(credId, salt);
  const key = await importAesGcmKey(secret);
  return decryptString(key, nonce, ciphertext);
}
