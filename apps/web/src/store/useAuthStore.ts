import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { registerDevice } from '@kp/platform-web';
import { encryptVaultKeyBlob, decryptVaultKeyBlob, generateVaultKey, type VaultBlob } from '@kp/platform-web';
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

export type AuthMethod = 'password' | 'oauth';

export type AuthState = {
  apiBase: string;
  token: string | null;
  email: string | null;
  plan: Plan;
  planExpiresAt: string | null;
  authMethod: AuthMethod | null;
  setApiBase: (s: string) => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: (code: string, codeVerifier: string, redirectUri: string) => Promise<void>;
  setupOAuthVault: (pin: string) => Promise<void>;
  /** Unlock vault when session expired but token still valid. Fetches blob from server. */
  unlockWithPassword: (password: string) => Promise<void>;
  unlockWithPin: (pin: string) => Promise<void>;
  resetVault: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
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
      authMethod: null,

      setApiBase: (s: string) => {
        const v = String(s ?? '').trim();
        set({ apiBase: v || '/api' });
      },

      register: async (email: string, password: string) => {
        const base = get().apiBase;

        // 1. Register account
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
          authMethod: 'password',
        });

        // 2. Register device
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(base, parsed.token, deviceId, 'web');

        // 3. Generate random vault key and set up local vault
        const vaultKey = generateVaultKey();
        await useVaultStore.getState().setupVault(vaultKey);

        // 4. Upload blob to server — REQUIRED (throws on failure)
        const { blob, saltBase64 } = await encryptVaultKeyBlob(vaultKey, password);
        await apiFetch(base, '/v1/vault/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${parsed.token}` },
          body: JSON.stringify({ blob, salt: saltBase64 }),
        });
      },

      login: async (email: string, password: string) => {
        const base = get().apiBase;

        // 1. Authenticate
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
          authMethod: 'password',
        });

        // 2. Register device
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(base, parsed.token, deviceId, 'web');

        // 3. Fetch blob and auto-unlock vault
        const kr = await apiFetch<unknown>(base, '/v1/vault/key', {
          headers: { authorization: `Bearer ${parsed.token}` },
        });
        const { blob, salt } = VaultKeyResponseSchema.parse(kr);
        if (!blob || !salt) throw new Error('vault_not_found');
        const vaultKey = await decryptVaultKeyBlob(blob as VaultBlob, password);
        await useVaultStore.getState().setupVault(vaultKey);
      },

      loginWithGoogle: async (code: string, codeVerifier: string, redirectUri: string) => {
        const base = get().apiBase;

        const r = await apiFetch<unknown>(base, '/v1/auth/oauth/google', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code, codeVerifier, redirectUri }),
        });
        const parsed = AuthResponseSchema.parse(r);
        if (!parsed.token || !parsed.user) throw new Error(parsed.error ?? 'oauth_failed');
        set({
          token: parsed.token,
          email: parsed.user.email,
          plan: (parsed.plan as Plan) ?? 'free',
          planExpiresAt: parsed.planExpiresAt ?? null,
          authMethod: 'oauth',
        });

        // Register device
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(base, parsed.token, deviceId, 'web');
      },

      setupOAuthVault: async (pin: string) => {
        const { token, apiBase } = get();
        if (!token) throw new Error('not_authenticated');

        const vaultKey = generateVaultKey();
        await useVaultStore.getState().setupVault(vaultKey);

        const { blob, saltBase64 } = await encryptVaultKeyBlob(vaultKey, pin);
        await apiFetch(apiBase, '/v1/vault/key', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ blob, salt: saltBase64 }),
        });
      },

      unlockWithPassword: async (password: string) => {
        const { token, apiBase } = get();
        if (!token) throw new Error('not_authenticated');
        const r = await apiFetch<unknown>(apiBase, '/v1/vault/key', {
          headers: { authorization: `Bearer ${token}` },
        });
        const { blob, salt } = VaultKeyResponseSchema.parse(r);
        if (!blob || !salt) throw new Error('vault_not_found');
        const vaultKey = await decryptVaultKeyBlob(blob as VaultBlob, password);
        await useVaultStore.getState().setupVault(vaultKey);
      },

      unlockWithPin: async (pin: string) => {
        const { token, apiBase } = get();
        if (!token) throw new Error('not_authenticated');
        const r = await apiFetch<unknown>(apiBase, '/v1/vault/key', {
          headers: { authorization: `Bearer ${token}` },
        });
        const { blob } = VaultKeyResponseSchema.parse(r);
        if (!blob) throw new Error('vault_not_found');
        const vaultKey = await decryptVaultKeyBlob(blob as VaultBlob, pin);
        await useVaultStore.getState().setupVault(vaultKey);
      },

      resetVault: async () => {
        const { token, apiBase } = get();
        if (!token) throw new Error('not_authenticated');
        await apiFetch(apiBase, '/v1/vault/key', {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
        });
        await useVaultStore.getState().lockVault();
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

        // Also update blob via /v1/vault/key
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

      logout: () => set({ token: null, email: null, plan: 'free', planExpiresAt: null, authMethod: null }),
    }),
    {
      name: 'kp_auth_v3',
      partialize: (s) => ({
        apiBase: s.apiBase,
        token: s.token,
        email: s.email,
        plan: s.plan,
        planExpiresAt: s.planExpiresAt,
        authMethod: s.authMethod,
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
