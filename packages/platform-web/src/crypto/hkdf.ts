/**
 * HKDF key derivation using Web Crypto API.
 * Used to derive vault keys from WebAuthn PRF output.
 */

/**
 * Derive a 32-byte AES-GCM key from raw key material using HKDF-SHA256.
 *
 * @param inputKeyMaterial - Raw bytes from WebAuthn PRF output
 * @param info - Context string for domain separation
 * @param length - Output key length in bytes (default 32)
 */
export async function hkdfDeriveKey(
  inputKeyMaterial: ArrayBuffer,
  info: string,
  length: number = 32,
): Promise<CryptoKey> {
  const ikm = await crypto.subtle.importKey('raw', inputKeyMaterial, { name: 'HKDF' }, false, [
    'deriveKey',
  ]);

  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32), // zero salt (PRF output already contains entropy)
      info: new TextEncoder().encode(info),
    },
    ikm,
    { name: 'AES-GCM', length: length * 8 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/**
 * Derive raw key bytes from PRF output for use with existing blob encryption primitives.
 * Returns a 32-byte string (same as vault passphrase encoding).
 */
export async function hkdfDeriveRaw(
  inputKeyMaterial: ArrayBuffer,
  info: string,
  length: number = 32,
): Promise<ArrayBuffer> {
  const ikm = await crypto.subtle.importKey('raw', inputKeyMaterial, { name: 'HKDF' }, false, [
    'deriveBits',
  ]);

  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: new TextEncoder().encode(info),
    },
    ikm,
    length * 8,
  );
}
