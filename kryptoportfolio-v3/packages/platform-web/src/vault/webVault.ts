import { z } from 'zod';

export const VaultKdfParamsSchema = z.object({
  saltBase64: z.string(),
  iterations: z.number().int().positive()
});
export type VaultKdfParams = z.infer<typeof VaultKdfParamsSchema>;

export const VaultBlobSchema = z.object({
  version: z.number().int().positive(),
  kdf: VaultKdfParamsSchema,
  nonceBase64: z.string(),
  ciphertextBase64: z.string()
});
export type VaultBlob = z.infer<typeof VaultBlobSchema>;

function b64(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  // Uint8Array index is number|undefined when noUncheckedIndexedAccess=true
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i] ?? 0);
  return btoa(s);
}

function unb64(s: string): Uint8Array {
  const bin = atob(s);
  const u = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u;
}

function toArrayBuffer(u8: Uint8Array): ArrayBuffer {
  // Make sure we always hand Crypto APIs an ArrayBuffer (not ArrayBufferLike / SharedArrayBuffer).
  const out = new Uint8Array(u8.byteLength);
  out.set(u8);
  return out.buffer;
}

async function deriveKey(passphrase: string, kdf: VaultKdfParams): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: toArrayBuffer(unb64(kdf.saltBase64)),
      iterations: kdf.iterations,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function createVaultBlob(passphrase: string, payload: unknown): Promise<VaultBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const kdf: VaultKdfParams = { saltBase64: b64(salt), iterations: 150_000 };
  const key = await deriveKey(passphrase, kdf);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const pt = new TextEncoder().encode(JSON.stringify(payload));
  const ct = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(nonce) },
    key,
    toArrayBuffer(pt)
  );
  return {
    version: 1,
    kdf,
    nonceBase64: b64(nonce),
    ciphertextBase64: b64(ct)
  };
}

export async function openVaultBlob(passphrase: string, blob: VaultBlob): Promise<any> {
  const b = VaultBlobSchema.parse(blob);
  const key = await deriveKey(passphrase, b.kdf);
  const pt = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(unb64(b.nonceBase64)) },
    key,
    toArrayBuffer(unb64(b.ciphertextBase64))
  );
  const txt = new TextDecoder().decode(pt);
  return JSON.parse(txt);
}

export async function encryptJson(passphrase: string, payload: unknown) {
  return createVaultBlob(passphrase, payload);
}

export async function decryptJson(passphrase: string, blob: VaultBlob) {
  return openVaultBlob(passphrase, blob);
}
