import { useMemo, useState } from 'react';
import Decimal from 'decimal.js';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { LedgerEvent } from '@kp/core';
import { LedgerEvent as LedgerEventSchema } from '@kp/core';
import { rebuildDerivedCaches } from '../derived/rebuildDerived';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from '../hooks/useDbQuery';
import { VirtualList } from '../components/VirtualList';

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

const EVENT_TYPES: LedgerEvent['type'][] = [
  'BUY',
  'SELL',
  'SWAP',
  'TRANSFER',
  'REWARD',
  'STAKING_REWARD',
  'AIRDROP'
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
    notes: ''
  };
}

function buildReplacementId(oldId: string): string {
  // Deterministic enough for UI usage; ledger is append-only.
  return `ev_replace_${oldId}_${Date.now()}`;
}

export default function TransactionsPage() {
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const dbState = useDbQuery(
    async (db) => {
      await ensureWebDbOpen();
      const settings = ((await db.settings.get('settings_1')) as any) ?? (await ensureDefaultSettings());
      const baseCurrency = String(settings.baseCurrency ?? 'EUR').toUpperCase();
      const baseCurrencyAssetId = `asset_${baseCurrency.toLowerCase()}`;

      const assets = await db.assets.toArray();
      const accounts = await db.accounts.toArray();
      const events = await db.ledgerEvents.orderBy('timestampISO').reverse().toArray();

      // Map replaced-by for badges
      const replacedBy = new Map<string, string>();
      // Deterministic: pick the latest replacement per target.
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
      replacedBy: new Map<string, string>()
    }
  );

  const baseCurrency = dbState.data.baseCurrency;
  const assetsById = useMemo(() => new Map(dbState.data.assets.map((a: any) => [a.id, a])), [dbState.data.assets]);
  const accountsById = useMemo(() => new Map(dbState.data.accounts.map((a: any) => [a.id, a])), [dbState.data.accounts]);

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
      notes: (e as any).notes ?? ''
    });
  }

  function resetForm() {
    setForm(blankForm(dbState.data.baseCurrencyAssetId));
  }

  async function submit() {
    setSaving(true);
    setMsg(null);
    try {
      await ensureWebDbOpen();
      const db = getWebDb();
      const now = new Date().toISOString();

      const base: any = {
        id: form.mode === 'edit' && form.targetId ? buildReplacementId(form.targetId) : `ev_manual_${Date.now()}`,
        schemaVersion: 1,
        createdAtISO: now,
        updatedAtISO: now,
        timestampISO: new Date(form.timestampISO).toISOString(),
        type: form.type,
        accountId: 'acct_manual',
        assetId: form.assetId,
        amount: form.amount.trim() || '0',
        ...(form.notes.trim() ? { notes: form.notes.trim() } : {}),
        ...(form.externalRef.trim() ? { externalRef: form.externalRef.trim() } : {})
      };

      // Optional accountId override if the user has only one exchange account.
      if (dbState.data.accounts.some((a: any) => a.id === 'acct_coinbase')) base.accountId = 'acct_coinbase';

      if (form.type === 'BUY' || form.type === 'SELL') {
        base.pricePerUnitBase = form.pricePerUnitBase.trim() || '0';
      }

      if (form.type === 'SWAP') {
        base.assetOutId = form.assetOutId;
        base.amountOut = form.amountOut.trim() || '0';
        if (form.valuationBase.trim()) base.valuationBase = form.valuationBase.trim();
      }

      if (form.feeBase.trim()) base.feeBase = form.feeBase.trim();

      // Optional token-fee fields
      if (form.feeAssetId && form.feeAssetId !== dbState.data.baseCurrencyAssetId && form.feeAmount.trim()) {
        base.feeAssetId = form.feeAssetId;
        base.feeAmount = form.feeAmount.trim();
        if (form.feeValueBase.trim()) base.feeValueBase = form.feeValueBase.trim();
      }

      // Zod validation for required fields
      LedgerEventSchema.parse(base);

      await db.transaction('rw', db.ledgerEvents, async () => {
        if (form.mode === 'edit' && form.targetId) {
          // Append-only edit: append a replacement event that references the old event.
          // Calculations use `normalizeActiveLedger` which excludes the replaced event.
          await db.ledgerEvents.add({ ...base, replacesEventId: form.targetId } as any);
        } else {
          await db.ledgerEvents.add(base as any);
        }
      });

      await rebuildDerivedCaches({ daysBack: 365 });
      setMsg(form.mode === 'edit' ? 'Saved replacement event (append-only).' : 'Added event.');
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

      // Tombstone event: append-only deletion marker. The replaced event is excluded from active ledger.
      const tomb: any = {
        ...e,
        id: buildReplacementId(String(e.id)) + '_del',
        schemaVersion: 1,
        createdAtISO: now,
        updatedAtISO: now,
        timestampISO: now,
        isDeleted: true,
        replacesEventId: String(e.id),
        notes: e.notes ? `${String(e.notes)} (deleted)` : 'deleted'
      };

      const parsed = LedgerEventSchema.parse(tomb);
      await db.ledgerEvents.add(parsed as any);
      await rebuildDerivedCaches({ daysBack: 365 });
      setMsg('Deleted (tombstone appended).');
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
      accountName: accountsById.get(e.accountId)?.name ?? e.accountId
    }));
  }, [dbState.data.events, assetsById, accountsById]);

  const selectedEvent = useMemo(() => {
    if (!detailsId) return null;
    return eventsView.find((e: any) => String(e.id) === String(detailsId)) ?? null;
  }, [detailsId, eventsView]);

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold">Transactions</h1>
        <div className="text-xs text-slate-400">Ledger is append-only. Edit = replacement. Delete = tombstone (append-only).</div>
      </div>

      {msg ? (
        <div
          className={`rounded-xl border p-3 text-sm ${msg.includes('error') || msg.includes('Invalid') ? 'border-red-800 bg-red-900/30 text-red-200' : 'border-slate-800 bg-slate-900/40 text-slate-200'}`}
          data-testid="alert-tx-message"
        >
          {msg}
        </div>
      ) : null}

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="panel-event-form">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="font-medium">{form.mode === 'edit' ? `Edit (replacement) ${form.targetId}` : 'Add manual event'}</div>
          {form.mode === 'edit' ? (
            <button
              className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
              onClick={resetForm}
              disabled={saving}
              data-testid="btn-cancel-edit"
            >
              Cancel
            </button>
          ) : null}
        </div>

        <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <label className="block">
            <div className="text-xs text-slate-400">Type</div>
            <select
              data-testid="form-event-type"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
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
            <div className="text-xs text-slate-400">Asset</div>
            <select
              data-testid="form-event-asset"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
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
            <div className="text-xs text-slate-400">Timestamp (UTC ISO)</div>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
              value={form.timestampISO}
              onChange={(e) => setForm((f) => ({ ...f, timestampISO: e.target.value }))}
              disabled={saving}
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400">Amount</div>
            <input
              data-testid="form-event-amount"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
              value={form.amount}
              onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
              disabled={saving}
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400">Price per unit ({baseCurrency})</div>
            <input
              data-testid="form-event-price"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
              value={form.pricePerUnitBase}
              onChange={(e) => setForm((f) => ({ ...f, pricePerUnitBase: e.target.value }))}
              disabled={saving || (form.type !== 'BUY' && form.type !== 'SELL')}
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400">Fee ({baseCurrency})</div>
            <input
              data-testid="form-event-fee"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
              value={form.feeBase}
              onChange={(e) => setForm((f) => ({ ...f, feeBase: e.target.value }))}
              disabled={saving}
              placeholder="feeBase"
            />
          </label>

          <label className="block">
            <div className="text-xs text-slate-400">Fee asset (optional token fee)</div>
            <select
              data-testid="form-event-fee-asset"
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
              value={form.feeAssetId}
              onChange={(e) => setForm((f) => ({ ...f, feeAssetId: e.target.value }))}
              disabled={saving}
            >
              <option value={dbState.data.baseCurrencyAssetId}>{baseCurrency} (base)</option>
              {dbState.data.assets
                .filter((a: any) => a.id !== dbState.data.baseCurrencyAssetId)
                .map((a: any) => (
                  <option key={a.id} value={a.id}>
                    {a.symbol}
                  </option>
                ))}
            </select>
          </label>

          {form.feeAssetId !== dbState.data.baseCurrencyAssetId ? (
            <>
              <label className="block">
                <div className="text-xs text-slate-400">Fee amount (token)</div>
                <input
                  data-testid="form-event-fee-amount"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
                  value={form.feeAmount}
                  onChange={(e) => setForm((f) => ({ ...f, feeAmount: e.target.value }))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400">Fee value ({baseCurrency})</div>
                <input
                  data-testid="form-event-fee-value"
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
                  value={form.feeValueBase}
                  onChange={(e) => setForm((f) => ({ ...f, feeValueBase: e.target.value }))}
                  disabled={saving}
                />
              </label>
            </>
          ) : null}

          {form.type === 'SWAP' ? (
            <>
              <label className="block">
                <div className="text-xs text-slate-400">Asset out</div>
                <select
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
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
                <div className="text-xs text-slate-400">Amount out</div>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
                  value={form.amountOut}
                  onChange={(e) => setForm((f) => ({ ...f, amountOut: e.target.value }))}
                  disabled={saving}
                />
              </label>
              <label className="block">
                <div className="text-xs text-slate-400">Valuation total ({baseCurrency})</div>
                <input
                  className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm font-mono"
                  value={form.valuationBase}
                  onChange={(e) => setForm((f) => ({ ...f, valuationBase: e.target.value }))}
                  disabled={saving}
                />
              </label>
            </>
          ) : null}

          <label className="block md:col-span-2">
            <div className="text-xs text-slate-400">External ref (optional)</div>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
              value={form.externalRef}
              onChange={(e) => setForm((f) => ({ ...f, externalRef: e.target.value }))}
              disabled={saving}
            />
          </label>

          <label className="block md:col-span-3">
            <div className="text-xs text-slate-400">Notes</div>
            <input
              className="mt-1 w-full rounded-lg bg-slate-950 border border-slate-800 px-2 py-2 text-sm"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={saving}
            />
          </label>
        </div>

        <div className="mt-3 flex gap-2">
          <button
            data-testid="btn-submit-event"
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
            onClick={() => void submit()}
            disabled={saving}
          >
            {saving ? 'Saving…' : form.mode === 'edit' ? 'Save replacement' : 'Add event'}
          </button>
          <button
            className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
            onClick={resetForm}
            disabled={saving}
          >
            Reset
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4" data-testid="panel-ledger">
        <div className="flex items-center justify-between">
          <div className="font-medium">Ledger events</div>
          <div className="text-xs text-slate-400">{eventsView.length} events</div>
        </div>
        <div className="mt-3" data-testid="list-ledger">
          {eventsView.length ? (
            <VirtualList
              items={eventsView as any[]}
              itemHeight={116}
              height={620}
              className="overflow-auto rounded-lg border border-slate-800"
              getKey={(e: any) => String(e.id)}
              renderItem={(e: any) => {
                const replacedBy = dbState.data.replacedBy.get(String(e.id));
                return (
                  <div className="h-full bg-slate-950/40 px-3 py-3 flex items-start justify-between gap-3 border-b border-slate-800" data-testid={`row-ledger-${e.id}`}>
                    <div className="min-w-0 overflow-hidden">
                      <div className="flex items-center gap-2 flex-wrap overflow-hidden">
                        <span className="text-sm font-semibold">{e.type}</span>
                        <span className="text-sm font-mono truncate">
                          {fmt(e.amount)} {e.assetSym}
                        </span>
                        {e.type === 'SWAP' ? (
                          <span className="text-xs text-slate-400 font-mono truncate">
                            → {fmt((e as any).amountOut)} {assetsById.get((e as any).assetOutId)?.symbol ?? (e as any).assetOutId}
                          </span>
                        ) : null}
                        {e.isDeleted ? (
                          <span className="text-xs rounded bg-red-900/40 px-2 py-0.5" data-testid="badge-ledger-deleted">
                            deleted
                          </span>
                        ) : null}
                        {replacedBy ? (
                          <span className="text-xs rounded bg-slate-800 px-2 py-0.5" data-testid="badge-ledger-replaced">
                            replaced
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-1 text-xs text-slate-400 truncate">
                        {new Date(e.timestampISO).toLocaleString()} • {e.accountName}
                        {e.externalRef ? <span className="ml-2 font-mono">{String(e.externalRef).slice(0, 26)}</span> : null}
                      </div>
                      {e.feeBase || (e as any).feeAssetId ? (
                        <div className="mt-1 text-xs text-slate-400 truncate">
                          feeBase: {fmt((e as any).feeBase)} {baseCurrency}
                          {(e as any).feeAssetId ? (
                            <>
                              {' '}
                              • token fee: {fmt((e as any).feeAmount)}{' '}
                              {assetsById.get((e as any).feeAssetId)?.symbol ?? (e as any).feeAssetId} (value {fmt((e as any).feeValueBase)} {baseCurrency})
                            </>
                          ) : null}
                        </div>
                      ) : null}
                      {replacedBy ? <div className="mt-1 text-xs text-slate-400 truncate">Replaced by: {replacedBy}</div> : null}
                    </div>
                    <div className="flex gap-2">
                      <button
                        data-testid={`btn-details-event-${e.id}`}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                        onClick={() => setDetailsId(String(e.id))}
                        disabled={saving}
                      >
                        Details
                      </button>
                      <button
                        data-testid={`btn-edit-event-${e.id}`}
                        className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                        onClick={() => openEdit(e)}
                        disabled={saving}
                      >
                        Edit
                      </button>
                    </div>
                  </div>
                );
              }}
            />
          ) : (
            <div className="text-sm text-slate-400">No events yet. Import from an exchange or add manually above.</div>
          )}
        </div>
      </div>

      {selectedEvent ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          role="dialog"
          aria-modal="true"
          data-testid="drawer-ledger-event"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setDetailsId(null);
          }}
        >
          <div className="w-full max-w-2xl rounded-2xl border border-slate-700 bg-slate-950 p-4 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold truncate">{selectedEvent.type} • {selectedEvent.assetSym}</div>
                <div className="mt-1 text-xs text-slate-400 font-mono truncate">{selectedEvent.id}</div>
              </div>
              <button
                className="rounded-lg border border-slate-700 px-3 py-2 text-sm hover:bg-slate-800"
                onClick={() => setDetailsId(null)}
                data-testid="btn-close-ledger-drawer"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-2 text-sm">
              <div className="flex items-center justify-between"><span className="text-slate-400">Time</span><span className="font-mono">{new Date(selectedEvent.timestampISO).toLocaleString()}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Account</span><span className="font-mono">{selectedEvent.accountName}</span></div>
              <div className="flex items-center justify-between"><span className="text-slate-400">Amount</span><span className="font-mono">{fmt(selectedEvent.amount)} {selectedEvent.assetSym}</span></div>
              {(selectedEvent as any).assetOutId ? (
                <div className="flex items-center justify-between"><span className="text-slate-400">Swap out</span><span className="font-mono">{fmt((selectedEvent as any).amountOut)} {assetsById.get((selectedEvent as any).assetOutId)?.symbol ?? (selectedEvent as any).assetOutId}</span></div>
              ) : null}
              {(selectedEvent as any).feeBase || (selectedEvent as any).feeAssetId ? (
                <div className="flex items-center justify-between"><span className="text-slate-400">Fee</span><span className="font-mono">{fmt((selectedEvent as any).feeBase)} {baseCurrency}{(selectedEvent as any).feeAssetId ? ` • ${fmt((selectedEvent as any).feeAmount)} ${assetsById.get((selectedEvent as any).feeAssetId)?.symbol ?? (selectedEvent as any).feeAssetId} (value ${fmt((selectedEvent as any).feeValueBase)} ${baseCurrency})` : ''}</span></div>
              ) : null}
              {selectedEvent.externalRef ? (
                <div className="flex items-center justify-between"><span className="text-slate-400">External ref</span><span className="font-mono">{String(selectedEvent.externalRef)}</span></div>
              ) : null}
              {selectedEvent.notes ? (
                <div className="rounded-lg border border-slate-800 bg-slate-900/40 p-2 text-xs" data-testid="box-ledger-notes">
                  {String(selectedEvent.notes)}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex gap-2">
              <button
                className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
                onClick={() => {
                  openEdit(selectedEvent);
                  setDetailsId(null);
                }}
                disabled={saving}
                data-testid="btn-drawer-edit"
              >
                Edit (replacement)
              </button>
              <button
                className="rounded-lg border border-red-700/60 text-red-200 px-3 py-2 text-sm hover:bg-red-900/20 disabled:opacity-50"
                onClick={() => void deleteEventAppendOnly(selectedEvent)}
                disabled={saving || selectedEvent.isDeleted}
                data-testid="btn-drawer-delete"
              >
                Delete
              </button>
            </div>

            <details className="mt-4 rounded-xl border border-slate-800 bg-slate-900/40 p-3" data-testid="details-ledger-raw">
              <summary className="cursor-pointer select-none text-sm text-slate-200">Raw event JSON</summary>
              <pre className="mt-2 max-h-[260px] overflow-auto text-xs text-slate-200">
                {JSON.stringify(selectedEvent, null, 2)}
              </pre>
            </details>
          </div>
        </div>
      ) : null}
    </div>
  );
}
