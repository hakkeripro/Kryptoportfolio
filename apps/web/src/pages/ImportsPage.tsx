import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, Upload } from 'lucide-react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import {
  clearCoinbaseIntegration,
  loadCoinbaseIntegration,
  saveCoinbaseIntegration,
} from '../integrations/coinbase/coinbaseVault';
import {
  fetchAllTransactions,
  fetchCoinbaseAccounts,
  fetchNewestTransactionsSince,
  bestEffortFxToBase,
  type CoinbaseCreds,
} from '../integrations/coinbase/coinbaseSync';
import type { CoinbaseAccount, CoinbaseTransaction } from '../integrations/coinbase/coinbaseApi';
import {
  buildCoinbaseImportPreview,
  commitCoinbaseImport,
  computeCoinbaseDedupe,
  type CoinbaseImportOverrides,
  type CoinbaseImportPreview,
} from '../integrations/coinbase/coinbaseImport';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import type { ImportIssue } from '@kp/core';
import { useDbQuery } from '../hooks/useDbQuery';
import { Button, Card } from '../components/ui';
import { motion } from 'framer-motion';
import { pageTransition } from '../lib/animations';

function CoinbaseLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className="text-blue-500">
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M14.5 8.5a4.5 4.5 0 1 0 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type Step = 'connect' | 'fetch' | 'preview' | 'done';

