import { describe, expect, it } from 'vitest';
import { Settings } from './settings.js';

const BASE = {
  id: 'settings_1',
  schemaVersion: 1,
  createdAtISO: new Date().toISOString(),
  updatedAtISO: new Date().toISOString(),
  isDeleted: false,
  baseCurrency: 'EUR',
  lotMethodDefault: 'FIFO',
  rewardsCostBasisMode: 'ZERO',
  priceProvider: 'coingecko',
  autoRefreshIntervalSec: 300,
  taxProfile: 'GENERIC',
  privacy: { telemetryOptIn: false },
};

describe('Settings schema', () => {
  it('accepts notifications as optional', () => {
    const s = Settings.parse({
      ...BASE,
      notifications: { serverAlertsEnabled: true, devicePushEnabled: false },
    });
    expect(s.notifications?.serverAlertsEnabled).toBe(true);
  });

  it('accepts taxCountry as optional', () => {
    const s = Settings.parse({ ...BASE, taxCountry: 'FI' });
    expect(s.taxCountry).toBe('FI');
  });

  it('accepts all valid taxCountry values', () => {
    for (const country of ['FI', 'SE', 'DE', 'OTHER'] as const) {
      const s = Settings.parse({ ...BASE, taxCountry: country });
      expect(s.taxCountry).toBe(country);
    }
  });

  it('rejects invalid taxCountry', () => {
    expect(() => Settings.parse({ ...BASE, taxCountry: 'US' })).toThrow();
  });

  it('accepts hmoEnabled as optional boolean', () => {
    const s = Settings.parse({ ...BASE, hmoEnabled: true });
    expect(s.hmoEnabled).toBe(true);
  });

  it('is backward-compatible without taxCountry or hmoEnabled', () => {
    const s = Settings.parse(BASE);
    expect(s.taxCountry).toBeUndefined();
    expect(s.hmoEnabled).toBeUndefined();
  });
});
