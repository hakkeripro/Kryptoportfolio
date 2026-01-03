import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

/**
 * Ensures derived tables exist and are up-to-date.
 *
 * Runs every time the vault transitions from locked -> unlocked.
 */
export default function DerivedBootstrap() {
  const { vaultReady, vaultSetup, passphrase } = useAppStore((s) => ({
    vaultReady: s.vaultReady,
    vaultSetup: s.vaultSetup,
    passphrase: s.passphrase
  }));

  const wasUnlocked = useRef(false);

  useEffect(() => {
    const unlocked = !!(vaultReady && vaultSetup && passphrase);
    if (!unlocked) {
      wasUnlocked.current = false;
      return;
    }
    if (wasUnlocked.current) return;
    wasUnlocked.current = true;

    void (async () => {
      await ensureDefaultSettings();
      await rebuildDerivedCaches({ daysBack: 365 });
    })();
  }, [vaultReady, vaultSetup, passphrase]);

  return null;
}
