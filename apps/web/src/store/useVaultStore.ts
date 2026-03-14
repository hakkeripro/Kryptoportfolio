import { create } from 'zustand';
import { z } from 'zod';
import {
  ensureWebDbOpen,
  getMeta,
  setMeta,
  createVaultBlob,
  openVaultBlob,
} from '@kp/platform-web';

const VaultCheckSchema = z.object({ check: z.literal('kp_v3') });

const KP_VAULT_PASSPHRASE_SESSION = 'KP_VAULT_PASSPHRASE_SESSION';

function rememberSessionPassphrase(passphrase: string | null) {
  try {
    if (!passphrase) sessionStorage.removeItem(KP_VAULT_PASSPHRASE_SESSION);
    else sessionStorage.setItem(KP_VAULT_PASSPHRASE_SESSION, passphrase);
  } catch {
    // Best-effort only.
  }
}

export type VaultState = {
  passphrase: string | null;
  vaultReady: boolean;
  vaultSetup: boolean;
  setPassphrase: (p: string | null) => void;
  loadVaultStatus: () => Promise<void>;
  setupVault: (passphrase: string) => Promise<void>;
  unlockVault: (passphrase: string, opts?: { rememberSession?: boolean }) => Promise<void>;
  changePassphrase: (currentPassphrase: string, newPassphrase: string) => Promise<void>;
  lockVault: () => void;
};

export const useVaultStore = create<VaultState>()((set) => ({
  passphrase: null,
  vaultReady: false,
  vaultSetup: false,

  setPassphrase: (p: string | null) => set({ passphrase: p }),

  loadVaultStatus: async () => {
    await ensureWebDbOpen();
    const blobJson = await getMeta('vault_blob');
    if (!blobJson) {
      set({ vaultReady: true, vaultSetup: false, passphrase: null });
      return;
    }

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
    const blob = await createVaultBlob(passphrase, { check: 'kp_v3' });
    await setMeta('vault_blob', JSON.stringify(blob));
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

  changePassphrase: async (currentPassphrase: string, newPassphrase: string) => {
    await ensureWebDbOpen();
    const blobJson = await getMeta('vault_blob');
    if (!blobJson) throw new Error('vault_not_setup');
    // Verify current passphrase opens the vault
    const blob = JSON.parse(blobJson);
    const payload = await openVaultBlob(currentPassphrase, blob);
    VaultCheckSchema.parse(payload);
    // Re-encrypt with new passphrase
    const newBlob = await createVaultBlob(newPassphrase, { check: 'kp_v3' });
    await setMeta('vault_blob', JSON.stringify(newBlob));
    rememberSessionPassphrase(newPassphrase);
    set({ passphrase: newPassphrase });
  },

  lockVault: () => {
    rememberSessionPassphrase(null);
    set({ passphrase: null });
  },
}));
