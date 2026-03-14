import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { ensureWebDbOpen, getWebDb, createSyncEnvelope, openSyncEnvelope, pullEnvelopes, uploadEnvelope } from '@kp/platform-web';
import { uuid, Asset as AssetSchema, Account as AccountSchema, Settings as SettingsSchema, LedgerEvent as LedgerEventSchema, AlertSchema } from '@kp/core';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { useAuthStore } from './useAuthStore';
import { useVaultStore } from './useVaultStore';

const SyncPayloadSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  exportedAtISO: z.string().datetime(),
  assets: z.array(AssetSchema),
  accounts: z.array(AccountSchema),
  settings: z.array(SettingsSchema),
  ledgerEvents: z.array(LedgerEventSchema),
  alerts: z.array(AlertSchema),
});

export type SyncState = {
  deviceId: string;
  lastSyncCursor: number;
  syncNow: () => Promise<{ uploaded: number; pulled: number } | null>;
};

async function upsertByTimestamp(table: any, items: { id: string; updatedAtISO: string }[]) {
  for (const item of items) {
    const existing = await table.get(item.id);
    if (!existing || String(existing.updatedAtISO) < item.updatedAtISO) await table.put(item);
  }
}

function getOrCreateDeviceId(): string {
  const existing = localStorage.getItem('kp_device_id');
  const v = existing ?? `dev_${uuid()}`;
  localStorage.setItem('kp_device_id', v);
  return v;
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set, get) => ({
      deviceId: getOrCreateDeviceId(),
      lastSyncCursor: 0,

      syncNow: async () => {
        const { token, apiBase } = useAuthStore.getState();
        const { passphrase } = useVaultStore.getState();
        if (!token || !passphrase) return null;

        await ensureWebDbOpen();
        const db = getWebDb();
        const payload = {
          schemaVersion: 1,
          exportedAtISO: new Date().toISOString(),
          assets: await db.assets.toArray(),
          accounts: await db.accounts.toArray(),
          settings: await db.settings.toArray(),
          ledgerEvents: await db.ledgerEvents.toArray(),
          alerts: await db.alerts.toArray(),
        };
        SyncPayloadSchema.parse(payload);

        const afterCursor0 = get().lastSyncCursor;
        const env = await createSyncEnvelope({
          passphrase, deviceId: get().deviceId, id: `env_${uuid()}`, payload,
        });
        const up = await uploadEnvelope(apiBase, token, env);
        const pulled = await pullEnvelopes(apiBase, token, afterCursor0);
        const pulledCount = pulled.envelopes.length;
        const maxCursor = Math.max(
          Number(up?.cursor ?? 0),
          Number(pulled.envelopes.at(-1)?.cursor ?? 0),
          Number(afterCursor0 ?? 0),
        );
        if (maxCursor > get().lastSyncCursor) set({ lastSyncCursor: maxCursor });

        for (const e of pulled.envelopes) {
          const decoded = await openSyncEnvelope({ passphrase, envelope: e });
          const dp = SyncPayloadSchema.parse(decoded);
          await upsertByTimestamp(db.assets, dp.assets);
          await upsertByTimestamp(db.accounts, dp.accounts);
          await upsertByTimestamp(db.settings, dp.settings);
          await upsertByTimestamp(db.ledgerEvents, dp.ledgerEvents);
          await upsertByTimestamp(db.alerts, dp.alerts);
        }

        if (pulledCount > 0) await rebuildDerivedCaches({ daysBack: 365 });
        return { uploaded: 1, pulled: pulledCount };
      },
    }),
    {
      name: 'kp_sync_v3',
      partialize: (s) => ({ deviceId: s.deviceId, lastSyncCursor: s.lastSyncCursor }),
    },
  ),
);
