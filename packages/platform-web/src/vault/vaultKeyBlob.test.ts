import { describe, it, expect } from 'vitest';
import { encryptVaultKeyBlob, decryptVaultKeyBlob, InvalidKeyError } from './vaultKeyBlob.js';
import { VaultBlobSchema } from './webVault.js';

describe('vaultKeyBlob', () => {
  it('encrypts and decrypts the passphrase correctly', async () => {
    const passphrase = 'correct-horse-battery-staple';
    const loginPassword = 'MySecretPassword123';
    const { blob } = await encryptVaultKeyBlob(passphrase, loginPassword);
    const result = await decryptVaultKeyBlob(blob, loginPassword);
    expect(result).toBe(passphrase);
  });

  it('throws InvalidKeyError for wrong loginPassword', async () => {
    const passphrase = 'my-vault-passphrase';
    const { blob } = await encryptVaultKeyBlob(passphrase, 'correctPassword');
    await expect(decryptVaultKeyBlob(blob, 'wrongPassword')).rejects.toBeInstanceOf(InvalidKeyError);
  });

  it('throws InvalidKeyError for different loginPassword', async () => {
    const passphrase = 'another-phrase';
    const { blob } = await encryptVaultKeyBlob(passphrase, 'passwordA');
    await expect(decryptVaultKeyBlob(blob, 'passwordB')).rejects.toBeInstanceOf(InvalidKeyError);
  });

  it('encrypts and decrypts empty passphrase', async () => {
    const passphrase = '';
    const loginPassword = 'SomePassword99';
    const { blob } = await encryptVaultKeyBlob(passphrase, loginPassword);
    const result = await decryptVaultKeyBlob(blob, loginPassword);
    expect(result).toBe(passphrase);
  });

  it('blob conforms to VaultBlobSchema', async () => {
    const { blob } = await encryptVaultKeyBlob('test-passphrase', 'test-password');
    expect(() => VaultBlobSchema.parse(blob)).not.toThrow();
    expect(typeof blob.kdf.saltBase64).toBe('string');
    expect(blob.kdf.saltBase64.length).toBeGreaterThan(0);
  });

  it('saltBase64 matches blob.kdf.saltBase64', async () => {
    const { blob, saltBase64 } = await encryptVaultKeyBlob('pp', 'pw');
    expect(saltBase64).toBe(blob.kdf.saltBase64);
  });
});
