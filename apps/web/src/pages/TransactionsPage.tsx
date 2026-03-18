import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import Decimal from 'decimal.js';
import { Plus, Search, Download, X, Edit2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { LedgerEvent } from '@kp/core';
import { LedgerEvent as LedgerEventSchema } from '@kp/core';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from '../hooks/useDbQuery';
import { VirtualList } from '../components/VirtualList';
import {
  Button,
  Card,
  TokenIcon,
  Badge,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui';
import { pageTransition, fadeInUp, staggerContainer } from '../lib/animations';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  try {
    return new Decimal(s);
  } catch {
    return new Decimal(0);
  }
}

function fmt(s: string | undefined | null): string {
  if (!s) return '0';
  try {
    return new Decimal(s).toFixed();
  } catch {
    return String(s);
  }
}

function fmtMoney(val: string | undefined | null, currency: string): string {
  return `${d(val).toDecimalPlaces(2).toFixed()} ${currency}`;
}

const EVENT_TYPES: LedgerEvent['type'][] = [
  'BUY',
  'SELL',
  'SWAP',
  'TRANSFER',
  'REWARD',
  'STAKING_REWARD',
  'AIRDROP',
];

type FormState = {
  mode: 'create' | 'edit';
  targetId?: string;
  type: LedgerEvent['type'];
  timestampISO: string;
  assetId: string;
  amount: string;
  pricePerUnitBase: string;
  assetOutId: string;
  amountOut: string;
  valuationBase: string;
  feeBase: string;
  feeAssetId: string;
  feeAmount: string;
  feeValueBase: string;
  externalRef: string;
  notes: string;
};

function nowISO(): string {
  return new Date().toISOString();
}

function blankForm(baseCurrencyAssetId: string): FormState {
  return {
    mode: 'create',
    type: 'BUY',
    timestampISO: nowISO(),
    assetId: 'asset_btc',
    amount: '',
    pricePerUnitBase: '',
    assetOutId: 'asset_eth',
    amountOut: '',
    valuationBase: '',
    feeBase: '',
    feeAssetId: baseCurrencyAssetId,
    feeAmount: '',
    feeValueBase: '',
    externalRef: '',
    notes: '',
  };
}

function buildReplacementId(oldId: string): string {
  return `ev_replace_${oldId}_${Date.now()}`;
}

function typeBadgeColor(type: string): string {
  switch (type) {
    case 'BUY':
      return 'bg-semantic-success/10 text-semantic-success';
    case 'SELL':
      return 'bg-semantic-error/10 text-semantic-error';
    case 'SWAP':
      return 'bg-brand/10 text-brand';
    case 'TRANSFER':
      return 'bg-blue-500/10 text-blue-400';
    case 'REWARD':
    case 'STAKING_REWARD':
    case 'AIRDROP':
      return 'bg-purple-500/10 text-purple-400';
    default:
      return 'bg-surface-overlay text-content-secondary';
  }
}

export default function TransactionsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [issueFilter, setIssueFilter] = useState<
    'ALL' | 'ISSUES' | 'MISSING_VALUE' | 'UNMATCHED_TRANSFER'
  >('ALL');

  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings =
        ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const baseCurrency = String(settings.baseCurrency ?? 'EUR').toUpperCase();
      const baseCurrencyAssetId = `asset_${baseCurrency.toLowerCase()}`;
      const assets = await db.assets.toArray();
      const accounts = await db.accounts.toArray();
      const events = await db.ledgerEvents.orderBy('timestampISO').reverse().toArray();
      const replacedBy = new Map<string, string>();
      const latest: Record<string, { id: string; key: string }> = {};
      for (const e of events) {
        const r = String((e as any).replacesEventId ?? '');
        if (!r) continue;
        const key = `${String((e as any).updatedAtISO ?? (e as any).createdAtISO ?? '')}:${String(e.id)}`;
        const prev = latest[r];
        if (!prev || key > prev.key) latest[r] = { id: String(e.id), key };
      }
      for (const [target, info] of Object.entries(latest)) {
        replacedBy.set(target, info.id);
      }
      return { settings, baseCurrency, baseCurrencyAssetId, assets, accounts, events, replacedBy };
    },
    [],
    {
      settings: null as any,
      baseCurrency: 'EUR',
      baseCurrencyAssetId: 'asset_eur',
      assets: [] as any[],
      accounts: [] as any[],
      events: [] as any[],
      replacedBy: new Map<string, string>(),
    },
  );

  const baseCurrency = dbState.data.baseCurrency;
  const assetsById = useMemo(
    () => new Map(dbState.data.assets.map((a: any) => [a.id, a])),
    [dbState.data.assets],
  );
  const accountsById = useMemo(
    () => new Map(dbState.data.accounts.map((a: any) => [a.id, a])),
    [dbState.data.accounts],
  );

  const [form, setForm] = useState<FormState>(() => blankForm(dbState.data.baseCurrencyAssetId));
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function openEdit(e: any) {
    setMsg(null);
    const t = (e.type as LedgerEvent['type']) ?? 'BUY';
    setForm({
      mode: 'edit',
      targetId: e.id,
      type: t,
      timestampISO: e.timestampISO ?? nowISO(),
      assetId: e.assetId ?? '',
      amount: fmt(e.amount),
      pricePerUnitBase: fmt(e.pricePerUnitBase),
      assetOutId: (e as any).assetOutId ?? '',
      amountOut: fmt((e as any).amountOut),
      valuationBase: fmt((e as any).valuationBase),
      feeBase: fmt((e as any).feeBase),
      feeAssetId: (e as any).feeAssetId ?? dbState.data.baseCurrencyAssetId,
      feeAmount: fmt((e as any).feeAmount),
      feeValueBase: fmt((e as any).feeValueBase),
      externalRef: (e as any).externalRef ?? '',
      notes: (e as any).notes ?? '',
    });
    setShowForm(true);
  }

  function resetForm() {
    setForm(blankForm(dbState.data.baseCurrencyAssetId));
    setShowForm(false);
  }

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const now = new Date().toISOString();
      const base: any = {
        id:
          form.mode === 'edit' && form.targetId
            ? buildReplacementId(form.targetId)
            : `ev_manual_${Date.now()}`,
        schemaVersion: 1,
        createdAtISO: now,
        updatedAtISO: now,
        timestampISO: new Date(form.timestampISO).toISOString(),
        type: form.type,
        accountId: 'acct_manual',
        assetId: form.assetId,
        amount: form.amount.trim() || '0',
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        ...(form.externalRef.trim() ? { externalRef: form.externalRef.trim() } : {}),
      };
      if (dbState.data.accounts.some((a: any) => a.id === 'acct_coinbase'))
        base.accountId = 'acct_coinbase';
      if (form.type === 'BUY' || form.type === 'SELL')
        base.pricePerUnitBase = form.pricePerUnitBase.trim() || '0';
      if (form.type === 'SWAP') {
        base.assetOutId = form.assetOutId;
        base.amountOut = form.amountOut.trim() || '0';
        if (form.valuationBase.trim()) base.valuationBase = form.valuationBase.trim();
      }
      if (form.feeBase.trim()) base.feeBase = form.feeBase.trim();
      if (
        form.feeAssetId &&
        form.feeAssetId !== dbState.data.baseCurrencyAssetId &&
        form.feeAmount.trim()
      ) {
        base.feeAssetId = form.feeAssetId;
        base.feeAmount = form.feeAmount.trim();
        if (form.feeValueBase.trim()) base.feeValueBase = form.feeValueBase.trim();
      }
      LedgerEventSchema.parse(base);
      await db.transaction('rw', db.ledgerEvents, async () => {
        if (form.mode === 'edit' && form.targetId) {
          await db.ledgerEvents.add({ ...base, replacesEventId: form.targetId } as any);
        } else {
          await db.ledgerEvents.add(base as any);
        }
      });
      await rebuildDerivedCaches({ daysBack: 365 });
      setMsg(
        form.mode === 'edit'
          ? t('transactions.msg.savedReplacement')
          : t('transactions.msg.addedEvent'),
      );
      resetForm();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  async function deleteEventAppendOnly(e: any) {
    setSaving(true);
    setMsg(null);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const now = new Date().toISOString();
      const tomb: any = {
        ...e,
        id: buildReplacementId(String(e.id)) + '_del',
        schemaVersion: 1,
        createdAtISO: now,
        updatedAtISO: now,
        timestampISO: now,
        isDeleted: true,
        replacesEventId: String(e.id),
        notes: e.notes ? `${String(e.notes)} (deleted)` : 'deleted',
      };
      const parsed = LedgerEventSchema.parse(tomb);
      await db.ledgerEvents.add(parsed as any);
      await rebuildDerivedCaches({ daysBack: 365 });
      setMsg(t('transactions.msg.deleted'));
    } catch (err) {
      setMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  const eventsView = useMemo(() => {
    const byId = assetsById;
    return dbState.data.events.map((e: any) => ({
      ...e,
      assetSym: byId.get(e.assetId)?.symbol ?? e.assetId,
      accountName: accountsById.get(e.accountId)?.name ?? e.accountId,
    }));
  }, [dbState.data.events, assetsById, accountsById]);

  function isMissingValue(e: any): boolean {
    return (
      (e.type === 'REWARD' || e.type === 'STAKING_REWARD' || e.type === 'AIRDROP') &&
      !e.fmvTotalBase &&
      !e.fmvPerUnitBase
    );
  }

  function isUnmatchedTransfer(e: any): boolean {
    // V1 heuristic: negative TRANSFER amount (outgoing) without a match flag
    return e.type === 'TRANSFER' && Number(e.amount) < 0;
  }

  const filteredEvents = useMemo(() => {
    let list = eventsView;
    if (typeFilter !== 'ALL') list = list.filter((e: any) => e.type === typeFilter);
    if (issueFilter === 'ISSUES') {
      list = list.filter((e: any) => isMissingValue(e) || isUnmatchedTransfer(e));
    } else if (issueFilter === 'MISSING_VALUE') {
      list = list.filter((e: any) => isMissingValue(e));
    } else if (issueFilter === 'UNMATCHED_TRANSFER') {
      list = list.filter((e: any) => isUnmatchedTransfer(e));
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (e: any) =>
          e.assetSym.toLowerCase().includes(q) ||
          e.type.toLowerCase().includes(q) ||
          (e.notes ?? '').toLowerCase().includes(q),
      );
    }
    return list;
  }, [eventsView, typeFilter, issueFilter, searchQuery]);

  const selectedEvent = useMemo(() => {
    if (!detailsId) return null;
    return eventsView.find((e: any) => String(e.id) === String(detailsId)) ?? null;
  }, [detailsId, eventsView]);

  const inputCls =
    'w-full rounded-input bg-surface-base border border-border px-3 py-2 text-body focus:outline-none focus:border-brand/50 transition-colors';
  const labelCls = 'block text-caption text-content-secondary mb-1';

  return (
    <motion.div className="space-y-section" {...pageTransition}>
      {/* Header */}
      <motion.div
        className="flex items-start justify-between"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div>
          <h1 className="text-heading-1 font-heading text-content-primary">
            {t('transactions.title')}
          </h1>
          <p className="text-caption text-content-tertiary mt-0.5">
            {eventsView.length}{' '}
            {t('transactions.ledger.count', { n: eventsView.length }).replace(/^\d+ /, '')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" data-testid="btn-export-csv">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export CSV
          </Button>
          <Button variant="default" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> {t('dashboard.btn.addTransaction')}
          </Button>
        </div>
      </motion.div>

      {/* Search + filters */}
      <motion.div
        className="flex items-center gap-3 flex-wrap"
        variants={fadeInUp}
        initial="hidden"
        animate="show"
      >
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-content-tertiary pointer-events-none" />
          <Input
            type="text"
            placeholder={t('dashboard.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary
            focus:outline-none focus:border-brand/40 transition-colors h-9"
        >
          <option value="ALL">All Types</option>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Issue filter buttons */}
        <div
          data-testid="issue-filter-buttons"
          className="flex items-center gap-1 rounded-input border border-border bg-surface-base px-1 h-9"
        >
          {(
            [
              { id: 'ALL', label: 'All' },
              { id: 'ISSUES', label: '⚠ Issues' },
              { id: 'MISSING_VALUE', label: 'Missing value' },
              { id: 'UNMATCHED_TRANSFER', label: 'Unmatched transfer' },
            ] as const
          ).map((f) => (
            <button
              key={f.id}
              data-testid={`filter-issue-${f.id.toLowerCase().replace('_', '-')}`}
              onClick={() => setIssueFilter(f.id)}
              className={`px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
                issueFilter === f.id
                  ? 'bg-[#FF8400]/20 text-[#FF8400]'
                  : 'text-content-tertiary hover:text-content-secondary'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </motion.div>

      <AnimatePresence>
        {msg && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            className={`rounded-button border p-3 text-caption ${
              msg.includes('error') || msg.includes('Invalid')
                ? 'border-semantic-error/30 bg-semantic-error/5 text-semantic-error'
                : 'border-border bg-surface-raised text-content-primary'
            }`}
            data-testid="alert-tx-message"
          >
            {msg}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit form (collapsible) */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
          >
            <Card data-testid="panel-event-form" className="p-5">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div className="text-body font-semibold text-content-primary">
                  {form.mode === 'edit'
                    ? t('transactions.form.editTitle', { id: form.targetId })
                    : t('transactions.form.addTitle')}
                </div>
                {form.mode === 'edit' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetForm}
                    disabled={saving}
                    data-testid="btn-cancel-edit"
                  >
                    {t('common.cancel')}
                  </Button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <label className="block">
                  <div className={labelCls}>{t('transactions.form.type')}</div>
                  <select
                    data-testid="form-event-type"
                    className={inputCls}
                    value={form.type}
                    onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as any }))}
                    disabled={saving}
                  >
                    {EVENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className={labelCls}>{t('transactions.form.asset')}</div>
                  <select
                    data-testid="form-event-asset"
                    className={inputCls}
                    value={form.assetId}
                    onChange={(e) => setForm((f) => ({ ...f, assetId: e.target.value }))}
                    disabled={saving}
                  >
                    {dbState.data.assets.map((a: any) => (
                      <option key={a.id} value={a.id}>
                        {a.symbol}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <div className={labelCls}>{t('transactions.form.timestamp')}</div>
                  <input
                    className={inputCls}
                    value={form.timestampISO}
                    onChange={(e) => setForm((f) => ({ ...f, timestampISO: e.target.value }))}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>{t('transactions.form.amount')}</div>
                  <input
                    data-testid="form-event-amount"
                    className={`${inputCls} font-mono`}
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                    disabled={saving}
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>
                    {t('transactions.form.pricePerUnit', { currency: baseCurrency })}
                  </div>
                  <input
                    data-testid="form-event-price"
                    className={`${inputCls} font-mono`}
                    value={form.pricePerUnitBase}
                    onChange={(e) => setForm((f) => ({ ...f, pricePerUnitBase: e.target.value }))}
                    disabled={saving || (form.type !== 'BUY' && form.type !== 'SELL')}
                  />
                </label>
                <label className="block">
                  <div className={labelCls}>
                    {t('transactions.form.fee', { currency: baseCurrency })}
                  </div>
                  <input
                    data-testid="form-event-fee"
                    className={`${inputCls} font-mono`}
                    value={form.feeBase}
                    onChange={(e) => setForm((f) => ({ ...f, feeBase: e.target.value }))}
                    disabled={saving}
                  />
                </label>
                {form.type === 'SWAP' && (
                  <>
                    <label className="block">
                      <div className={labelCls}>{t('transactions.form.assetOut')}</div>
                      <select
                        className={inputCls}
                        value={form.assetOutId}
                        onChange={(e) => setForm((f) => ({ ...f, assetOutId: e.target.value }))}
                        disabled={saving}
                      >
                        {dbState.data.assets.map((a: any) => (
                          <option key={a.id} value={a.id}>
                            {a.symbol}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block">
                      <div className={labelCls}>{t('transactions.form.amountOut')}</div>
                      <input
                        className={`${inputCls} font-mono`}
                        value={form.amountOut}
                        onChange={(e) => setForm((f) => ({ ...f, amountOut: e.target.value }))}
                        disabled={saving}
                      />
                    </label>
                    <label className="block">
                      <div className={labelCls}>
                        {t('transactions.form.valuationTotal', { currency: baseCurrency })}
                      </div>
                      <input
                        className={`${inputCls} font-mono`}
                        value={form.valuationBase}
                        onChange={(e) => setForm((f) => ({ ...f, valuationBase: e.target.value }))}
                        disabled={saving}
                      />
                    </label>
                  </>
                )}
                <label className="block md:col-span-2">
                  <div className={labelCls}>{t('transactions.form.externalRef')}</div>
                  <input
                    className={inputCls}
                    value={form.externalRef}
                    onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))}
                    disabled={saving}
                  />
                </label>
                <label className="block md:col-span-3">
                  <div className={labelCls}>{t('transactions.form.notes')}</div>
                  <input
                    className={inputCls}
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                    disabled={saving}
                  />
                </label>
              </div>

              <div className="mt-4 flex gap-2">
                <Button
                  variant="default"
                  size="sm"
                  data-testid="btn-submit-event"
                  onClick={() => void submit()}
                  disabled={saving}
                >
                  {saving
                    ? '...'
                    : form.mode === 'edit'
                      ? t('transactions.btn.saveReplacement')
                      : t('transactions.btn.addEvent')}
                </Button>
                <Button variant="outline" size="sm" onClick={resetForm} disabled={saving}>
                  {t('common.reset')}
                </Button>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transactions table */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <Card data-testid="panel-ledger" className="p-0 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
            <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              // {t('transactions.ledger.title')}
            </span>
            <div className="text-[11px] font-mono text-white/20">
              {filteredEvents.length} events
            </div>
          </div>

          {/* Table header */}
          <div className="grid grid-cols-[1.5fr_0.7fr_1.2fr_1fr_1fr_1fr] gap-2 px-5 py-2.5 border-b border-white/[0.04]">
            {['Date', 'Type', 'Asset', 'Amount', 'Price', 'Total'].map((h) => (
              <span
                key={h}
                className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20"
              >
                {h}
              </span>
            ))}
          </div>

          <div data-testid="list-ledger">
            {filteredEvents.length ? (
              <VirtualList
                items={filteredEvents as any[]}
                itemHeight={52}
                height={620}
                className="overflow-auto"
                getKey={(e: any) => String(e.id)}
                renderItem={(e: any) => {
                  const replacedBy = dbState.data.replacedBy.get(String(e.id));
                  const total =
                    e.type === 'BUY' || e.type === 'SELL'
                      ? d(e.amount).mul(d(e.pricePerUnitBase))
                      : d(e.valuationBase ?? '0');
                  return (
                    <div
                      className="grid grid-cols-[1.5fr_0.7fr_1.2fr_1fr_1fr_1fr] gap-2 items-center py-3 px-5
                        border-b border-white/[0.04] hover:bg-[#FF8400]/[0.04] transition-colors cursor-pointer group"
                      data-testid={`row-ledger-${e.id}`}
                      onClick={() => setDetailsId(String(e.id))}
                    >
                      <div className="text-[13px] text-content-secondary font-mono truncate">
                        {new Date(e.timestampISO).toLocaleDateString()}
                      </div>
                      <div>
                        <span
                          className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${typeBadgeColor(e.type)}`}
                        >
                          {e.type}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <TokenIcon symbol={e.assetSym} size="sm" />
                        <span className="text-[13px] text-content-primary font-medium truncate">
                          {e.assetSym}
                        </span>
                        {e.isDeleted && (
                          <span
                            className="text-[10px] rounded bg-semantic-error/10 text-semantic-error px-1.5 py-0.5"
                            data-testid="badge-ledger-deleted"
                          >
                            {t('transactions.badge.deleted')}
                          </span>
                        )}
                        {replacedBy && (
                          <span
                            className="text-[10px] rounded bg-surface-overlay text-content-tertiary px-1.5 py-0.5"
                            data-testid="badge-ledger-replaced"
                          >
                            {t('transactions.badge.replaced')}
                          </span>
                        )}
                      </div>
                      <div className="text-[13px] font-mono text-content-secondary text-right truncate">
                        {d(e.amount).toDecimalPlaces(6).toFixed()}
                      </div>
                      <div className="text-[13px] font-mono text-content-secondary text-right truncate">
                        {e.pricePerUnitBase ? fmtMoney(e.pricePerUnitBase, baseCurrency) : '—'}
                      </div>
                      <div className="text-[13px] font-mono text-content-primary font-medium text-right truncate">
                        {total.gt(0) ? fmtMoney(total.toFixed(), baseCurrency) : '—'}
                      </div>
                    </div>
                  );
                }}
              />
            ) : (
              <div className="py-12 text-center text-caption text-content-tertiary">
                {t('transactions.ledger.empty')}
              </div>
            )}
          </div>
        </Card>
      </motion.div>

      {/* Event detail dialog */}
      <Dialog
        open={!!selectedEvent}
        onOpenChange={(open) => {
          if (!open) setDetailsId(null);
        }}
      >
        <DialogContent
          className="max-w-2xl bg-[#0F0F0F] border-white/[0.1]"
          data-testid="drawer-ledger-event"
        >
          {selectedEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="font-heading text-heading-2 flex items-center gap-3">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-medium ${typeBadgeColor(selectedEvent.type)}`}
                  >
                    {selectedEvent.type}
                  </span>
                  <span className="flex items-center gap-2">
                    <TokenIcon symbol={selectedEvent.assetSym} size="sm" />
                    {selectedEvent.assetSym}
                  </span>
                </DialogTitle>
                <p className="text-[11px] text-content-tertiary font-mono mt-0.5">
                  {selectedEvent.id}
                </p>
              </DialogHeader>

              <div className="grid gap-2.5 text-body mt-2">
                {[
                  [
                    t('transactions.detail.time'),
                    new Date(selectedEvent.timestampISO).toLocaleString(),
                  ],
                  [t('transactions.detail.account'), selectedEvent.accountName],
                  [
                    t('transactions.detail.amount'),
                    `${fmt(selectedEvent.amount)} ${selectedEvent.assetSym}`,
                  ],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex items-center justify-between py-1.5 border-b border-border/40"
                  >
                    <span className="text-content-secondary text-sm">{label}</span>
                    <span className="font-mono text-content-primary text-sm">{value}</span>
                  </div>
                ))}
                {(selectedEvent as any).assetOutId && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <span className="text-content-secondary text-sm">
                      {t('transactions.detail.swapOut')}
                    </span>
                    <span className="font-mono text-content-primary text-sm">
                      {fmt((selectedEvent as any).amountOut)}{' '}
                      {assetsById.get((selectedEvent as any).assetOutId)?.symbol ??
                        (selectedEvent as any).assetOutId}
                    </span>
                  </div>
                )}
                {((selectedEvent as any).feeBase || (selectedEvent as any).feeAssetId) && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <span className="text-content-secondary text-sm">
                      {t('transactions.detail.fee')}
                    </span>
                    <span className="font-mono text-content-primary text-sm">
                      {fmt((selectedEvent as any).feeBase)} {baseCurrency}
                      {(selectedEvent as any).feeAssetId
                        ? ` + ${fmt((selectedEvent as any).feeAmount)} ${assetsById.get((selectedEvent as any).feeAssetId)?.symbol ?? (selectedEvent as any).feeAssetId}`
                        : ''}
                    </span>
                  </div>
                )}
                {selectedEvent.externalRef && (
                  <div className="flex items-center justify-between py-1.5 border-b border-border/40">
                    <span className="text-content-secondary text-sm">
                      {t('transactions.detail.externalRef')}
                    </span>
                    <span className="font-mono text-content-primary text-sm truncate max-w-[300px]">
                      {String(selectedEvent.externalRef)}
                    </span>
                  </div>
                )}
                {selectedEvent.notes && (
                  <div
                    className="rounded-lg border border-border bg-surface-raised p-3 text-sm text-content-secondary"
                    data-testid="box-ledger-notes"
                  >
                    {String(selectedEvent.notes)}
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 mt-2">
                <Button
                  variant="outline"
                  size="sm"
                  data-testid="btn-drawer-edit"
                  onClick={() => {
                    openEdit(selectedEvent);
                    setDetailsId(null);
                  }}
                  disabled={saving}
                >
                  <Edit2 className="h-3.5 w-3.5 mr-1.5" /> {t('transactions.btn.drawerEdit')}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => void deleteEventAppendOnly(selectedEvent)}
                  disabled={saving || selectedEvent.isDeleted}
                  data-testid="btn-drawer-delete"
                >
                  <Trash2 className="h-3.5 w-3.5 mr-1.5" /> {t('transactions.btn.drawerDelete')}
                </Button>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDetailsId(null)}
                  data-testid="btn-close-ledger-drawer"
                >
                  {t('transactions.btn.closeDrawer')}
                </Button>
              </div>

              <details
                className="mt-2 rounded-lg border border-border bg-surface-raised p-3"
                data-testid="details-ledger-raw"
              >
                <summary className="cursor-pointer select-none text-caption text-content-secondary">
                  {t('transactions.detail.rawJson')}
                </summary>
                <pre className="mt-2 max-h-[200px] overflow-auto text-[11px] text-content-tertiary">
                  {JSON.stringify(selectedEvent, null, 2)}
                </pre>
              </details>
            </>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