export default function ImportsPage() {
  const { t } = useTranslation();
  const passphrase = useVaultStore((s) => s.passphrase);
  const token = useAuthStore((s) => s.token);
  const apiBase = useAuthStore((s) => s.apiBase);

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

  const [fxRatesToBase, setFxRatesToBase] = useState<Record<string, string>>({});
  const [feeValueBaseByRefKey, setFeeValueBaseByRefKey] = useState<Record<string, string>>({});
  const [tradeValuationBaseByTradeKey, setTradeValuationBaseByTradeKey] = useState<
    Record<string, string>
  >({});
  const [rewardFmvTotalBaseByTxId, setRewardFmvTotalBaseByTxId] = useState<Record<string, string>>(
    {},
  );

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
    null,
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

  const baseCurrency = useMemo(
    () => (preview?.baseCurrency ?? 'EUR').toUpperCase(),
    [preview?.baseCurrency],
  );

  function tryExtractJsonKey(input: string): { keyName?: string; privateKeyPem?: string } | null {
    const t = input.trim();
    if (!(t.startsWith('{') && t.endsWith('}'))) return null;
    try {
      const obj = JSON.parse(t) as Record<string, unknown>;
      const name =
        typeof obj.name === 'string'
          ? obj.name
          : typeof obj.keyName === 'string'
            ? obj.keyName
            : undefined;
      const pem =
        typeof obj.privateKey === 'string'
          ? obj.privateKey
          : typeof obj.private_key === 'string'
            ? obj.private_key
            : typeof obj.key_secret === 'string'
              ? obj.key_secret
              : typeof obj.api_secret === 'string'
                ? obj.api_secret
                : undefined;
      if (name || pem) return { keyName: name, privateKeyPem: pem };
      return null;
    } catch {
      return null;
    }
  }

  function handlePrivateKeyChange(value: string) {
    const extracted = tryExtractJsonKey(value);
    if (extracted) {
      if (extracted.keyName) setKeyName(extracted.keyName);
      if (extracted.privateKeyPem) setPrivateKeyPem(extracted.privateKeyPem.replace(/\\n/g, '\n'));
    } else {
      setPrivateKeyPem(value);
    }
  }

  async function connect() {
    if (!passphrase) {
      setErr(t('imports.error.vaultLocked'));
      return;
    }
    if (!token) {
      setErr(t('imports.error.notAuthenticated'));
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
      await saveCoinbaseIntegration(passphrase, {
        ...cfg,
        credentials: creds,
        settings: { ...cfg.settings, autoCommit, autoSync },
      });
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
      await clearCoinbaseIntegration();
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
          : await fetchNewestTransactionsSince(
              apiBase,
              token,
              creds,
              accs,
              cfg.settings.lastSeenTxIdByAccount,
            );
      setItems(fetched);
      const fxAuto = await buildFxRatesToBaseAuto(fetched, base);
      const overrides: CoinbaseImportOverrides = {
        fxRatesToBase: { ...fxAuto, ...fxRatesToBase },
        feeValueBaseByRefKey,
        tradeValuationBaseByTradeKey,
        rewardFmvTotalBaseByTxId,
      };
      const p0 = buildCoinbaseImportPreview({
        items: fetched,
        baseCurrency: base,
        settings,
        overrides,
      });
      const p = await computeCoinbaseDedupe(p0);
      setPreview(p);
      setStep('preview');
      if (autoCommit) {
        if (p.issues.length) {
          setErr(t('imports.error.resolveIssues'));
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

  async function doCommit(
    p: CoinbaseImportPreview,
    accs: CoinbaseAccount[],
    fetched: { accountId: string; tx: CoinbaseTransaction }[],
  ) {
    if (!passphrase) return;
    setErr(null);
    setLoading('Committing…');
    try {
      const r = await commitCoinbaseImport(p);
      await rebuildDerivedCaches({ daysBack: 365 });
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
      setCommitResult({
        ...r,
        fetched: fetched.length,
        mapped: p.events.length,
        newEvents: p.newEvents.length,
      });
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
        rewardFmvTotalBaseByTxId,
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
      if (i.type === 'SWAP_VALUATION_MISSING')
        swap.set(i.tradeKey, [...(swap.get(i.tradeKey) ?? []), i]);
      if (i.type === 'REWARD_FMV_MISSING') reward.set(i.txId, [...(reward.get(i.txId) ?? []), i]);
    }
    return { fx, fee, swap, reward };
  }, [preview?.issues]);

  const canCommit = !!preview && preview.issues.length === 0 && preview.newEvents.length > 0;

  const stepIdx = step === 'connect' ? 0 : step === 'fetch' ? 1 : step === 'preview' ? 1 : 2;
  const stepLabels = ['Select Source', 'Preview', 'Confirm'];
  const inputCls =
    'w-full rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary focus:outline-none focus:border-brand/50 transition-colors';

  return (
    <motion.div className="space-y-section" {...pageTransition}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-1 font-heading text-content-primary">Import Transactions</h1>
          <p className="text-caption text-content-tertiary mt-0.5">{t('imports.description')}</p>
        </div>
        <div className="text-caption text-content-tertiary">
          Step {stepIdx + 1} of {stepLabels.length}
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-3">
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                i < stepIdx
                  ? 'bg-brand/20 text-semantic-success'
                  : i === stepIdx
                    ? 'bg-brand text-white'
                    : 'bg-surface-raised text-content-tertiary'
              }`}
            >
              {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
            </div>
            <span
              className={`text-caption ${i === stepIdx ? 'text-content-primary font-medium' : 'text-content-tertiary'}`}
            >
              {label}
            </span>
            {i < stepLabels.length - 1 && (
              <ArrowRight className="h-3 w-3 text-content-tertiary mx-1" />
            )}
          </div>
        ))}
      </div>

      {err && (
        <div
          className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error"
          data-testid="alert-import-error"
        >
          {err}
        </div>
      )}

      {/* Exchange cards */}
      <div className="grid gap-4 md:grid-cols-2" data-testid="list-import-sources">
        {/* Coinbase card */}
        <div
          className={`rounded-xl border-2 p-5 transition-colors cursor-pointer ${
            connected
              ? 'border-brand bg-brand/5'
              : 'border-border bg-surface-raised hover:border-brand/50'
          }`}
          data-testid="card-import-coinbase"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <CoinbaseLogo />
              <div>
                <div className="text-body font-medium text-content-primary">
                  {t('imports.coinbase.title')}
                </div>
                <div className="text-caption text-content-tertiary">
                  {t('imports.coinbase.subtitle')}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {connected && (
                <div className="w-6 h-6 rounded-full bg-semantic-success flex items-center justify-center">
                  <Check className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              {connected && (
                <button
                  className="rounded-button border border-border px-3 py-1.5 text-caption text-content-secondary hover:bg-surface-overlay transition-colors"
                  onClick={() => void disconnect()}
                  disabled={!!loading}
                  data-testid="btn-coinbase-disconnect"
                >
                  {t('imports.btn.disconnect')}
                </button>
              )}
            </div>
          </div>

          {/* Connect form */}
          {!connected && (
            <div className="mt-4 space-y-3">
              <label className="block">
                <div className="text-caption text-content-secondary mb-1">
                  {t('imports.form.keyName')}
                </div>
                <input
                  className={inputCls}
                  value={keyName}
                  onChange={(e) => setKeyName(e.target.value)}
                  placeholder={t('imports.form.keyNamePlaceholder')}
                  disabled={!!loading}
                  data-testid="form-coinbase-keyname"
                />
              </label>
              <label className="block">
                <div className="text-caption text-content-secondary mb-1">
                  {t('imports.form.privateKey')}
                </div>
                <textarea
                  className={`${inputCls} h-24 font-mono text-caption`}
                  value={privateKeyPem}
                  onChange={(e) => handlePrivateKeyChange(e.target.value)}
                  placeholder={t('imports.form.privateKeyPlaceholder')}
                  disabled={!!loading}
                  data-testid="form-coinbase-privatekey"
                />
              </label>
              <Button
                variant="default"
                size="sm"
                onClick={() => void connect()}
                disabled={
                  !!loading || !passphrase || !token || !keyName.trim() || !privateKeyPem.trim()
                }
                data-testid="btn-coinbase-connect"
              >
                {loading ? loading : t('imports.btn.connect')}
              </Button>
            </div>
          )}

          {/* Connected badge */}
          {connected && (
            <div
              className="mt-3 rounded-button bg-semantic-success/10 px-3 py-2 text-caption text-semantic-success font-medium"
              data-testid="badge-coinbase-connected"
            >
              {t('imports.badge.connected')}
            </div>
          )}
        </div>

        {/* CSV upload area (placeholder from design) */}
        <div className="rounded-xl border-2 border-dashed border-border bg-surface-raised p-5 flex flex-col items-center justify-center gap-3">
          <div className="w-12 h-12 rounded-full bg-surface-overlay flex items-center justify-center">
            <Upload className="h-6 w-6 text-content-tertiary" />
          </div>
          <div className="text-caption text-content-secondary text-center">
            Drop & drop your CSV file here
          </div>
          <button className="rounded-button border border-border px-4 py-2 text-caption text-content-secondary hover:bg-surface-overlay transition-colors">
            Browse Files
          </button>
          <div className="text-[0.625rem] text-content-tertiary">
            Supported: Coinbase, Bybit/okx CSV files. Import XLSX.
          </div>
        </div>
      </div>

      {/* Fetch controls */}
      {connected && (
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <label
                className="flex items-center gap-2 text-caption text-content-secondary cursor-pointer"
                data-testid="toggle-import-autocommit"
              >
                <input
                  type="checkbox"
                  checked={autoCommit}
                  onChange={(e) => setAutoCommit(e.target.checked)}
                  disabled={!!loading}
                  className="accent-brand"
                />
                {t('imports.toggle.autoCommit')}
              </label>
              <label
                className="flex items-center gap-2 text-caption text-content-secondary cursor-pointer"
                data-testid="toggle-import-autosync"
              >
                <input
                  type="checkbox"
                  checked={autoSync}
                  onChange={(e) => setAutoSync(e.target.checked)}
                  disabled={!!loading}
                  className="accent-brand"
                />
                {t('imports.toggle.autoSync')}
              </label>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void runFetch('newest')}
                disabled={!!loading || !connected}
                data-testid="btn-import-run"
              >
                {t('imports.btn.fetchNewest')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => void runFetch('all')}
                disabled={!!loading || !connected}
                data-testid="btn-import-run-all"
              >
                {loading?.includes('Fetch') ? loading : t('imports.btn.fetchAll')}
              </Button>
            </div>
          </div>

          {/* Auto-sync status */}
          <div
            className="mt-3 rounded-button border border-border bg-surface-base p-3 text-caption"
            data-testid="box-coinbase-autosync-status"
          >
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">{t('imports.autosync.status')}</span>
                <span
                  className="font-mono text-content-primary"
                  data-testid="badge-coinbase-autosync-inflight"
                >
                  {cbStatus.data?.inFlight
                    ? t('imports.autosync.running')
                    : t('imports.autosync.idle')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">{t('imports.autosync.lastRun')}</span>
                <span className="font-mono text-content-primary">
                  {cbStatus.data?.lastRunISO
                    ? new Date(cbStatus.data.lastRunISO).toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">{t('imports.autosync.lastCommit')}</span>
                <span className="font-mono text-content-primary">
                  {cbStatus.data?.lastCommitISO
                    ? new Date(cbStatus.data.lastCommitISO).toLocaleString()
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-content-secondary">
                  {t('imports.autosync.fetchedLastTime')}
                </span>
                <span className="font-mono text-content-primary">
                  {typeof cbStatus.data?.lastFetchedCount === 'number'
                    ? cbStatus.data.lastFetchedCount
                    : '—'}
                </span>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <button
                className="text-caption text-content-secondary hover:text-content-primary transition-colors"
                onClick={() => window.dispatchEvent(new Event('kp_coinbase_autosync_run_now'))}
                disabled={!connected || !!cbStatus.data?.inFlight}
                data-testid="btn-coinbase-autosync-run-now"
              >
                {t('imports.btn.runNow')}
              </button>
              <span
                className="text-[0.625rem] text-content-tertiary"
                data-testid="text-coinbase-autosync-duration"
              >
                {typeof cbStatus.data?.lastDurationMs === 'number'
                  ? `${cbStatus.data.lastDurationMs}ms`
                  : ''}
              </span>
            </div>
            {cbStatus.data?.consecutiveFailures ? (
              <div
                className="mt-2 rounded-button bg-brand/10 px-2 py-1 text-caption text-brand"
                data-testid="badge-coinbase-autosync-backoff"
              >
                {t('imports.autosync.backoff', { n: cbStatus.data.consecutiveFailures })}
                {cbStatus.data.lastError ? ` — ${cbStatus.data.lastError}` : ''}
              </div>
            ) : cbStatus.data?.lastError ? (
              <div
                className="mt-2 rounded-button bg-brand/10 px-2 py-1 text-caption text-brand"
                data-testid="badge-coinbase-autosync-info"
              >
                {String(cbStatus.data.lastError)}
              </div>
            ) : null}
          </div>

          {/* Cursors */}
          <details className="mt-2 text-caption">
            <summary className="cursor-pointer select-none text-content-tertiary hover:text-content-secondary transition-colors">
              {t('imports.autosync.cursors')}
            </summary>
            <div
              className="mt-1 rounded-button bg-surface-base border border-border p-2 font-mono text-[0.625rem] text-content-tertiary"
              data-testid="box-cb-cursors"
            >
              {Object.keys(lastSeenByAccount).length
                ? JSON.stringify(lastSeenByAccount, null, 2)
                : '—'}
            </div>
          </details>
        </Card>
      )}

      {/* Preview + Issues */}
      {preview && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="panel-import-preview">
            <div className="flex items-center justify-between mb-3">
              <div className="text-body font-medium text-content-primary">
                {t('imports.panel.preview')}
              </div>
              <div className="text-caption text-content-tertiary">
                {t('imports.panel.previewSubtitle')}
              </div>
            </div>

            {/* Stats */}
            <div
              className="rounded-button border border-border bg-surface-base p-3 text-caption mb-3"
              data-testid="box-import-stats"
            >
              {[
                [t('imports.preview.fetched'), items.length],
                [t('imports.preview.mappedEvents'), preview.events.length],
                [t('imports.preview.newEvents'), preview.newEvents.length],
                [t('imports.preview.duplicates'), preview.duplicateExternalRefs.length],
                [t('imports.preview.issues'), preview.issues.length],
              ].map(([label, count]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-content-secondary">{label}</span>
                  <span className="font-mono text-content-primary">{count}</span>
                </div>
              ))}
            </div>

            <div className="max-h-[420px] overflow-auto" data-testid="list-import-preview">
              {preview.events.length ? (
                <ul className="space-y-2">
                  {preview.events.slice(0, 200).map((e) => (
                    <li
                      key={e.id}
                      className="rounded-button border border-border-subtle bg-surface-base p-2"
                      data-testid={`row-import-preview-${e.id}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-caption font-medium text-content-primary">
                          {e.type} {e.amount}{' '}
                          {String(e.assetId)
                            .replace(/^asset_/, '')
                            .toUpperCase()}
                        </div>
                        {e.externalRef && preview.duplicateExternalRefs.includes(e.externalRef) ? (
                          <span
                            className="rounded-full bg-surface-overlay text-content-tertiary px-2 py-0.5 text-[0.625rem]"
                            data-testid={`badge-import-dup-${e.id}`}
                          >
                            {t('imports.badge.dup')}
                          </span>
                        ) : (
                          <span className="rounded-full bg-semantic-success/10 text-semantic-success px-2 py-0.5 text-[0.625rem]">
                            {t('imports.badge.new')}
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[0.625rem] text-content-tertiary">
                        {new Date(e.timestampISO).toLocaleString()} — {e.externalRef}
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="text-caption text-content-tertiary">
                  {t('imports.preview.noMappedEvents')}
                </div>
              )}
              {preview.events.length > 200 && (
                <div className="mt-3 text-[0.625rem] text-content-tertiary">
                  {t('imports.preview.truncated')}
                </div>
              )}
            </div>

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => void rebuildPreview()}
                disabled={!!loading || !preview}
                data-testid="btn-import-rebuild-preview"
              >
                {t('imports.btn.rebuildPreview')}
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={() => void doCommit(preview!, accounts, items)}
                disabled={!!loading || !connected || !canCommit}
                data-testid="btn-import-commit"
              >
                {loading === 'Committing…' ? loading : t('imports.btn.commit')}
              </Button>
            </div>

            {!canCommit && preview && (
              <div className="mt-2 text-[0.625rem] text-content-tertiary">
                {preview.issues.length
                  ? t('imports.preview.resolveIssues')
                  : preview.newEvents.length
                    ? t('imports.preview.ready')
                    : t('imports.preview.nothingNew')}
              </div>
            )}
          </Card>

          <Card data-testid="panel-import-issues">
            <div className="flex items-center justify-between mb-3">
              <div className="text-body font-medium text-content-primary">
                {t('imports.panel.issues')}
              </div>
              <div className="text-caption text-content-tertiary">
                {t('imports.panel.issuesSubtitle')} {baseCurrency}
              </div>
            </div>

            {preview.issues.length ? (
              <div className="space-y-4" data-testid="list-import-issues">
                {issueGroups.fx.size > 0 && (
                  <div className="rounded-button border border-brand/30 bg-brand/5 p-3">
                    <div className="text-caption font-medium text-content-primary mb-2">
                      {t('imports.issues.fxMissing')}
                    </div>
                    <div className="space-y-2">
                      {Array.from(issueGroups.fx.entries()).map(([cur, arr]) => (
                        <div
                          key={cur}
                          className="flex items-center gap-2"
                          data-testid={`row-import-issue-fx-${cur}`}
                        >
                          <div className="w-16 text-caption font-mono text-content-primary">
                            {cur}
                          </div>
                          <input
                            className={`${inputCls} flex-1`}
                            placeholder={`1 ${cur} = ? ${baseCurrency}`}
                            value={fxRatesToBase[cur] ?? ''}
                            onChange={(e) =>
                              setFxRatesToBase((m) => ({ ...m, [cur]: e.target.value }))
                            }
                            data-testid={`input-import-fx-${cur}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {issueGroups.fee.size > 0 && (
                  <div className="rounded-button border border-brand/30 bg-brand/5 p-3">
                    <div className="text-caption font-medium text-content-primary mb-2">
                      {t('imports.issues.feeMissing')}
                    </div>
                    <div className="space-y-2">
                      {Array.from(issueGroups.fee.entries()).map(([refKey, arr]) => {
                        const i = arr[0] as any;
                        return (
                          <div
                            key={refKey}
                            className="flex items-center gap-2"
                            data-testid={`row-import-issue-fee-${refKey}`}
                          >
                            <div className="w-24 text-[0.625rem] font-mono text-content-tertiary truncate">
                              {refKey}
                            </div>
                            <div className="w-20 text-[0.625rem] text-content-secondary">
                              {i.feeAmount} {i.feeCurrency}
                            </div>
                            <input
                              className={`${inputCls} flex-1`}
                              placeholder={`Fee value in ${baseCurrency}`}
                              value={feeValueBaseByRefKey[refKey] ?? ''}
                              onChange={(e) =>
                                setFeeValueBaseByRefKey((m) => ({ ...m, [refKey]: e.target.value }))
                              }
                              data-testid={`input-import-feevalue-${refKey}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {issueGroups.swap.size > 0 && (
                  <div className="rounded-button border border-brand/30 bg-brand/5 p-3">
                    <div className="text-caption font-medium text-content-primary mb-2">
                      {t('imports.issues.swapMissing')}
                    </div>
                    <div className="space-y-2">
                      {Array.from(issueGroups.swap.entries()).map(([tradeKey, arr]) => (
                        <div
                          key={tradeKey}
                          className="flex items-center gap-2"
                          data-testid={`row-import-issue-swap-${tradeKey}`}
                        >
                          <div className="w-24 text-[0.625rem] font-mono text-content-tertiary truncate">
                            {tradeKey}
                          </div>
                          <input
                            className={`${inputCls} flex-1`}
                            placeholder={`Valuation in ${baseCurrency}`}
                            value={tradeValuationBaseByTradeKey[tradeKey] ?? ''}
                            onChange={(e) =>
                              setTradeValuationBaseByTradeKey((m) => ({
                                ...m,
                                [tradeKey]: e.target.value,
                              }))
                            }
                            data-testid={`input-import-swapvalue-${tradeKey}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {issueGroups.reward.size > 0 && (
                  <div className="rounded-button border border-brand/30 bg-brand/5 p-3">
                    <div className="text-caption font-medium text-content-primary mb-2">
                      {t('imports.issues.rewardMissing')}
                    </div>
                    <div className="space-y-2">
                      {Array.from(issueGroups.reward.entries()).map(([txId, arr]) => (
                        <div
                          key={txId}
                          className="flex items-center gap-2"
                          data-testid={`row-import-issue-reward-${txId}`}
                        >
                          <div className="w-24 text-[0.625rem] font-mono text-content-tertiary truncate">
                            {txId}
                          </div>
                          <div className="w-20 text-[0.625rem] text-content-secondary">
                            {(arr[0] as any).amount} {(arr[0] as any).currency}
                          </div>
                          <input
                            className={`${inputCls} flex-1`}
                            placeholder={`FMV total in ${baseCurrency}`}
                            value={rewardFmvTotalBaseByTxId[txId] ?? ''}
                            onChange={(e) =>
                              setRewardFmvTotalBaseByTxId((m) => ({ ...m, [txId]: e.target.value }))
                            }
                            data-testid={`input-import-rewardfmv-${txId}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="text-[0.625rem] text-content-tertiary">
                  {t('imports.issues.rebuildHint')}
                </div>
              </div>
            ) : (
              <div
                className="rounded-button bg-semantic-success/10 p-3 text-caption text-semantic-success"
                data-testid="badge-import-noissues"
              >
                {t('imports.issues.noIssues')}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Done panel */}
      {step === 'done' && commitResult && (
        <Card data-testid="panel-import-done">
          <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
            <div className="text-body font-medium text-semantic-success">
              {t('imports.done.title')}
            </div>
            <span
              className="rounded-full bg-semantic-success/10 px-2 py-1 text-[0.625rem] font-medium text-semantic-success"
              data-testid="badge-import-step-done"
            >
              {t('imports.done.badge')}
            </span>
          </div>
          <div className="grid gap-1 text-caption text-content-primary">
            <div>
              {t('imports.done.fetched')} <span className="font-mono">{commitResult.fetched}</span>
            </div>
            <div>
              {t('imports.done.mappedEvents')}{' '}
              <span className="font-mono">{commitResult.mapped}</span>
            </div>
            <div>
              {t('imports.done.newEvents')}{' '}
              <span className="font-mono">{commitResult.createdLedgerEvents}</span>
            </div>
            <div>
              {t('imports.done.duplicates')}{' '}
              <span className="font-mono">{commitResult.skippedDuplicates}</span>
            </div>
            <div>
              {t('imports.done.assetsCreated')}{' '}
              <span className="font-mono">{commitResult.createdAssets}</span>
            </div>
          </div>
          <div className="mt-3 flex gap-2">
            <a
              href="/transactions"
              className="rounded-button bg-brand hover:bg-brand-dark px-3 py-2 text-caption font-medium text-white transition-colors"
              data-testid="link-go-transactions"
            >
              {t('imports.done.viewTransactions')}
            </a>
            <a
              href="/portfolio"
              className="rounded-button border border-border px-3 py-2 text-caption text-content-secondary hover:bg-surface-overlay transition-colors"
              data-testid="link-go-portfolio"
            >
              {t('imports.done.viewPortfolio')}
            </a>
          </div>
        </Card>
      )}
    </motion.div>
  );
}
