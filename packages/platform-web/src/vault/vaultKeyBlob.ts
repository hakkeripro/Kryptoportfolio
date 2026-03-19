import { createVaultBlob, openVaultBlob, type VaultBlob } from './webVault.js';

export class InvalidKeyError extends Error {
  constructor() {
    super('invalid_key');
    this.name = 'InvalidKeyError';
  }
}

const PAYLOAD_KEY = 'passphrase';

/**
 * Encrypt a vault passphrase using the user's login password as the wrapping key.
 * PBKDF2-SHA-256 / AES-GCM 256-bit (via createVaultBlob).
 * Zero-knowledge: the server only ever sees ciphertext.
 */
export async function encryptVaultKeyBlob(
  passphrase: string,
  loginPassword: string,
): Promise<{ blob: VaultBlob; saltBase64: string }> {
  const blob = await createVaultBlob(loginPassword, { [PAYLOAD_KEY]: passphrase });
  return { blob, saltBase64: blob.kdf.saltBase64 };
}

/**
 * Decrypt the vault passphrase blob using the user's login password.
 * Throws InvalidKeyError on wrong password or corrupted blob.
 */
export async function decryptVaultKeyBlob(blob: VaultBlob, loginPassword: string): Promise<string> {
  try {
    const payload = await openVaultBlob(loginPassword, blob);
    if (typeof payload?.[PAYLOAD_KEY] !== 'string') throw new InvalidKeyError();
    return payload[PAYLOAD_KEY] as string;
  } catch (err) {
    if (err instanceof InvalidKeyError) throw err;
    throw new InvalidKeyError();
  }
}
