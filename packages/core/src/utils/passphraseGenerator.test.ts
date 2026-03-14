import { describe, it, expect } from 'vitest';
import { generatePassphrase, PASSPHRASE_WORDLIST_SIZE } from './passphraseGenerator.js';

describe('generatePassphrase', () => {
  it('generates 6 words by default', () => {
    const pp = generatePassphrase();
    const words = pp.split('-');
    expect(words).toHaveLength(6);
  });

  it('generates requested number of words (5)', () => {
    const pp = generatePassphrase(5);
    expect(pp.split('-')).toHaveLength(5);
  });

  it('generates requested number of words (7)', () => {
    const pp = generatePassphrase(7);
    expect(pp.split('-')).toHaveLength(7);
  });

  it('throws for wordCount < 5', () => {
    expect(() => generatePassphrase(4)).toThrow('wordCount must be between 5 and 7');
  });

  it('throws for wordCount > 7', () => {
    expect(() => generatePassphrase(8)).toThrow('wordCount must be between 5 and 7');
  });

  it('produces no duplicate words', () => {
    // Run multiple times to catch probabilistic duplicates
    for (let i = 0; i < 20; i++) {
      const words = generatePassphrase(7).split('-');
      const unique = new Set(words);
      expect(unique.size).toBe(words.length);
    }
  });

  it('produces different passphrases on consecutive calls', () => {
    const a = generatePassphrase();
    const b = generatePassphrase();
    // Extremely unlikely to be equal with ~200^6 combinations
    expect(a).not.toBe(b);
  });

  it('uses dash separator', () => {
    const pp = generatePassphrase();
    expect(pp).toMatch(/^[a-z]+(-[a-z]+){5}$/);
  });

  it('wordlist has sufficient size for entropy', () => {
    // 200 words → ~7.6 bits per word → 6 words = ~46 bits
    expect(PASSPHRASE_WORDLIST_SIZE).toBeGreaterThanOrEqual(200);
  });
});
