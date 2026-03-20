import { describe, it, expect } from 'vitest';
import { generateVaultKey } from './vaultKey';

describe('generateVaultKey', () => {
  it('returns a base64 string of 32 bytes (44 chars with padding)', () => {
    const key = generateVaultKey();
    const decoded = atob(key);
    expect(decoded.length).toBe(32);
  });

  it('returns unique values on each call', () => {
    const a = generateVaultKey();
    const b = generateVaultKey();
    expect(a).not.toBe(b);
  });
});
