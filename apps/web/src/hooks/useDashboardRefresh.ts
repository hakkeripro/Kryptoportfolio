import { useEffect, useRef, useState, useCallback } from 'react';
import { getMeta, ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { refreshLivePrices } from '../derived/refreshLivePrices';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

interface RefreshStatus {
  lastRebuildISO: string | null;
  lastPriceAttemptISO: string | null;
  lastPriceRefreshISO: string | null;
}

export function useDashboardRefresh(apiBase: string, baseCurrency: string, triggerKey?: string) {
  const [status, setStatus] = useState<RefreshStatus>({
    lastRebuildISO: null,
    lastPriceAttemptISO: null,
    lastPriceRefreshISO: null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    void (async () => {
      const lastRebuildISO = await getMeta('derived:lastRebuildISO');
      const lastPriceAttemptISO = await getMeta('prices:lastAttemptISO');
      const lastPriceRefreshISO = await getMeta('prices:lastRefreshISO');
      setStatus({
        lastRebuildISO: lastRebuildISO || null,
        lastPriceAttemptISO: lastPriceAttemptISO || null,
        lastPriceRefreshISO: lastPriceRefreshISO || null,
      });
    })();
  }, [triggerKey]);

  // Poll meta values so "Last price update" stays current
  useEffect(() => {
    const poll = async () => {
      const a = await getMeta('prices:lastAttemptISO');
      const r = await getMeta('prices:lastRefreshISO');
      setStatus((prev) =>
        prev.lastPriceAttemptISO === a && prev.lastPriceRefreshISO === r
          ? prev
          : { ...prev, lastPriceAttemptISO: a || null, lastPriceRefreshISO: r || null },
      );
    };
    const id = setInterval(() => void poll(), 15_000);
    return () => clearInterval(id);
  }, []);

  const refreshNow = useCallback(async () => {
    if (lock.current) return;
    lock.current = true;
    setRefreshing(true);
    try {
      try {
        await refreshLivePrices(apiBase, baseCurrency);
      } catch {
        // Ignore live price fetch failures
      }
      await rebuildDerivedCaches({ daysBack: 365 });
      const lastRebuildISO = await getMeta('derived:lastRebuildISO');
      const lastPriceAttemptISO = await getMeta('prices:lastAttemptISO');
      const lastPriceRefreshISO = await getMeta('prices:lastRefreshISO');
      setStatus({
        lastRebuildISO: lastRebuildISO || new Date().toISOString(),
        lastPriceAttemptISO: lastPriceAttemptISO || null,
        lastPriceRefreshISO: lastPriceRefreshISO || null,
      });
    } finally {
      lock.current = false;
      setRefreshing(false);
    }
  }, [apiBase, baseCurrency]);

  const toggleAutoRefresh = useCallback(async (next: boolean) => {
    await ensureWebDbOpen();
    const db = getWebDb();
    const s = (await db.settings.get('settings_1')) ?? (await ensureDefaultSettings());
    const interval = next
      ? ((s.autoRefreshIntervalSec || 300) as typeof s.autoRefreshIntervalSec)
      : (0 as const);
    await db.settings.put({
      ...s,
      updatedAtISO: new Date().toISOString(),
      autoRefreshIntervalSec: interval,
    });
  }, []);

  return { status, refreshing, refreshNow, toggleAutoRefresh };
}
