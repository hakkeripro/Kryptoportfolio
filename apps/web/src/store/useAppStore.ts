import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { ensureWebDbOpen, getMeta, getWebDb, setMeta, createVaultBlob, openVaultBlob } from '@kp/platform-web';
import { createSyncEnvelope, openSyncEnvelope, pullEnvelopes, registerDevice, uploadEnvelope } from '@kp/platform-web';
import { uuid } from '@kp/core';
import {
  Asset as AssetSchema,
  Account as AccountSchema,
  Settings as SettingsSchema,
  LedgerEvent as LedgerEventSchema,
  AlertSchema
} from '@kp/core';

import { rebuildDerivedCaches } from '../derived/rebuildDerived';

const AuthResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string() }).optional(),
  token: z.string().optional(),
  error: z.string().optional()
});

async function apiFetch<T>(base: string, path: string, init: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, { cache: 'no-store', ...init });
  const txt = await r.text();
  const json = txt ? JSON.parse(txt) : {};
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(json)}`);
  return json as any;
}

export type AppState = {
  apiBase: string;
  token: string | null;
  email: string | null;
  passphrase: string | null;
  vaultReady: boolean;
  vaultSetup: boolean;
  deviceId: string;
  lastSyncCursor: number;
  setApiBase: (s: string) => void;
  setPassphrase: (p: string | null) => void;
  loadVaultStatus: () => Promise<void>;
  setupVault: (passphrase: string) => Promise<void>;
  unlockVault: (passphrase: string, opts?: { rememberSession?: boolean }) => Promise<void>;
  lockVault: () => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  syncNow: () => Promise<{ uploaded: number; pulled: number } | null>;
};

// Session-only cache so a tab refresh does not immediately require re-typing.
// (This is NOT a durable store; closing the tab/window clears it.)
const KP_VAULT_PASSPHRASE_SESSION = 'KP_VAULT_PASSPHRASE_SESSION';

function rememberSessionPassphrase(passphrase: string | null) {
  try {
    if (!passphrase) sessionStorage.removeItem(KP_VAULT_PASSPHRASE_SESSION);
    else sessionStorage.setItem(KP_VAULT_PASSPHRASE_SESSION, passphrase);
  } catch {
    // Best-effort only.
  }
}

const VaultCheckSchema = z.object({ check: z.literal('kp_v3') });
const SyncPayloadSchema = z.object({
  schemaVersion: z.number().int().nonnegative(),
  exportedAtISO: z.string().datetime(),
  assets: z.array(AssetSchema),
  accounts: z.array(AccountSchema),
  settings: z.array(SettingsSchema),
  ledgerEvents: z.array(LedgerEventSchema),
  alerts: z.array(AlertSchema)
});

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // In production (Cloudflare Pages) the API is served from the same origin under /api.
      // In local dev, Vite proxies /api -> http://localhost:8788.
      apiBase: '/api',
      token: null,
      email: null,
      passphrase: null,
      vaultReady: false,
      vaultSetup: false,
      deviceId: (() => {
        const existing = localStorage.getItem('kp_device_id');
        const v = existing ?? `dev_${uuid()}`;
        localStorage.setItem('kp_device_id', v);
        return v;
      })(),
      lastSyncCursor: 0,
      setApiBase: (s) => {
        const v = String(s ?? '').trim();
        // Guard against accidentally blanking the base URL. If apiBase becomes '',
        // the app will start requesting `/v1/...` from the Vite dev server and
        // everything that needs the API will fail with proxy/CORS-like errors.
        set({ apiBase: v || '/api' });
      },
      setPassphrase: (p) => set({ passphrase: p }),

      loadVaultStatus: async () => {
        await ensureWebDbOpen();
        const blobJson = await getMeta('vault_blob');
        const hasBlob = !!blobJson;
        if (!hasBlob) {
          set({ vaultReady: true, vaultSetup: false, passphrase: null });
          return;
        }

        // Best-effort restore passphrase for this tab (sessionStorage) to avoid jumping back to onboarding.
        let restored: string | null = null;
        try {
          const cached = sessionStorage.getItem(KP_VAULT_PASSPHRASE_SESSION);
          if (cached && blobJson) {
            const blob = JSON.parse(blobJson);
            const payload = await openVaultBlob(cached, blob);
            VaultCheckSchema.parse(payload);
            restored = cached;
          }
        } catch {
          // If restore fails (wrong passphrase), wipe the cached value.
          try {
            sessionStorage.removeItem(KP_VAULT_PASSPHRASE_SESSION);
          } catch {
            /* ignore */
          }
        }

        set({ vaultReady: true, vaultSetup: true, passphrase: restored });
      },

      setupVault: async (passphrase: string) => {
        await ensureWebDbOpen();
        // Store an encrypted "check" blob in meta. Passphrase is never stored.
        const blob = await createVaultBlob(passphrase, { check: 'kp_v3' });
        await setMeta('vault_blob', JSON.stringify(blob));
        // Remember within this browser session (KP-VAULT-001).
        rememberSessionPassphrase(passphrase);
        set({ passphrase, vaultReady: true, vaultSetup: true });
      },

      unlockVault: async (passphrase: string, opts?: { rememberSession?: boolean }) => {
        await ensureWebDbOpen();
        const blobJson = await getMeta('vault_blob');
        if (!blobJson) throw new Error('vault_not_setup');
        const blob = JSON.parse(blobJson);
        const payload = await openVaultBlob(passphrase, blob);
        VaultCheckSchema.parse(payload);
        if (opts?.rememberSession !== false) rememberSessionPassphrase(passphrase);
        set({ passphrase, vaultReady: true, vaultSetup: true });
      },

      lockVault: () => {
        rememberSessionPassphrase(null);
        set({ passphrase: null });
      },

      register: async (email, password) => {
        const base = get().apiBase;
        const r = await apiFetch<any>(base, '/v1/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const parsed = AuthResponseSchema.parse(r);
        if (!parsed.token) throw new Error(parsed.error ?? 'register_failed');
        set({ token: parsed.token, email });
        await registerDevice(base, parsed.token, get().deviceId, 'web');
      },

      login: async (email, password) => {
        const base = get().apiBase;
        const r = await apiFetch<any>(base, '/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const parsed = AuthResponseSchema.parse(r);
        if (!parsed.token) throw new Error(parsed.error ?? 'login_failed');
        set({ token: parsed.token, email });
        await registerDevice(base, parsed.token, get().deviceId, 'web');
      },

      logout: () => set({ token: null, email: null, lastSyncCursor: 0 }),

      syncNow: async () => {
        const { token, passphrase } = get();
        if (!token || !passphrase) return null;

        await ensureWebDbOpen();
        const db = getWebDb();

        // Minimal sync payload: all local ledger events + assets + accounts + settings + alerts
        const payload = {
          schemaVersion: 1,
          exportedAtISO: new Date().toISOString(),
          assets: await db.assets.toArray(),
          accounts: await db.accounts.toArray(),
          settings: await db.settings.toArray(),
          ledgerEvents: await db.ledgerEvents.toArray(),
          alerts: await db.alerts.toArray()
        };

        SyncPayloadSchema.parse(payload);

        const afterCursor0 = get().lastSyncCursor;

        const env = await createSyncEnvelope({
          passphrase,
          deviceId: get().deviceId,
          id: `env_${uuid()}`,
          payload
        });

        const up = await uploadEnvelope(get().apiBase, token, env);

        // Pull anything after our previously known cursor.
        const pulled = await pullEnvelopes(get().apiBase, token, afterCursor0);
        const pulledCount = pulled.envelopes.length;
        const last = pulled.envelopes.at(-1);
        const maxCursor = Math.max(Number(up?.cursor ?? 0), Number(last?.cursor ?? 0), Number(afterCursor0 ?? 0));
        if (maxCursor > get().lastSyncCursor) set({ lastSyncCursor: maxCursor });

        // Decrypt + merge
        for (const e of pulled.envelopes) {
          const decoded = await openSyncEnvelope({ passphrase, envelope: e });
          const decodedPayload = SyncPayloadSchema.parse(decoded);

          // Merge strategy: upsert by id, keep latest updatedAtISO
          const upsert = async <T extends { id: string; updatedAtISO: string }>(
            table: any,
            items: T[]
          ) => {
            for (const item of items) {
              const existing = await table.get(item.id);
              if (!existing || String(existing.updatedAtISO) < item.updatedAtISO) {
                await table.put(item);
              }
            }
          };

          await upsert(db.assets, decodedPayload.assets);
          await upsert(db.accounts, decodedPayload.accounts);
          await upsert(db.settings, decodedPayload.settings);
          await upsert(db.ledgerEvents, decodedPayload.ledgerEvents);
          await upsert(db.alerts, decodedPayload.alerts);
        }

        // Keep derived caches consistent after merges (holdings, snapshots, dashboards).
        if (pulledCount > 0) {
          await rebuildDerivedCaches({ daysBack: 365 });
        }

        return { uploaded: 1, pulled: pulledCount };
      }
    }),
    {
      name: 'kp_app_state_v3',
      // Ensure older persisted states (or accidental user edits) cannot blank apiBase.
      merge: (persistedState: any, currentState: any) => {
        const merged = { ...currentState, ...(persistedState ?? {}) };
        if (!merged.apiBase || String(merged.apiBase).trim().length === 0) {
          merged.apiBase = '/api';
        }
        return merged;
      },
      partialize: (s) => ({
        apiBase: s.apiBase,
        token: s.token,
        email: s.email,
        deviceId: s.deviceId,
        lastSyncCursor: s.lastSyncCursor
      })
    }
  )
);
