// Device-specific Passkey wrapper for the Vault passphrase.
//
// Goal: "one user = one Vault Passphrase" across devices, while allowing
// passphrase-less unlock on devices where a Passkey has been enabled.
//
// This uses WebAuthn's "hmac-secret" extension (when available) to derive a
// stable per-credential secret that never leaves the authenticator.

type StoredWrap = {
  version: 1;
  credIdBase64: string;
  saltBase64: string;
  nonceBase64: string;
  ciphertextBase64: string;
  createdAtISO: string;
};

const LS_KEY = 'kp_vault_passkey_wrap_v1';

function b64Encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
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
  return typeof window !== 'undefined' && typeof (window as any).PublicKeyCredential !== 'undefined';
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

async function deriveHmacSecret(credId: Uint8Array, salt: Uint8Array): Promise<Uint8Array> {
  // The hmac-secret output is returned via getClientExtensionResults().
  const assertion = (await navigator.credentials.get({
    publicKey: {
      challenge: randomBytes(32),
      allowCredentials: [{ type: 'public-key', id: credId }],
      userVerification: 'preferred',
      extensions: { hmacGetSecret: { salt1: salt } as any }
    } as any
  })) as PublicKeyCredential | null;

  if (!assertion) throw new Error('passkey_cancelled');

  const ext: any = (assertion as any).getClientExtensionResults?.() ?? {};
  const h = ext.hmacGetSecret;
  const out1: ArrayBuffer | undefined = h?.output1;
  if (!out1) throw new Error('passkey_hmac_secret_not_supported');
  return new Uint8Array(out1);
}

async function importAesGcmKey(secret32: Uint8Array): Promise<CryptoKey> {
  if (secret32.byteLength < 32) throw new Error('passkey_secret_too_short');
  // Use the first 32 bytes (AES-256).
  const raw = secret32.slice(0, 32);
  return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
}

async function encryptString(key: CryptoKey, plaintext: string): Promise<{ nonce: Uint8Array; ciphertext: ArrayBuffer }> {
  const nonce = randomBytes(12);
  const data = new TextEncoder().encode(plaintext);
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, data);
  return { nonce, ciphertext };
}

async function decryptString(key: CryptoKey, nonce: Uint8Array, ciphertext: Uint8Array): Promise<string> {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: nonce }, key, ciphertext);
  return new TextDecoder().decode(pt);
}

export async function createOrReplacePasskeyWrap(passphrase: string): Promise<void> {
  if (!isPasskeySupported()) throw new Error('passkey_not_supported');

  // Create a new credential with the hmac-secret extension enabled.
  const cred = (await navigator.credentials.create({
    publicKey: {
      rp: { name: 'Kryptoportfolio' },
      user: {
        id: randomBytes(16),
        name: 'vault',
        displayName: 'Vault'
      },
      challenge: randomBytes(32),
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { userVerification: 'preferred' },
      timeout: 60_000,
      extensions: { hmacCreateSecret: true } as any
    } as any
  })) as PublicKeyCredential | null;

  if (!cred) throw new Error('passkey_cancelled');

  const credId = new Uint8Array(cred.rawId);
  const salt = randomBytes(32);
  const secret = await deriveHmacSecret(credId, salt);
  const key = await importAesGcmKey(secret);
  const { nonce, ciphertext } = await encryptString(key, passphrase);

  const stored: StoredWrap = {
    version: 1,
    credIdBase64: b64Encode(cred.rawId),
    saltBase64: b64Encode(salt.buffer),
    nonceBase64: b64Encode(nonce.buffer),
    ciphertextBase64: b64Encode(ciphertext),
    createdAtISO: new Date().toISOString()
  };

  localStorage.setItem(LS_KEY, JSON.stringify(stored));
}

export async function unwrapPassphraseWithPasskey(): Promise<string> {
  if (!isPasskeySupported()) throw new Error('passkey_not_supported');
  const stored = getStoredPasskeyWrap();
  if (!stored) throw new Error('passkey_not_enabled');

  const credId = b64Decode(stored.credIdBase64);
  const salt = b64Decode(stored.saltBase64);
  const nonce = b64Decode(stored.nonceBase64);
  const ciphertext = b64Decode(stored.ciphertextBase64);

  const secret = await deriveHmacSecret(credId, salt);
  const key = await importAesGcmKey(secret);
  return decryptString(key, nonce, ciphertext);
}
