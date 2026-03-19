import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { registerDevice } from '@kp/platform-web';
import { encryptVaultKeyBlob, decryptVaultKeyBlob, type VaultBlob } from '@kp/platform-web';
import type { Plan } from '@kp/core';
import { apiFetch } from './apiFetch';
import { useSyncStore } from './useSyncStore';
import { useVaultStore } from './useVaultStore';

const AuthResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string() }).optional(),
  token: z.string().optional(),
  plan: z.string().optional(),
  planExpiresAt: z.string().nullable().optional(),
  error: z.string().optional(),
});

const PlanResponseSchema = z.object({
  plan: z.string(),
  planExpiresAt: z.string().nullable().optional(),
});

const VaultKeyResponseSchema = z.object({
  blob: z.unknown().nullable(),
  salt: z.string().nullable(),
});

export type AuthState = {
  apiBase: string;
  token: string | null;
  email: string | null;
  plan: Plan;
  planExpiresAt: string | null;
  setApiBase: (s: string) => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  /** Sign in and automatically unlock the vault using the server-stored key blob.
   *  Returns { autoUnlocked: true } if vault was unlocked automatically,
   *  or { autoUnlocked: false } if no blob found (fallback to manual passphrase). */
  signInAndUnlockVault: (email: string, password: string) => Promise<{ autoUnlocked: boolean }>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  /** Upload the vault key blob to the server (used after VaultSetup). */
  uploadVaultKeyBlob: (passphrase: string, loginPassword: string) => Promise<void>;
  fetchPlan: () => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      apiBase: '/api',
      token: null,
      email: null,
      plan: 'free' as Plan,
      planExpiresAt: null,

      setApiBase: (s: string) => {
        const v = String(s ?? '').trim();
        set({ apiBase: v || '/api' });
      },

      register: async (email: string, password: string) => {
        const base = get().apiBase;
        const r = await apiFetch<unknown>(base, '/v1/auth/register', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const parsed = AuthResponseSchema.parse(r);
        if (!parsed.token) throw new Error(parsed.error ?? 'register_failed');
        set({
          token: parsed.token,
          email,
          plan: (parsed.plan as Plan) ?? 'free',
          planExpiresAt: parsed.planExpiresAt ?? null,
        });
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(base, parsed.token, deviceId, 'web');
      },

      login: async (email: string, password: string) => {
        const base = get().apiBase;
        const r = await apiFetch<unknown>(base, '/v1/auth/login', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
        const parsed = AuthResponseSchema.parse(r);
        if (!parsed.token) throw new Error(parsed.error ?? 'login_failed');
        set({
          token: parsed.token,
          email,
          plan: (parsed.plan as Plan) ?? 'free',
          planExpiresAt: parsed.planExpiresAt ?? null,
        });
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(base, parsed.token, deviceId, 'web');
      },

      signInAndUnlockVault: async (email: string, password: string) => {
        const { login, apiBase } = get();
        await login(email, password);
        const { token } = get();
        if (!token) throw new Error('login_failed');

        // Fetch server-stored vault key blob
        const r = await apiFetch<unknown>(apiBase, '/v1/vault/key', {
          headers: { authorization: `Bearer ${token}` },
        });
        const { blob, salt } = VaultKeyResponseSchema.parse(r);

        if (blob && salt) {
          // Decrypt passphrase and set up vault locally
          const passphrase = await decryptVaultKeyBlob(blob as VaultBlob, password);
          await useVaultStore.getState().setupVault(passphrase);
          return { autoUnlocked: true };
        }

        return { autoUnlocked: false };
      },

      uploadVaultKeyBlob: async (passphrase: string, loginPassword: string) => {
        const { apiBase, token } = get();
        if (!token) return;
        const { blob, saltBase64 } = await encryptVaultKeyBlob(passphrase, loginPassword);
        await apiFetch(apiBase, '/v1/vault/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ blob, salt: saltBase64 }),
        });
      },

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { apiBase, token } = get();
        if (!token) throw new Error('not_authenticated');

        // Re-encrypt vault key blob with new password if vault is unlocked
        const passphrase = useVaultStore.getState().passphrase;
        let newVaultKeyBlob: VaultBlob | undefined;
        let newVaultKeySalt: string | undefined;
        if (passphrase) {
          const result = await encryptVaultKeyBlob(passphrase, newPassword);
          newVaultKeyBlob = result.blob;
          newVaultKeySalt = result.saltBase64;
        }

        await apiFetch(apiBase, '/v1/auth/password', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({
            currentPassword,
            newPassword,
            ...(newVaultKeyBlob ? { newVaultKeyBlob, newVaultKeySalt } : {}),
          }),
        });

        // If we sent a new blob, also update it via /v1/vault/key
        if (newVaultKeyBlob && newVaultKeySalt) {
          await apiFetch(apiBase, '/v1/vault/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ blob: newVaultKeyBlob, salt: newVaultKeySalt }),
          });
        }
      },

      fetchPlan: async () => {
        const { apiBase, token } = get();
        if (!token) return;
        try {
          const r = await apiFetch<unknown>(apiBase, '/v1/billing/plan', {
            headers: { authorization: `Bearer ${token}` },
          });
          const parsed = PlanResponseSchema.parse(r);
          set({
            plan: (parsed.plan as Plan) ?? 'free',
            planExpiresAt: parsed.planExpiresAt ?? null,
          });
        } catch {
          // Non-fatal: keep existing plan in store
        }
      },

      logout: () => set({ token: null, email: null, plan: 'free', planExpiresAt: null }),
    }),
    {
      name: 'kp_auth_v3',
      partialize: (s) => ({
        apiBase: s.apiBase,
        token: s.token,
        email: s.email,
        plan: s.plan,
        planExpiresAt: s.planExpiresAt,
      }),
      merge: (persisted: any, current: any) => {
        const merged = { ...current, ...(persisted ?? {}) };
        if (!merged.apiBase || String(merged.apiBase).trim().length === 0) {
          merged.apiBase = '/api';
        }
        return merged;
      },
    },
  ),
);
