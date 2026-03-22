import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { z } from 'zod';
import { registerDevice } from '@kp/platform-web';
import { encryptVaultKeyBlob, decryptVaultKeyBlob, generateVaultKey, type VaultBlob } from '@kp/platform-web';
import type { Plan } from '@kp/core';
import { apiFetch } from './apiFetch';
import { useSyncStore } from './useSyncStore';
import { useVaultStore } from './useVaultStore';
import {
  isPasskeyAvailable,
  registerPasskey as webAuthnRegister,
  authenticateWithPasskey,
  deriveVaultPassphraseFromPrf,
  b64urlDecode,
  PasskeyPrfNotSupportedError,
} from '../lib/webauthn';

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

const PasskeyAuthResponseSchema = z.object({
  user: z.object({ id: z.string(), email: z.string() }).optional(),
  token: z.string().optional(),
  plan: z.string().optional(),
  planExpiresAt: z.string().nullable().optional(),
  prfSalt: z.string().optional(),
  vaultKeyBlob: z.unknown().nullable().optional(),
  credentialId: z.string().optional(),
  deviceName: z.string().nullable().optional(),
  error: z.string().optional(),
});

const PasskeyCredentialsResponseSchema = z.object({
  credentials: z.array(
    z.object({
      id: z.string(),
      device_name: z.string().nullable(),
      created_at_iso: z.string(),
    }),
  ),
});

export type AuthMethod = 'password' | 'oauth' | 'passkey';

export type PasskeyInfo = {
  id: string;
  deviceName: string | null;
  createdAtISO: string;
};

