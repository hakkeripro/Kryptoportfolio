import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, changePassword } from './authCrypto.js';

describe('changePassword', () => {
  it('returns new hash when current password is correct', async () => {
    const storedHash = await hashPassword('oldpass123');
    const result = await changePassword('oldpass123', 'newpass456', storedHash);
    expect(result).not.toBeNull();
    expect(result).toContain('pbkdf2_sha256$');
    // New hash should verify with new password
    const valid = await verifyPassword('newpass456', result!);
    expect(valid).toBe(true);
  });

  it('returns null when current password is wrong', async () => {
    const storedHash = await hashPassword('correct');
    const result = await changePassword('wrong', 'newpass', storedHash);
    expect(result).toBeNull();
  });

  it('new hash differs from old hash', async () => {
    const storedHash = await hashPassword('mypassword');
    const newHash = await changePassword('mypassword', 'mypassword', storedHash);
    expect(newHash).not.toBeNull();
    // Different salt → different hash even for same password
    expect(newHash).not.toBe(storedHash);
  });
});
