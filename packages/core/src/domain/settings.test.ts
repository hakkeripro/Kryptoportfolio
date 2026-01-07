import { describe, expect, it } from 'vitest';
import { Settings } from './settings.js';

describe('Settings schema', () => {
  it('accepts notifications as optional', () => {
    const now = new Date().toISOString();
    const s = Settings.parse({
      id: 'settings_1',
      schemaVersion: 1,
      createdAtISO: now,
      updatedAtISO: now,
      isDeleted: false,
      baseCurrency: 'EUR',
      lotMethodDefault: 'FIFO',
      rewardsCostBasisMode: 'ZERO',
      priceProvider: 'coingecko',
      autoRefreshIntervalSec: 300,
      taxProfile: 'GENERIC',
      privacy: { telemetryOptIn: false },
      notifications: { serverAlertsEnabled: true, devicePushEnabled: false }
    });
    expect(s.notifications?.serverAlertsEnabled).toBe(true);
  });
});