export type AuthState = {
  apiBase: string;
  token: string | null;
  email: string | null;
  plan: Plan;
  planExpiresAt: string | null;
  authMethod: AuthMethod | null;
  passkeys: PasskeyInfo[];
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
  // Feature 47: Passkey
  registerPasskey: (deviceName: string, prfSaltB64?: string) => Promise<void>;
  signInWithPasskey: (email?: string) => Promise<void>;
  unlockWithPasskey: () => Promise<void>;
  deletePasskey: (credentialId: string) => Promise<void>;
  fetchPasskeys: () => Promise<void>;
  // Feature 47: Password reset
  requestPasswordReset: (email: string) => Promise<void>;
  confirmPasswordReset: (token: string, newPassword: string) => Promise<void>;
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
      passkeys: [],

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

      // ---------------------------------------------------------------------------
      // Feature 47: Passkey actions
      // ---------------------------------------------------------------------------

      registerPasskey: async (deviceName: string, prfSaltB64?: string) => {
        if (!isPasskeyAvailable()) throw new Error('passkey_not_supported');

        const { token, email, apiBase } = get();

        // 1. Get registration options from server
        const optRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/register-options', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(token ? { authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(token ? {} : { email }),
        });
        const optData = optRes as {
          challengeToken: string;
          publicKey: PublicKeyCredentialCreationOptions & { challenge: string };
        };

        // Convert base64url challenge to ArrayBuffer
        const challengeBytes = b64urlDecode(optData.publicKey.challenge as unknown as string);
        const creationOptions: PublicKeyCredentialCreationOptions = {
          ...optData.publicKey,
          challenge: challengeBytes,
          user: {
            ...optData.publicKey.user,
            id: b64urlDecode(optData.publicKey.user.id as unknown as string),
          },
        };

        // 2. Generate a PRF salt
        const prfSaltBytes = prfSaltB64
          ? b64urlDecode(prfSaltB64)
          : crypto.getRandomValues(new Uint8Array(32));

        // 3. Create credential
        const result = await webAuthnRegister(creationOptions, prfSaltBytes);

        if (!result.prfSupported) {
          throw new PasskeyPrfNotSupportedError();
        }

        // 4. If vault is open, encrypt vaultKey with PRF-derived passphrase
        let vaultKeyBlob: unknown = null;
        if (result.prfOutput) {
          const prfPassphrase = await deriveVaultPassphraseFromPrf(result.prfOutput);
          const passphrase = useVaultStore.getState().passphrase;
          if (passphrase) {
            const blobResult = await encryptVaultKeyBlob(passphrase, prfPassphrase);
            vaultKeyBlob = blobResult.blob;
          }
        }

        // 5. Register with server
        const regHeaders: Record<string, string> = { 'content-type': 'application/json' };
        if (token) regHeaders['authorization'] = `Bearer ${token}`;

        const regRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/register', {
          method: 'POST',
          headers: regHeaders,
          body: JSON.stringify({
            challengeToken: optData.challengeToken,
            credentialId: result.credentialId,
            clientDataJSON: result.clientDataJSON,
            attestationObject: result.attestationObject,
            prfSalt: import.meta.env.DEV
              ? Buffer.from(prfSaltBytes).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
              : Array.from(prfSaltBytes).map((b) => b.toString(16).padStart(2, '0')).join(''),
            vaultKeyBlob,
            deviceName,
            email: !token ? email : undefined,
          }),
        });

        const parsed = PasskeyAuthResponseSchema.parse(regRes);
        if (!parsed.token && !token) throw new Error(parsed.error ?? 'passkey_register_failed');

        // Update state for new passkey users
        if (!token && parsed.token && parsed.user) {
          set({
            token: parsed.token,
            email: parsed.user.email,
            plan: (parsed.plan as Plan) ?? 'free',
            planExpiresAt: parsed.planExpiresAt ?? null,
            authMethod: 'passkey',
          });
          const deviceId = useSyncStore.getState().deviceId;
          await registerDevice(apiBase, parsed.token, deviceId, 'web');
        }

        // Refresh passkeys list
        await get().fetchPasskeys();
      },

      signInWithPasskey: async (email?: string) => {
        const { apiBase } = get();

        // 1. Get auth options
        const optRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/auth-options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(email ? { email } : {}),
        });
        const optData = optRes as {
          challengeToken: string;
          publicKey: PublicKeyCredentialRequestOptions & { challenge: string; rpId: string };
        };

        const requestOptions: PublicKeyCredentialRequestOptions = {
          ...optData.publicKey,
          challenge: b64urlDecode(optData.publicKey.challenge as unknown as string),
          allowCredentials: (optData.publicKey.allowCredentials ?? []).map((c: any) => ({
            ...c,
            id: b64urlDecode(c.id as string),
          })),
        };

        // 2. Authenticate
        const assertion = await authenticateWithPasskey(requestOptions);

        if (!assertion.prfOutput) {
          throw new PasskeyPrfNotSupportedError();
        }

        // 3. Verify with server
        const authRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeToken: optData.challengeToken,
            credentialId: assertion.credentialId,
            authenticatorData: assertion.authenticatorData,
            clientDataJSON: assertion.clientDataJSON,
            signature: assertion.signature,
            userHandle: assertion.userHandle,
          }),
        });

        const parsed = PasskeyAuthResponseSchema.parse(authRes);
        if (!parsed.token || !parsed.user) throw new Error(parsed.error ?? 'passkey_auth_failed');

        set({
          token: parsed.token,
          email: parsed.user.email,
          plan: (parsed.plan as Plan) ?? 'free',
          planExpiresAt: parsed.planExpiresAt ?? null,
          authMethod: 'passkey',
        });

        // Register device
        const deviceId = useSyncStore.getState().deviceId;
        await registerDevice(apiBase, parsed.token, deviceId, 'web');

        // 4. Derive vault key from PRF and open vault
        if (parsed.vaultKeyBlob) {
          const prfPassphrase = await deriveVaultPassphraseFromPrf(assertion.prfOutput);
          const vaultKey = await decryptVaultKeyBlob(parsed.vaultKeyBlob as VaultBlob, prfPassphrase);
          await useVaultStore.getState().setupVault(vaultKey);
        } else {
          // No vault blob yet — need to set up vault
          const vaultKey = generateVaultKey();
          await useVaultStore.getState().setupVault(vaultKey);
          // Upload encrypted blob
          const prfPassphrase = await deriveVaultPassphraseFromPrf(assertion.prfOutput);
          const { blob, saltBase64 } = await encryptVaultKeyBlob(vaultKey, prfPassphrase);
          // Store via passkey register (update vault_key_blob)
          await apiFetch(apiBase, '/v1/vault/key', {
            method: 'PUT',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${parsed.token}` },
            body: JSON.stringify({ blob, salt: saltBase64 }),
          });
        }
      },

      unlockWithPasskey: async () => {
        const { apiBase, email } = get();

        // Same as signInWithPasskey but called from UnlockPage (token already valid)
        const optRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/auth-options', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(email ? { email } : {}),
        });
        const optData = optRes as {
          challengeToken: string;
          publicKey: PublicKeyCredentialRequestOptions & { challenge: string };
        };

        const requestOptions: PublicKeyCredentialRequestOptions = {
          ...optData.publicKey,
          challenge: b64urlDecode(optData.publicKey.challenge as unknown as string),
          allowCredentials: (optData.publicKey.allowCredentials ?? []).map((c: any) => ({
            ...c,
            id: b64urlDecode(c.id as string),
          })),
        };

        const assertion = await authenticateWithPasskey(requestOptions);
        if (!assertion.prfOutput) throw new PasskeyPrfNotSupportedError();

        const authRes = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            challengeToken: optData.challengeToken,
            credentialId: assertion.credentialId,
            authenticatorData: assertion.authenticatorData,
            clientDataJSON: assertion.clientDataJSON,
            signature: assertion.signature,
            userHandle: assertion.userHandle,
          }),
        });

        const parsed = PasskeyAuthResponseSchema.parse(authRes);
        if (!parsed.vaultKeyBlob) throw new Error('vault_not_found');

        const prfPassphrase = await deriveVaultPassphraseFromPrf(assertion.prfOutput);
        const vaultKey = await decryptVaultKeyBlob(parsed.vaultKeyBlob as VaultBlob, prfPassphrase);
        await useVaultStore.getState().setupVault(vaultKey);
      },

      deletePasskey: async (credentialId: string) => {
        const { token, apiBase } = get();
        if (!token) throw new Error('not_authenticated');
        await apiFetch(apiBase, `/v1/auth/passkey/credentials/${credentialId}`, {
          method: 'DELETE',
          headers: { authorization: `Bearer ${token}` },
        });
        set((s) => ({ passkeys: s.passkeys.filter((p) => p.id !== credentialId) }));
      },

      fetchPasskeys: async () => {
        const { token, apiBase } = get();
        if (!token) return;
        try {
          const r = await apiFetch<unknown>(apiBase, '/v1/auth/passkey/credentials', {
            headers: { authorization: `Bearer ${token}` },
          });
          const parsed = PasskeyCredentialsResponseSchema.parse(r);
          set({
            passkeys: parsed.credentials.map((c) => ({
              id: c.id,
              deviceName: c.device_name,
              createdAtISO: c.created_at_iso,
            })),
          });
        } catch {
          // Non-fatal
        }
      },

      // ---------------------------------------------------------------------------
      // Feature 47: Password reset
      // ---------------------------------------------------------------------------

      requestPasswordReset: async (email: string) => {
        const { apiBase } = get();
        await apiFetch(apiBase, '/v1/auth/password-reset/request', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ email }),
        });
      },

      confirmPasswordReset: async (token: string, newPassword: string) => {
        const { apiBase } = get();
        await apiFetch(apiBase, '/v1/auth/password-reset/confirm', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ token, newPassword }),
        });
      },

      logout: () =>
        set({ token: null, email: null, plan: 'free', planExpiresAt: null, authMethod: null, passkeys: [] }),
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
