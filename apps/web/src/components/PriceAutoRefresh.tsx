import { useEffect, useMemo, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useDbQuery } from '../hooks/useDbQuery';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { refreshLivePrices } from '../derived/refreshLivePrices';

/**
 * Periodically refreshes live prices and triggers a derived-cache rebuild.
 *
 * Uses Settings.autoRefreshIntervalSec (default 300). Runs only when vault is unlocked.
 */
export default function PriceAutoRefresh() {
  const { vaultReady, vaultSetup, passphrase, apiBase } = useAppStore((s) => ({
    vaultReady: s.vaultReady,
    vaultSetup: s.vaultSetup,
    passphrase: s.passphrase,
    apiBase: s.apiBase
  }));

  const unlocked = useMemo(() => !!(vaultReady && vaultSetup && passphrase), [vaultReady, vaultSetup, passphrase]);

  const settingsQ = useDbQuery(
    async () => {
      if (!unlocked) return undefined;
      // Ensure settings exist + migrate legacy keys (KP-UI-002).
      return ensureDefaultSettings();
    },
    [unlocked]
  );

  const intervalSec = settingsQ.data?.autoRefreshIntervalSec ?? 0;
  const baseCurrency = String(settingsQ.data?.baseCurrency ?? 'EUR').toUpperCase();

  const inFlight = useRef(false);

  useEffect(() => {
    if (!unlocked) return;
    if (!intervalSec || intervalSec <= 0) return;

    let stopped = false;

    const tick = async () => {
      if (stopped) return;
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        await ensureDefaultSettings();
        await refreshLivePrices(apiBase, baseCurrency);
      } catch {
        // best-effort; UI will show last refresh + errors elsewhere
      } finally {
        inFlight.current = false;
      }
    };

    void tick();
    const id = setInterval(() => void tick(), intervalSec * 1000);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [unlocked, intervalSec, apiBase, baseCurrency]);

  return null;
}
