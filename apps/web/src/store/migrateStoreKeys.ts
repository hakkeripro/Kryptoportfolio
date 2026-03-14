/**
 * One-time migration: split old `kp_app_state_v3` persisted state
 * into the new per-domain store keys.
 *
 * Must run synchronously BEFORE any Zustand store is created.
 */
const OLD_KEY = 'kp_app_state_v3';
const AUTH_KEY = 'kp_auth_v3';
const SYNC_KEY = 'kp_sync_v3';

function migrateStoreKeys() {
  try {
    const raw = localStorage.getItem(OLD_KEY);
    if (!raw) return;

    // Only migrate once — if new keys already exist, skip.
    if (localStorage.getItem(AUTH_KEY) && localStorage.getItem(SYNC_KEY)) return;

    const old = JSON.parse(raw);
    const state = old?.state;
    if (!state) return;

    if (!localStorage.getItem(AUTH_KEY)) {
      localStorage.setItem(
        AUTH_KEY,
        JSON.stringify({
          state: { apiBase: state.apiBase, token: state.token, email: state.email },
          version: 0,
        }),
      );
    }

    if (!localStorage.getItem(SYNC_KEY)) {
      localStorage.setItem(
        SYNC_KEY,
        JSON.stringify({
          state: { deviceId: state.deviceId, lastSyncCursor: state.lastSyncCursor },
          version: 0,
        }),
      );
    }

    // Remove old key to avoid re-running.
    localStorage.removeItem(OLD_KEY);
  } catch {
    // Best-effort only.
  }
}

// Execute immediately on module load (side-effect import).
migrateStoreKeys();
