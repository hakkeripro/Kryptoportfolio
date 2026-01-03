import { useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/useAppStore';
import { clearCoinbaseIntegration, loadCoinbaseIntegration, saveCoinbaseIntegration } from '../integrations/coinbase/coinbaseVault';
import { fetchAllTransactions, fetchCoinbaseAccounts, fetchNewestTransactionsSince, bestEffortFxToBase, type CoinbaseCreds } from '../integrations/coinbase/coinbaseSync';
import type { CoinbaseAccount, CoinbaseTransaction } from '../integrations/coinbase/coinbaseApi';
import { buildCoinbaseImportPreview, commitCoinbaseImport, computeCoinbaseDedupe, type CoinbaseImportOverrides, type CoinbaseImportPreview } from '../integrations/coinbase/coinbaseImport';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import type { ImportIssue } from '@kp/core';
import { useDbQuery } from '../hooks/useDbQuery';

function CoinbaseLogo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true" className="text-blue-600">
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14.5 8.5a4.5 4.5 0 1 0 0 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

type Step = 'connect' | 'fetch' | 'preview' | 'done';

export default function ImportsPage() {
  const passphrase = useAppStore((s) => s.passphrase);
  const token = useAppStore((s) => s.token);
  const apiBase = useAppStore((s) => s.apiBase);

  const [step, setStep] = useState<Step>('connect');
  const [loading, setLoading] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [keyName, setKeyName] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [connected, setConnected] = useState(false);

  const [accounts, setAccounts] = useState<CoinbaseAccount[]>([]);
  const [lastSeenByAccount, setLastSeenByAccount] = useState<Record<string, string>>({});
  const [autoCommit, setAutoCommit] = useState(true);
  const [autoSync, setAutoSync] = useState(true);

  const [items, setItems] = useState<{ accountId: string; tx: CoinbaseTransaction }[]>([]);
  const [preview, setPreview] = useState<CoinbaseImportPreview | null>(null);

  // User-provided overrides for resolving import issues.
  const [fxRatesToBase, setFxRatesToBase] = useState<Record<string, string>>({});
  const [feeValueBaseByRefKey, setFeeValueBaseByRefKey] = useState<Record<string, string>>({});
  const [tradeValuationBaseByTradeKey, setTradeValuationBaseByTradeKey] = useState<Record<string, string>>({});
  const [rewardFmvTotalBaseByTxId, setRewardFmvTotalBaseByTxId] = useState<Record<string, string>>({});

  const [commitResult, setCommitResult] = useState<any>(null);

  const cbStatus = useDbQuery<any | null>(
    async (db) => {
      const row = await db.meta.get('coinbase:autosyncStatus');
      if (!row?.value) return null;
      try {
        return JSON.parse(row.value);
      } catch {
        return null;
      }
    },
    [],
    null
  );

  useEffect(() => {
    if (!passphrase) return;
    void (async () => {
      const cfg = await loadCoinbaseIntegration(passphrase);
      if (cfg.credentials) {
        setKeyName(cfg.credentials.keyName);
        setPrivateKeyPem(cfg.credentials.privateKeyPem);
        setConnected(true);
        setAutoCommit(cfg.settings.autoCommit);
        setAutoSync(cfg.settings.autoSync);
        setLastSeenByAccount(cfg.settings.lastSeenTxIdByAccount ?? {});
        setStep('fetch');
      }
    })();
  }, [passphrase]);

  const baseCurrency = useMemo(() => {
    // Ensured in ensureDefaultSettings()
    return (preview?.baseCurrency ?? 'EUR').toUpperCase();
  }, [preview?.baseCurrency]);

  async function connect() {
    if (!passphrase) {
      setErr('Vault is locked. Unlock vault to connect Coinbase.');
      return;
    }
    if (!token) {
      setErr('Not authenticated. Please register/login first.');
      return;
    }
    setErr(null);
    setLoading('Connecting…');
    try {
      const creds: CoinbaseCreds = { keyName: keyName.trim(), privateKeyPem: privateKeyPem.trim() };
      const accs = await fetchCoinbaseAccounts(apiBase, token, creds);
      setAccounts(accs);
      setConnected(true);
      const cfg = await loadCoinbaseIntegration(passphrase);
      const updated = {
        ...cfg,
        credentials: creds,
        settings: { ...cfg.settings, autoCommit, autoSync }
      };
      await saveCoinbaseIntegration(passphrase, updated);
      setStep('fetch');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function disconnect() {
    if (!passphrase) return;
    setErr(null);
    setLoading('Disconnecting…');
    try {
      await clearCoinbaseIntegration(passphrase);
      setConnected(false);
      setAccounts([]);
      setItems([]);
      setPreview(null);
      setCommitResult(null);
      setStep('connect');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function loadAccountsIfNeeded(creds: CoinbaseCreds) {
    if (accounts.length) return accounts;
    const accs = await fetchCoinbaseAccounts(apiBase, token!, creds);
    setAccounts(accs);
    return accs;
  }

  async function buildFxRatesToBaseAuto(items0: { tx: any }[], base: string) {
    const b = base.toUpperCase();
    const currencies = new Set<string>([b]);
    for (const it of items0) {
      const tx = it.tx;
      const add = (c?: string) => c && currencies.add(String(c).toUpperCase());
      add(tx?.native_amount?.currency);
      add(tx?.buy?.subtotal?.currency);
      add(tx?.sell?.subtotal?.currency);
      add(tx?.fee?.currency);
      add(tx?.buy?.fee?.currency);
      add(tx?.sell?.fee?.currency);
      add(tx?.network?.transaction_fee?.currency);
      add(tx?.network?.fee?.currency);
    }
    const next: Record<string, string> = { [b]: '1' };
    for (const cur of currencies) {
      if (cur === b) continue;
      const fx = await bestEffortFxToBase(apiBase, cur, b);
      if (fx) next[cur] = fx.toFixed();
    }
    setFxRatesToBase(next);
    return next;
  }

  async function runFetch(kind: 'all' | 'newest') {
    if (!passphrase || !token) return;
    setErr(null);
    setLoading(kind === 'all' ? 'Fetching full history…' : 'Fetching newest…');
    try {
      const cfg = await loadCoinbaseIntegration(passphrase);
      if (!cfg.credentials) throw new Error('Not connected');
      const creds = cfg.credentials;
      const accs = await loadAccountsIfNeeded(creds);

      const settings = await ensureDefaultSettings();
      const base = settings.baseCurrency || 'EUR';

      const fetched =
        kind === 'all'
          ? await fetchAllTransactions(apiBase, token, creds, accs)
          : await fetchNewestTransactionsSince(apiBase, token, creds, accs, cfg.settings.lastSeenTxIdByAccount);

      setItems(fetched);

      const fxAuto = await buildFxRatesToBaseAuto(fetched, base);
      const overrides: CoinbaseImportOverrides = {
        fxRatesToBase: { ...fxAuto, ...fxRatesToBase },
        feeValueBaseByRefKey,
        tradeValuationBaseByTradeKey,
        rewardFmvTotalBaseByTxId
      };

      const p0 = buildCoinbaseImportPreview({ items: fetched, baseCurrency: base, settings, overrides });
      const p = await computeCoinbaseDedupe(p0);
      setPreview(p);
      setStep('preview');

      if (autoCommit) {
        if (p.issues.length) {
          setErr('Import needs input before it can be committed. Please resolve the issues below.');
          return;
        }
        await doCommit(p, accs, fetched);
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  async function doCommit(p: CoinbaseImportPreview, accs: CoinbaseAccount[], fetched: { accountId: string; tx: CoinbaseTransaction }[]) {
    if (!passphrase) return;
    setErr(null);
    setLoading('Committing…');
    try {
      const r = await commitCoinbaseImport(p);
      await rebuildDerivedCaches({ daysBack: 365 });

      // Advance lastSeen only after a successful commit.
      const cfg = await loadCoinbaseIntegration(passphrase);
      const updated = { ...cfg };
      for (const acc of accs) {
        const firstForAcc = fetched.find((x) => x.accountId === acc.id);
        if (firstForAcc) updated.settings.lastSeenTxIdByAccount[acc.id] = firstForAcc.tx.id;
      }
      updated.settings.autoCommit = autoCommit;
      updated.settings.autoSync = autoSync;
      await saveCoinbaseIntegration(passphrase, updated);
      setLastSeenByAccount(updated.settings.lastSeenTxIdByAccount);

      setCommitResult({ ...r, fetched: fetched.length, mapped: p.events.length, newEvents: p.newEvents.length });
      setStep('done');
    } finally {
      setLoading(null);
    }
  }

  async function rebuildPreview() {
    if (!items.length) return;
    setErr(null);
    setLoading('Rebuilding preview…');
    try {
      const settings = await ensureDefaultSettings();
      const base = settings.baseCurrency || 'EUR';
      const overrides: CoinbaseImportOverrides = {
        fxRatesToBase: { ...fxRatesToBase, [base.toUpperCase()]: '1' },
        feeValueBaseByRefKey,
        tradeValuationBaseByTradeKey,
        rewardFmvTotalBaseByTxId
      };
      const p0 = buildCoinbaseImportPreview({ items, baseCurrency: base, settings, overrides });
      const p = await computeCoinbaseDedupe(p0);
      setPreview(p);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  }

  const issueGroups = useMemo(() => {
    const issues = preview?.issues ?? [];
    const fx = new Map<string, ImportIssue[]>();
    const fee = new Map<string, ImportIssue[]>();
    const swap = new Map<string, ImportIssue[]>();
    const reward = new Map<string, ImportIssue[]>();
    for (const i of issues) {
      if (i.type === 'FX_MISSING') fx.set(i.currency, [...(fx.get(i.currency) ?? []), i]);
      if (i.type === 'FEE_VALUE_MISSING') fee.set(i.refKey, [...(fee.get(i.refKey) ?? []), i]);
      if (i.type === 'SWAP_VALUATION_MISSING') swap.set(i.tradeKey, [...(swap.get(i.tradeKey) ?? []), i]);
      if (i.type === 'REWARD_FMV_MISSING') reward.set(i.txId, [...(reward.get(i.txId) ?? []), i]);
    }
    return { fx, fee, swap, reward };
  }, [preview?.issues]);

  const canCommit = !!preview && preview.issues.length === 0 && preview.newEvents.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Imports</h1>
          <p className="text-sm text-slate-600">Connect exchanges and import transactions into the append-only ledger.</p>
        </div>
      </div>

      {err ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800" data-testid="alert-import-error">
          {err}
        </div>
      ) : null}

      <div className="grid gap-4" data-testid="list-import-sources">
        <div className="rounded-2xl border bg-white p-5 shadow-sm" data-testid="card-import-coinbase">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CoinbaseLogo />
              <div>
                <div className="font-semibold">Coinbase</div>
                <div className="text-xs text-slate-600">CDP Secret API Key (ECDSA / ES256)</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connected ? (
                <button
                  className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                  onClick={() => void disconnect()}
                  disabled={!!loading}
                  data-testid="btn-coinbase-disconnect"
                >
                  Disconnect
                </button>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-slate-600">Step 1: Connect</div>
              <div className="mt-2 space-y-2">
                <label className="block">
                  <div className="text-xs text-slate-600">Key name</div>
                  <input
                    className="mt-1 w-full rounded-lg border px-3 py-2 text-sm"
                    value={keyName}
                    onChange={(e) => setKeyName(e.target.value)}
                    placeholder="organizations/.../apiKeys/..."
                    disabled={!!loading || connected}
                    data-testid="form-coinbase-keyname"
                  />
                </label>
                <label className="block">
                  <div className="text-xs text-slate-600">Private key (PEM) or JSON key file contents</div>
                  <textarea
                    className="mt-1 h-28 w-full rounded-lg border px-3 py-2 font-mono text-xs"
                    value={privateKeyPem}
                    onChange={(e) => setPrivateKeyPem(e.target.value)}
                    placeholder="-----BEGIN EC PRIVATE KEY-----\n...\n-----END EC PRIVATE KEY-----"
                    disabled={!!loading || connected}
                    data-testid="form-coinbase-privatekey"
                  />
                </label>

                {!connected ? (
                  <button
                    className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                    onClick={() => void connect()}
                    disabled={!!loading || !passphrase || !token || !keyName.trim() || !privateKeyPem.trim()}
                    data-testid="btn-coinbase-connect"
                  >
                    {loading ? loading : 'Connect'}
                  </button>
                ) : (
                  <div className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800" data-testid="badge-coinbase-connected">
                    Connected
                  </div>
                )}
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-slate-600">Step 2: Fetch</div>
              <div className="mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm" data-testid="toggle-import-autocommit">
                    <input
                      type="checkbox"
                      checked={autoCommit}
                      onChange={(e) => setAutoCommit(e.target.checked)}
                      disabled={!!loading}
                    />
                    Auto-commit after fetch
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 text-sm" data-testid="toggle-import-autosync">
                    <input type="checkbox" checked={autoSync} onChange={(e) => setAutoSync(e.target.checked)} disabled={!!loading} />
                    Auto-sync while app is open
                  </label>
                </div>

                <button
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void runFetch('newest')}
                  disabled={!!loading || !connected}
                  data-testid="btn-import-run"
                >
                  Fetch newest
                </button>
                <button
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void runFetch('all')}
                  disabled={!!loading || !connected}
                  data-testid="btn-import-run-all"
                >
                  Fetch all history
                </button>

                <div className="rounded-lg border bg-slate-50 p-3 text-xs" data-testid="box-coinbase-autosync-status">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600">Auto-sync status</span>
                    <span
                      className="rounded-md bg-white px-2 py-0.5 font-mono"
                      data-testid="badge-coinbase-autosync-inflight"
                    >
                      {cbStatus.data?.inFlight ? 'running…' : 'idle'}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1">
                    <div className="flex items-center justify-between"><span className="text-slate-600">Last run</span><span className="font-mono">{cbStatus.data?.lastRunISO ? new Date(cbStatus.data.lastRunISO).toLocaleString() : '—'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Last commit</span><span className="font-mono">{cbStatus.data?.lastCommitISO ? new Date(cbStatus.data.lastCommitISO).toLocaleString() : '—'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Next run</span><span className="font-mono">{cbStatus.data?.nextRunISO ? new Date(cbStatus.data.nextRunISO).toLocaleString() : '—'}</span></div>
                  <div className="flex items-center justify-between"><span className="text-slate-600">Fetched last time</span><span className="font-mono">{typeof cbStatus.data?.lastFetchedCount === 'number' ? cbStatus.data.lastFetchedCount : '—'}</span></div>
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      className="rounded-md border bg-white px-2 py-1 text-[11px] hover:bg-slate-50 disabled:opacity-50"
                      onClick={() => window.dispatchEvent(new Event('kp_coinbase_autosync_run_now'))}
                      disabled={!connected || !!cbStatus.data?.inFlight}
                      data-testid="btn-coinbase-autosync-run-now"
                    >
                      Run now
                    </button>
                    <span className="text-[11px] text-slate-600" data-testid="text-coinbase-autosync-duration">
                      {typeof cbStatus.data?.lastDurationMs === 'number' ? `${cbStatus.data.lastDurationMs}ms` : ''}
                    </span>
                  </div>
                  {cbStatus.data?.consecutiveFailures ? (
                    <div className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-amber-900" data-testid="badge-coinbase-autosync-backoff">
                      Backoff: {cbStatus.data.consecutiveFailures} consecutive failure(s){cbStatus.data.lastError ? ` — ${cbStatus.data.lastError}` : ''}
                    </div>
                  ) : cbStatus.data?.lastError ? (
                    <div className="mt-2 rounded-md bg-amber-100 px-2 py-1 text-amber-900" data-testid="badge-coinbase-autosync-info">
                      {String(cbStatus.data.lastError)}
                    </div>
                  ) : null}
                </div>

                <div className="text-xs text-slate-600">
                  Last seen cursors:
                  <div className="mt-1 rounded-lg bg-slate-50 p-2 font-mono text-[11px]" data-testid="box-cb-cursors">
                    {Object.keys(lastSeenByAccount).length ? JSON.stringify(lastSeenByAccount, null, 2) : '—'}
                  </div>
                </div>

                <details className="rounded-lg border bg-slate-50 p-3 text-xs" data-testid="details-coinbase-cursor-telemetry">
                  <summary className="cursor-pointer select-none text-slate-700">Cursor telemetry (last autosync)</summary>
                  <div className="mt-2 rounded-lg bg-white p-2 font-mono text-[11px]">
                    {cbStatus.data?.lastCursorByAccount && Object.keys(cbStatus.data.lastCursorByAccount).length
                      ? JSON.stringify(cbStatus.data.lastCursorByAccount, null, 2)
                      : '—'}
                  </div>
                </details>
              </div>
            </div>

            <div className="md:col-span-1">
              <div className="text-xs font-semibold text-slate-600">Step 3: Preview &amp; commit</div>
              <div className="mt-2 space-y-3">
                {preview ? (
                  <div className="rounded-lg border bg-slate-50 p-3 text-sm" data-testid="box-import-stats">
                    <div className="flex items-center justify-between"><span>Fetched</span><span className="font-mono">{items.length}</span></div>
                    <div className="flex items-center justify-between"><span>Mapped events</span><span className="font-mono">{preview.events.length}</span></div>
                    <div className="flex items-center justify-between"><span>New events</span><span className="font-mono">{preview.newEvents.length}</span></div>
                    <div className="flex items-center justify-between"><span>Duplicates</span><span className="font-mono">{preview.duplicateExternalRefs.length}</span></div>
                    <div className="flex items-center justify-between"><span>Issues</span><span className="font-mono">{preview.issues.length}</span></div>
                  </div>
                ) : (
                  <div className="text-sm text-slate-600">Run a fetch to generate a preview.</div>
                )}

                <button
                  className="w-full rounded-lg border px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  onClick={() => void rebuildPreview()}
                  disabled={!!loading || !preview}
                  data-testid="btn-import-rebuild-preview"
                >
                  Rebuild preview
                </button>

                <button
                  className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                  onClick={() => void doCommit(preview!, accounts, items)}
                  disabled={!!loading || !connected || !canCommit}
                  data-testid="btn-import-commit"
                >
                  Commit
                </button>

                {!canCommit && preview ? (
                  <div className="text-xs text-slate-600">
                    {preview.issues.length ? 'Resolve issues to enable commit.' : preview.newEvents.length ? 'Ready.' : 'Nothing new to commit.'}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          {preview ? (
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-white p-4" data-testid="panel-import-preview">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Preview</div>
                  <div className="text-xs text-slate-600">Ledger events (new + duplicates)</div>
                </div>
                <div className="mt-3 max-h-[420px] overflow-auto" data-testid="list-import-preview">
                  {preview.events.length ? (
                    <ul className="space-y-2">
                      {preview.events.slice(0, 200).map((e) => (
                        <li
                          key={e.id}
                          className="rounded-lg border bg-slate-50 p-2"
                          data-testid={`row-import-preview-${e.id}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="text-sm font-medium">
                              {e.type} {e.amount} {String(e.assetId).replace(/^asset_/, '').toUpperCase()}
                            </div>
                            {e.externalRef && preview.duplicateExternalRefs.includes(e.externalRef) ? (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs" data-testid={`badge-import-dup-${e.id}`}>dup</span>
                            ) : (
                              <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-800">new</span>
                            )}
                          </div>
                          <div className="mt-1 text-xs text-slate-600">
                            {new Date(e.timestampISO).toLocaleString()} • {e.externalRef}
                          </div>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="text-sm text-slate-600">No mapped events.</div>
                  )}
                  {preview.events.length > 200 ? <div className="mt-3 text-xs text-slate-600">Showing first 200 events…</div> : null}
                </div>
              </div>

              <div className="rounded-xl border bg-white p-4" data-testid="panel-import-issues">
                <div className="flex items-center justify-between">
                  <div className="font-semibold">Issues</div>
                  <div className="text-xs text-slate-600">Base currency: {baseCurrency}</div>
                </div>

                {preview.issues.length ? (
                  <div className="mt-3 space-y-4" data-testid="list-import-issues">
                    {issueGroups.fx.size ? (
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="text-sm font-semibold">Missing FX rates</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(issueGroups.fx.entries()).map(([cur, arr]) => (
                            <div key={cur} className="flex items-center gap-2" data-testid={`row-import-issue-fx-${cur}`}>
                              <div className="w-20 text-sm font-mono">{cur}</div>
                              <input
                                className="flex-1 rounded-md border px-2 py-1 text-sm"
                                placeholder={`1 ${cur} = ? ${baseCurrency}`}
                                value={fxRatesToBase[cur] ?? ''}
                                onChange={(e) => setFxRatesToBase((m) => ({ ...m, [cur]: e.target.value }))}
                                data-testid={`input-import-fx-${cur}`}
                              />
                              <div className="text-xs text-slate-600">txs: {arr.flatMap((x) => x.txIds).join(', ')}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {issueGroups.fee.size ? (
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="text-sm font-semibold">Fee value missing</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(issueGroups.fee.entries()).map(([refKey, arr]) => {
                            const i = arr[0] as any;
                            return (
                              <div key={refKey} className="flex items-center gap-2" data-testid={`row-import-issue-fee-${refKey}`}>
                                <div className="w-28 text-xs font-mono">{refKey}</div>
                                <div className="w-28 text-xs text-slate-700">{i.feeAmount} {i.feeCurrency}</div>
                                <input
                                  className="flex-1 rounded-md border px-2 py-1 text-sm"
                                  placeholder={`Fee value in ${baseCurrency}`}
                                  value={feeValueBaseByRefKey[refKey] ?? ''}
                                  onChange={(e) => setFeeValueBaseByRefKey((m) => ({ ...m, [refKey]: e.target.value }))}
                                  data-testid={`input-import-feevalue-${refKey}`}
                                />
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {issueGroups.swap.size ? (
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="text-sm font-semibold">Swap valuation missing</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(issueGroups.swap.entries()).map(([tradeKey, arr]) => (
                            <div key={tradeKey} className="flex items-center gap-2" data-testid={`row-import-issue-swap-${tradeKey}`}>
                              <div className="w-28 text-xs font-mono">{tradeKey}</div>
                              <div className="text-xs text-slate-600">txIds: {(arr[0] as any).txIds.join(', ')}</div>
                              <input
                                className="flex-1 rounded-md border px-2 py-1 text-sm"
                                placeholder={`Valuation in ${baseCurrency}`}
                                value={tradeValuationBaseByTradeKey[tradeKey] ?? ''}
                                onChange={(e) => setTradeValuationBaseByTradeKey((m) => ({ ...m, [tradeKey]: e.target.value }))}
                                data-testid={`input-import-swapvalue-${tradeKey}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {issueGroups.reward.size ? (
                      <div className="rounded-lg border bg-amber-50 p-3">
                        <div className="text-sm font-semibold">Reward FMV missing</div>
                        <div className="mt-2 space-y-2">
                          {Array.from(issueGroups.reward.entries()).map(([txId, arr]) => (
                            <div key={txId} className="flex items-center gap-2" data-testid={`row-import-issue-reward-${txId}`}>
                              <div className="w-28 text-xs font-mono">{txId}</div>
                              <div className="w-28 text-xs text-slate-700">{(arr[0] as any).amount} {(arr[0] as any).currency}</div>
                              <input
                                className="flex-1 rounded-md border px-2 py-1 text-sm"
                                placeholder={`FMV total in ${baseCurrency}`}
                                value={rewardFmvTotalBaseByTxId[txId] ?? ''}
                                onChange={(e) => setRewardFmvTotalBaseByTxId((m) => ({ ...m, [txId]: e.target.value }))}
                                data-testid={`input-import-rewardfmv-${txId}`}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="text-xs text-slate-600">
                      After entering values, click <span className="font-medium">Rebuild preview</span>.
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800" data-testid="badge-import-noissues">
                    No blocking issues.
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {step === 'done' && commitResult ? (
            <div className="mt-5 rounded-xl border bg-green-50 p-4" data-testid="panel-import-done">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="font-semibold text-green-900">Import committed</div>
                <span className="rounded-full bg-green-200 px-2 py-1 text-xs font-medium text-green-900" data-testid="badge-import-step-done">
                  done
                </span>
              </div>
              <div className="mt-2 grid gap-1 text-sm text-green-900">
                <div>Fetched: <span className="font-mono">{commitResult.fetched}</span></div>
                <div>Mapped events: <span className="font-mono">{commitResult.mapped}</span></div>
                <div>New events committed: <span className="font-mono">{commitResult.createdLedgerEvents}</span></div>
                <div>Duplicates skipped: <span className="font-mono">{commitResult.skippedDuplicates}</span></div>
                <div>Assets created: <span className="font-mono">{commitResult.createdAssets}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <a href="/transactions" className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white" data-testid="link-go-transactions">
                  View transactions
                </a>
                <a href="/portfolio" className="rounded-lg border px-3 py-2 text-sm" data-testid="link-go-portfolio">
                  View portfolio
                </a>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
