/**
 * Thin facade that combines useAuthStore, useVaultStore, and useSyncStore
 * into the legacy AppState shape. Prefer importing from the specific stores directly.
 *
 * @deprecated Import from useAuthStore, useVaultStore, or useSyncStore instead.
 */
import { useAuthStore, type AuthState } from './useAuthStore';
import { useVaultStore, type VaultState } from './useVaultStore';
import { useSyncStore, type SyncState } from './useSyncStore';

export type AppState = AuthState & VaultState & SyncState;

export function useAppStore(): AppState;
export function useAppStore<T>(selector: (s: AppState) => T): T;
export function useAppStore<T>(selector?: (s: AppState) => T) {
  const auth = useAuthStore();
  const vault = useVaultStore();
  const sync = useSyncStore();
  const combined: AppState = { ...auth, ...vault, ...sync };
  return selector ? selector(combined) : combined;
}

// Expose .getState() for imperative access (e.g. outside React components).
useAppStore.getState = (): AppState => ({
  ...useAuthStore.getState(),
  ...useVaultStore.getState(),
  ...useSyncStore.getState(),
});
