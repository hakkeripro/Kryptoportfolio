import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { registerDevice } from '@kp/platform-web';
import type { Plan } from '@kp/core';
import { apiFetch } from './apiFetch';
import { useSyncStore } from './useSyncStore';

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

export type AuthState = {
  apiBase: string;
  token: string | null;
  email: string | null;
  plan: Plan;
  planExpiresAt: string | null;
  setApiBase: (s: string) => void;
  register: (email: string, password: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
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

      changePassword: async (currentPassword: string, newPassword: string) => {
        const { apiBase, token } = get();
        if (!token) throw new Error('not_authenticated');
        await apiFetch(apiBase, '/v1/auth/password', {
          method: 'PUT',
          headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
          body: JSON.stringify({ currentPassword, newPassword }),
        });
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
