import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Settings } from '@kp/core';

export async function ensureDefaultSettings(): Promise<Settings> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const existing = await db.settings.get('settings_1');
  if (existing) return existing as any;

  const now = new Date().toISOString();
  const s: Settings = {
    id: 'settings_1',
    schemaVersion: 1,
    createdAtISO: now,
    updatedAtISO: now,
    baseCurrency: 'EUR',
    lotMethodDefault: 'FIFO',
    rewardsCostBasisMode: 'ZERO',
    priceProvider: 'coingecko',
    autoRefreshIntervalSec: 300,
    taxProfile: 'GENERIC',
    privacy: { telemetryOptIn: false }
  };
  await db.settings.add(s as any);
  return s;
}
