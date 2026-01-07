import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { Settings } from '@kp/core';

export async function ensureDefaultSettings(): Promise<Settings> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const normalize = async (raw: any): Promise<Settings> => {
    const now = new Date().toISOString();
    const allowed = new Set([0, 60, 300, 900]);
    const interval = Number(raw?.autoRefreshIntervalSec ?? 300);
    const autoRefreshIntervalSec = allowed.has(interval) ? interval : interval <= 0 ? 0 : 300;

    const baseCurrency = String(raw?.baseCurrency ?? 'EUR').toUpperCase();
    const next: Settings = {
      ...(raw as any),
      id: 'settings_1',
      schemaVersion: 1,
      createdAtISO: String(raw?.createdAtISO ?? now),
      updatedAtISO: String(raw?.updatedAtISO ?? now),
      isDeleted: false,
      baseCurrency,
      lotMethodDefault: (raw?.lotMethodDefault ?? 'FIFO') as any,
      rewardsCostBasisMode: (raw?.rewardsCostBasisMode ?? 'ZERO') as any,
      priceProvider: (raw?.priceProvider ?? 'coingecko') as any,
      autoRefreshIntervalSec: autoRefreshIntervalSec as any,
      taxProfile: (raw?.taxProfile ?? 'GENERIC') as any,
      privacy: { telemetryOptIn: !!raw?.privacy?.telemetryOptIn },
      notifications: {
        serverAlertsEnabled: !!raw?.notifications?.serverAlertsEnabled,
        devicePushEnabled: !!raw?.notifications?.devicePushEnabled
      }
    };
    return next as any;
  };

  // Preferred key
  const existing = await db.settings.get('settings_1');
  if (existing) {
    const normalized = await normalize(existing);
    if (JSON.stringify(existing) !== JSON.stringify(normalized)) {
      await db.settings.put(normalized as any);
    }
    return normalized as any;
  }

  // Legacy key (pre KP-UI-002 fixes)
  const legacy = await db.settings.get('settings');
  if (legacy) {
    const normalized = await normalize(legacy);
    await db.settings.put(normalized as any);
    try {
      await db.settings.delete('settings');
    } catch {
      /* ignore */
    }
    return normalized as any;
  }

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
    privacy: { telemetryOptIn: false },
    notifications: { serverAlertsEnabled: false, devicePushEnabled: false }
  };
  await db.settings.add(s as any);
  return s;
}
