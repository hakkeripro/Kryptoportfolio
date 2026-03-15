import { describe, it, expect } from 'vitest';
import en from './locales/en.json';
import fi from './locales/fi.json';

/** Recursively collect all leaf key paths from a nested object */
function collectKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

describe('i18n locales', () => {
  const enKeys = collectKeys(en);
  const fiKeys = collectKeys(fi);

  it('EN has keys', () => {
    expect(enKeys.length).toBeGreaterThan(100);
  });

  it('FI has same number of keys as EN', () => {
    expect(fiKeys.length).toBe(enKeys.length);
  });

  it('no keys missing from FI', () => {
    const missingInFi = enKeys.filter((k) => !fiKeys.includes(k));
    expect(missingInFi).toEqual([]);
  });

  it('no extra keys in FI', () => {
    const extraInFi = fiKeys.filter((k) => !enKeys.includes(k));
    expect(extraInFi).toEqual([]);
  });

  it('no empty string values in EN', () => {
    const empty = enKeys.filter((k) => {
      const parts = k.split('.');
      let val: unknown = en;
      for (const p of parts) val = (val as Record<string, unknown>)[p];
      return val === '';
    });
    expect(empty).toEqual([]);
  });

  it('no empty string values in FI', () => {
    const empty = fiKeys.filter((k) => {
      const parts = k.split('.');
      let val: unknown = fi;
      for (const p of parts) val = (val as Record<string, unknown>)[p];
      return val === '';
    });
    expect(empty).toEqual([]);
  });
});
