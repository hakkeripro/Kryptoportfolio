import { useEffect, useRef } from 'react';
import { getMeta, setMeta } from '@kp/platform-web';
import { useAppStore } from '../store/useAppStore';
import { loadCoinbaseIntegration, saveCoinbaseIntegration } from '../integrations/coinbase/coinbaseVault';
import { bestEffortFxToBase, fetchCoinbaseAccounts, fetchNewestTransactionsSince } from '../integrations/coinbase/coinbaseSync';
import { buildCoinbaseImportPreview, computeCoinbaseDedupe, commitCoinbaseImport } from '../integrations/coinbase/coinbaseImport';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

/**
 * Foreground auto-sync for exchange integrations.
 *
 * This runs only while the app is open (PWA friendly). Auto-commit is conservative:
 * if import issues exist (missing FX, missing fee valuation...), we do NOT advance cursors.
 */
export default function IntegrationAutoSync() {
  const passphrase = useAppStore((s) => s.passphrase);
  const token = useAppStore((s) => s.token);
  const apiBase = useAppStore((s) => s.apiBase);

  const inFlight = useRef(false);
  const timer = useRef<number | null>(null);
  const nextRunAtMs = useRef<number>(0);

  type SyncStatus = {
    lastRunISO?: string;
    lastSuccessISO?: string;
    lastCommitISO?: string;
    lastError?: string | null;
    consecutiveFailures?: number;
    nextRunISO?: string;
    lastFetchedCount?: number;
    lastCursorByAccount?: Record<string, string>;
    lastMode?: 'autosync' | 'manual';
    inFlight?: boolean;
    lastDurationMs?: number;
  };

  const STATUS_KEY = 'coinbase:autosyncStatus';

  async function readStatus(): Promise<SyncStatus> {
    const raw = await getMeta(STATUS_KEY);
    if (!raw) return {};
    try {
      return JSON.parse(raw) as SyncStatus;
    } catch {
      return {};
    }
  }

  async function writeStatus(partial: Partial<SyncStatus>) {
    const cur = await readStatus();
    const next: SyncStatus = { ...cur, ...partial };
    await setMeta(STATUS_KEY, JSON.stringify(next));
  }

  useEffect(() => {
    let cancelled = false;

    async function buildFxRatesToBase(items: { tx: any }[], baseCurrency: string): Promise<Record<string, string>> {
      const base = baseCurrency.toUpperCase();
      const currencies = new Set<string>([base]);

      for (const it of items) {
        const tx = it.tx;
        const add = (c?: string) => {
          if (!c) return;
          currencies.add(String(c).toUpperCase());
        };
        add(tx?.native_amount?.currency);
        add(tx?.buy?.subtotal?.currency);
        add(tx?.sell?.subtotal?.currency);
        add(tx?.fee?.currency);
        add(tx?.buy?.fee?.currency);
        add(tx?.sell?.fee?.currency);
        add(tx?.network?.transaction_fee?.currency);
        add(tx?.network?.fee?.currency);
      }

      const out: Record<string, string> = { [base]: '1' };
      for (const cur of currencies) {
        if (cur === base) continue;
        const fx = await bestEffortFxToBase(apiBase, cur, base);
        if (fx) out[cur] = fx.toFixed();
      }
      return out;
    }

    async function tick(opts?: { force?: boolean }) {
      if (!passphrase || !token) return;
      if (inFlight.current) return;
      if (!opts?.force && nextRunAtMs.current && Date.now() < nextRunAtMs.current) return;
      inFlight.current = true;
      const nowISO = new Date().toISOString();
      const t0 = performance.now();
      try {
        const cfg = await loadCoinbaseIntegration(passphrase);
        if (!cfg.credentials) return;
        if (!cfg.settings.autoSync && !opts?.force) return;

        await writeStatus({ inFlight: true, lastRunISO: nowISO, lastMode: opts?.force ? 'manual' : 'autosync', lastError: null });

        const settings = await ensureDefaultSettings();
        const baseCurrency = settings.baseCurrency || 'EUR';

        const accounts = await fetchCoinbaseAccounts(apiBase, token, cfg.credentials);
        const newest = await fetchNewestTransactionsSince(
          apiBase,
          token,
          cfg.credentials,
          accounts,
          cfg.settings.lastSeenTxIdByAccount
        );

        await writeStatus({ lastFetchedCount: newest.length, lastCursorByAccount: { ...cfg.settings.lastSeenTxIdByAccount } });

        if (!newest.length) {
          // Success: nothing to do.
          await writeStatus({ lastSuccessISO: nowISO, consecutiveFailures: 0, lastError: null });
          const baseMs = Math.max(60_000, (cfg.settings.intervalMinutes ?? 10) * 60_000);
          nextRunAtMs.current = Date.now() + baseMs;
          await writeStatus({ nextRunISO: new Date(nextRunAtMs.current).toISOString() });
          return;
        }
        if (!cfg.settings.autoCommit) {
          // User wants manual commit, so we only fetch.
          await writeStatus({ lastSuccessISO: nowISO, consecutiveFailures: 0, lastError: null });
          const baseMs = Math.max(60_000, (cfg.settings.intervalMinutes ?? 10) * 60_000);
          nextRunAtMs.current = Date.now() + baseMs;
          await writeStatus({ nextRunISO: new Date(nextRunAtMs.current).toISOString() });
          return;
        }

        const fxRatesToBase = await buildFxRatesToBase(newest, baseCurrency);

        const preview0 = buildCoinbaseImportPreview({
          items: newest,
          baseCurrency,
          settings,
          overrides: { fxRatesToBase }
        });
        const preview = await computeCoinbaseDedupe(preview0);

        // Do not auto-commit if import is blocked by issues.
        if (preview.issues.length || !preview.newEvents.length) {
          await writeStatus({
            lastSuccessISO: nowISO,
            consecutiveFailures: 0,
            lastError: preview.issues.length ? `blocked:${preview.issues[0].type}` : null
          });
          const baseMs = Math.max(60_000, (cfg.settings.intervalMinutes ?? 10) * 60_000);
          nextRunAtMs.current = Date.now() + baseMs;
          await writeStatus({ nextRunISO: new Date(nextRunAtMs.current).toISOString() });
          return;
        }

        await commitCoinbaseImport(preview);
        await rebuildDerivedCaches({ daysBack: 365 });

        // Update lastSeen per account (take the newest tx id we saw)
        const updated = { ...cfg };
        for (const acc of accounts) {
          const firstForAcc = newest.find((x) => x.accountId === acc.id);
          if (firstForAcc) updated.settings.lastSeenTxIdByAccount[acc.id] = firstForAcc.tx.id;
        }
        await saveCoinbaseIntegration(passphrase, updated);

        await writeStatus({ lastSuccessISO: nowISO, lastCommitISO: nowISO, consecutiveFailures: 0, lastError: null });

        const baseMs = Math.max(60_000, (cfg.settings.intervalMinutes ?? 10) * 60_000);
        nextRunAtMs.current = Date.now() + baseMs;
        await writeStatus({ nextRunISO: new Date(nextRunAtMs.current).toISOString() });
      } catch (e: any) {
        const cfg = await loadCoinbaseIntegration(passphrase).catch(() => null);
        const baseMs = Math.max(60_000, ((cfg as any)?.settings?.intervalMinutes ?? 10) * 60_000);

        const current = await readStatus();
        const failures = (current.consecutiveFailures ?? 0) + 1;
        // Exponential backoff, capped to 30 minutes.
        const backoff = Math.min(baseMs * Math.pow(2, Math.min(6, failures)), 30 * 60_000);
        nextRunAtMs.current = Date.now() + backoff;

        await writeStatus({
          lastRunISO: nowISO,
          lastError: String(e?.message ?? e ?? 'unknown_error'),
          consecutiveFailures: failures,
          nextRunISO: new Date(nextRunAtMs.current).toISOString()
        });
      } finally {
        inFlight.current = false;
        await writeStatus({ inFlight: false, lastDurationMs: Math.round(performance.now() - t0) });
      }
    }

    // Start interval only when unlocked + logged in
    if (!passphrase || !token) {
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      return;
    }

    const runNowEvent = 'kp_coinbase_autosync_run_now';
    const onRunNow = () => {
      // Force an immediate run regardless of schedule/backoff.
      nextRunAtMs.current = 0;
      void tick({ force: true });
    };

    (async () => {
      const cfg = await loadCoinbaseIntegration(passphrase);
      if (cancelled) return;

      // Restore persisted schedule.
      const status = await readStatus();
      const nextRunISO = status.nextRunISO;
      nextRunAtMs.current = nextRunISO ? Date.parse(nextRunISO) : 0;

      // Check frequently, actual schedule is controlled by nextRunAtMs (+ backoff on failures).
      void tick();
      if (timer.current) window.clearInterval(timer.current);
      timer.current = window.setInterval(() => void tick(), 30_000);

      window.addEventListener(runNowEvent, onRunNow);

      // If never scheduled, schedule based on settings.
      if (!nextRunAtMs.current) {
        const baseMs = Math.max(60_000, (cfg.settings.intervalMinutes ?? 10) * 60_000);
        nextRunAtMs.current = Date.now() + baseMs;
        await writeStatus({ nextRunISO: new Date(nextRunAtMs.current).toISOString() });
      }
    })();

    return () => {
      cancelled = true;
      if (timer.current) window.clearInterval(timer.current);
      timer.current = null;
      window.removeEventListener(runNowEvent, onRunNow);
    };
  }, [apiBase, passphrase, token]);

  return null;
}
