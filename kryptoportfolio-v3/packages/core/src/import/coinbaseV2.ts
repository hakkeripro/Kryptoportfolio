import Decimal from 'decimal.js';
import { z } from 'zod';
import type { LedgerEvent } from '../domain/ledger.js';
import { assertFeeInvariants, LedgerEvent as LedgerEventSchema } from '../domain/ledger.js';
import type { Settings } from '../domain/settings.js';

/**
 * Coinbase App (v2) → v3 ledger mapping.
 *
 * This is intentionally conservative:
 * - no symbol guessing to external providers
 * - strict deterministic dedupe via externalRef
 * - missing FX / missing fee valuation / missing reward FMV (FMV mode) are surfaced as issues
 */

const CoinbaseMoney = z
  .object({
    amount: z.string(),
    currency: z.string()
  })
  .passthrough();

export const CoinbaseV2TxSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    created_at: z.string(),
    amount: CoinbaseMoney,
    native_amount: CoinbaseMoney.optional(),
    details: z.any().optional()
  })
  .passthrough();

export type CoinbaseV2Tx = z.infer<typeof CoinbaseV2TxSchema>;

export type CoinbaseV2ImportItem = { accountId: string; tx: unknown };

export type FxRatesToBase = Record<string, string>; // currency (upper) -> rate to base

export type ImportIssue =
  | {
      type: 'FX_MISSING';
      currency: string;
      neededFor: 'native_amount' | 'subtotal' | 'fee';
      txIds: string[];
    }
  | {
      type: 'TRADE_PAIR_MISSING';
      tradeKey: string;
      txIds: string[];
    }
  | {
      type: 'SWAP_VALUATION_MISSING';
      tradeKey: string;
      txIds: string[];
    }
  | {
      type: 'FEE_VALUE_MISSING';
      /** override key: txId for normal txs, tradeKey for paired trades */
      refKey: string;
      feeCurrency: string;
      feeAmount: string;
    }
  | {
      type: 'REWARD_FMV_MISSING';
      txId: string;
      amount: string;
      currency: string;
    };

export type ImportOverrides = {
  /** Base-currency valuation for token fees where Coinbase did not provide a convertible fiat value. */
  feeValueBaseByRefKey?: Record<string, string>;
  /** Total base-currency fair market value for reward events in FMV mode. */
  rewardFmvTotalBaseByTxId?: Record<string, string>;
  /** Base-currency valuation for swaps where native_amount cannot be converted deterministically. */
  tradeValuationBaseByTradeKey?: Record<string, string>;
};

export type CoinbaseV2MapOptions = {
  baseCurrency: string;
  /** map currency code → internal Asset.id */
  currencyToAssetId: (currency: string) => string;
  /** optional FX map for converting Coinbase native/subtotal/fee currencies into baseCurrency */
  fxRatesToBase?: FxRatesToBase;
  /**
   * Settings are needed for reward FMV rules.
   *
   * NOTE: Optional for callers that only need BUY/SELL/SWAP mapping. Defaults to ZERO.
   */
  settings?: Pick<Settings, 'rewardsCostBasisMode'>;
  /** app-level accountId to attach to events (e.g. acct_coinbase) */
  ledgerAccountId?: string;
  overrides?: ImportOverrides;
};

export type CoinbaseV2MapResult = {
  events: LedgerEvent[];
  issues: ImportIssue[];
  /** externalRef keys produced by mapping */
  externalRefs: string[];
};

function upper(s: string): string {
  return String(s ?? '').trim().toUpperCase();
}

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  return new Decimal(s);
}

function iso(createdAt: string): string {
  const dt = new Date(createdAt);
  return new Date(dt.getTime()).toISOString();
}

function txExternalRefV2(accountId: string, txId: string): string {
  return `coinbase:v2:${accountId}:${txId}`;
}

function extractTradeKey(tx: CoinbaseV2Tx): string | null {
  const any = tx as any;
  const direct = typeof any.trade_id === 'string' ? any.trade_id : null;
  if (direct) return `trade:${direct}`;

  const t = any.trade;
  if (t && typeof t === 'object') {
    if (typeof t.id === 'string' && t.id) return `trade:${t.id}`;
    if (typeof t.resource_path === 'string') {
      const m = t.resource_path.match(/\/trades\/(.+)$/);
      if (m) return `trade:${m[1]}`;
    }
  }

  // Some coinbase "trade" transactions use the "instant_exchange" field.
  const ie = any.instant_exchange;
  if (ie && typeof ie === 'object') {
    if (typeof ie.id === 'string' && ie.id) return `trade:${ie.id}`;
    if (typeof ie.resource_path === 'string') {
      const m = ie.resource_path.match(/\/instant_exchanges\/(.+)$/);
      if (m) return `trade:${m[1]}`;
    }
  }

  return null;
}

function convertToBase(
  amount: Decimal,
  currency: string,
  baseCurrency: string,
  fxRatesToBase: FxRatesToBase | undefined
): Decimal | null {
  const c = upper(currency);
  const base = upper(baseCurrency);
  if (c === base) return amount;
  const rateRaw = fxRatesToBase?.[c];
  if (!rateRaw) return null;
  return amount.mul(d(rateRaw));
}

function pickMoneyToBase(
  money: { amount: string; currency: string } | undefined,
  baseCurrency: string,
  fxRatesToBase: FxRatesToBase | undefined
): Decimal | null {
  if (!money) return null;
  return convertToBase(d(money.amount), money.currency, baseCurrency, fxRatesToBase);
}

function extractBuySellFields(tx: CoinbaseV2Tx):
  | {
      kind: 'buy';
      subtotal?: { amount: string; currency: string };
      fee?: { amount: string; currency: string };
      total?: { amount: string; currency: string };
    }
  | {
      kind: 'sell';
      subtotal?: { amount: string; currency: string };
      fee?: { amount: string; currency: string };
      total?: { amount: string; currency: string };
    }
  | null {
  const any = tx as any;
  if (any.buy && typeof any.buy === 'object') {
    const b = any.buy;
    return {
      kind: 'buy',
      subtotal: b.subtotal,
      fee: b.fee,
      total: b.total
    };
  }
  if (any.sell && typeof any.sell === 'object') {
    const s = any.sell;
    return {
      kind: 'sell',
      subtotal: s.subtotal,
      fee: s.fee,
      total: s.total
    };
  }
  return null;
}

function extractFeeMoney(tx: CoinbaseV2Tx): { amount: string; currency: string } | null {
  const any = tx as any;
  // top-level fee
  if (any.fee && typeof any.fee === 'object' && typeof any.fee.amount === 'string' && typeof any.fee.currency === 'string') {
    return any.fee;
  }
  // buy/sell embedded fee
  const bs = extractBuySellFields(tx);
  if (bs?.fee && typeof (bs as any).fee?.amount === 'string') return (bs as any).fee;
  // network fee (send/withdraw)
  const net = any.network;
  if (net && typeof net === 'object') {
    const f = net.transaction_fee ?? net.fee;
    if (f && typeof f === 'object' && typeof f.amount === 'string' && typeof f.currency === 'string') return f;
  }
  return null;
}

function buildNotes(tx: CoinbaseV2Tx): string | undefined {
  const any = tx as any;
  const title = any?.details?.title;
  const subtitle = any?.details?.subtitle;
  const parts = [title, subtitle].filter((x) => typeof x === 'string' && x.trim());
  return parts.length ? parts.join(' — ') : undefined;
}

function tagBase(accountId: string, tx: CoinbaseV2Tx): string[] {
  return ['import:coinbase', `coinbaseAccount:${accountId}`, `coinbaseType:${String(tx.type ?? '').toLowerCase()}`];
}

export function mapCoinbaseV2TransactionsToLedger(
  items: CoinbaseV2ImportItem[],
  opts: CoinbaseV2MapOptions
): CoinbaseV2MapResult {
  const baseCurrency = upper(opts.baseCurrency);
  const fxRatesToBase = opts.fxRatesToBase;
  const rewardsMode: Settings['rewardsCostBasisMode'] = opts.settings?.rewardsCostBasisMode ?? 'ZERO';
  const issues: ImportIssue[] = [];
  const events: LedgerEvent[] = [];
  const externalRefs: string[] = [];

  const parsed: { accountId: string; tx: CoinbaseV2Tx }[] = items.map((it) => ({
    accountId: it.accountId,
    tx: CoinbaseV2TxSchema.parse(it.tx)
  }));

  // Group trades across accounts into a single SWAP when possible.
  const tradeGroups = new Map<string, { accountId: string; tx: CoinbaseV2Tx }[]>();
  const nonTrade: { accountId: string; tx: CoinbaseV2Tx }[] = [];
  for (const it of parsed) {
    const t = String(it.tx.type ?? '').toLowerCase();
    if (t === 'trade') {
      const key = extractTradeKey(it.tx) ?? `trade:tx:${it.tx.id}`;
      const arr = tradeGroups.get(key) ?? [];
      arr.push(it);
      tradeGroups.set(key, arr);
    } else {
      nonTrade.push(it);
    }
  }

  // Build SWAPs from trade groups
  for (const [tradeKey, group] of tradeGroups.entries()) {
    // Determine net flows per currency
    const netByCur = new Map<string, Decimal>();
    for (const g of group) {
      const cur = upper(g.tx.amount.currency);
      const amt = d(g.tx.amount.amount);
      netByCur.set(cur, (netByCur.get(cur) ?? new Decimal(0)).add(amt));
    }
    // Find one negative (disposed) and one positive (acquired)
    const neg = [...netByCur.entries()].filter(([, v]) => v.lt(0));
    const pos = [...netByCur.entries()].filter(([, v]) => v.gt(0));

    if (!neg.length || !pos.length) {
      issues.push({ type: 'TRADE_PAIR_MISSING', tradeKey, txIds: group.map((g) => g.tx.id) });
      continue;
    }

    // Prefer the largest magnitude in each direction
    neg.sort((a, b) => b[1].abs().cmp(a[1].abs()));
    pos.sort((a, b) => b[1].abs().cmp(a[1].abs()));

    const firstNeg = neg[0];
    const firstPos = pos[0];
    if (!firstNeg || !firstPos) {
      issues.push({ type: 'TRADE_PAIR_MISSING', tradeKey, txIds: group.map((g) => g.tx.id) });
      continue;
    }

    const [curIn, amtInSigned] = firstNeg;
    const [curOut, amtOutSigned] = firstPos;
    const amtIn = amtInSigned.abs();
    const amtOut = amtOutSigned.abs();

    // Determine valuationBase from any native_amount we can convert.
    let valuationBase: Decimal | null = null;
    const txIds = group.map((g) => g.tx.id);
    for (const g of group) {
      if (!g.tx.native_amount) continue;
      const v = pickMoneyToBase(g.tx.native_amount, baseCurrency, fxRatesToBase);
      if (!v) {
        const c = upper(g.tx.native_amount.currency);
        issues.push({ type: 'FX_MISSING', currency: c, neededFor: 'native_amount', txIds });
        continue;
      }
      const abs = v.abs();
      if (!valuationBase || abs.gt(valuationBase)) valuationBase = abs;
    }

    if (!valuationBase && opts.overrides?.tradeValuationBaseByTradeKey?.[tradeKey]) {
      valuationBase = d(opts.overrides.tradeValuationBaseByTradeKey[tradeKey]).abs();
    }

    if (!valuationBase) {
      issues.push({ type: 'SWAP_VALUATION_MISSING', tradeKey, txIds });
      continue;
    }

    // Fee aggregation (Coinbase sometimes reports fee on only one side)
    const feeMoney = group
      .map((g) => extractFeeMoney(g.tx))
      .filter(Boolean)
      .map((m) => m!)
      .at(0) ?? null;

    let feeBase: Decimal | null = null;
    let feeToken: { feeAssetId: string; feeAmount: Decimal; feeValueBase: Decimal } | null = null;
    const feeOverride = opts.overrides?.feeValueBaseByRefKey?.[tradeKey];
    let feeMissingValue = false;
    if (feeMoney) {
      const feeCur = upper(feeMoney.currency);
      const feeAmt = d(feeMoney.amount).abs();
      const feeToBase = convertToBase(feeAmt, feeCur, baseCurrency, fxRatesToBase);
      if (feeToBase) {
        feeBase = feeToBase.abs();
      } else if (valuationBase && feeAmt.gt(0)) {
        // Try deterministic valuation from swap valuationBase using the traded currencies
        if (feeCur === curIn && amtIn.gt(0)) {
          feeToken = {
            feeAssetId: opts.currencyToAssetId(feeCur),
            feeAmount: feeAmt,
            feeValueBase: valuationBase.div(amtIn).mul(feeAmt)
          };
        } else if (feeCur === curOut && amtOut.gt(0)) {
          feeToken = {
            feeAssetId: opts.currencyToAssetId(feeCur),
            feeAmount: feeAmt,
            feeValueBase: valuationBase.div(amtOut).mul(feeAmt)
          };
        } else {
          if (feeOverride) {
            feeToken = {
              feeAssetId: opts.currencyToAssetId(feeCur),
              feeAmount: feeAmt,
              feeValueBase: d(feeOverride).abs()
            };
          } else {
            issues.push({ type: 'FEE_VALUE_MISSING', refKey: tradeKey, feeCurrency: feeCur, feeAmount: feeAmt.toFixed() });
            feeMissingValue = true;
          }
        }
      } else {
        if (feeOverride) {
          feeToken = {
            feeAssetId: opts.currencyToAssetId(feeCur),
            feeAmount: feeAmt,
            feeValueBase: d(feeOverride).abs()
          };
        } else {
          issues.push({ type: 'FEE_VALUE_MISSING', refKey: tradeKey, feeCurrency: feeCur, feeAmount: feeAmt.toFixed() });
          feeMissingValue = true;
        }
      }
    }

    // If Coinbase reports a fee but we cannot deterministically value it in base currency,
    // we must not commit an incomplete SWAP. The UI must ask the user for a fee valuation.
    if (feeMoney && feeMissingValue) {
      continue;
    }

    const first = group[0];
    if (!first) {
      issues.push({ type: 'TRADE_PAIR_MISSING', tradeKey, txIds: group.map((g) => g.tx.id) });
      continue;
    }

    const ts = iso(first.tx.created_at);
    const ev: LedgerEvent = {
      id: `ev_coinbase_${tradeKey.replace(/[^a-zA-Z0-9_\-]/g, '_')}`.slice(0, 60),
      schemaVersion: 1,
      createdAtISO: ts,
      updatedAtISO: ts,
      timestampISO: ts,
      type: 'SWAP',
      accountId: opts.ledgerAccountId,
      assetId: opts.currencyToAssetId(curIn),
      amount: amtIn.toFixed(),
      assetOutId: opts.currencyToAssetId(curOut),
      amountOut: amtOut.toFixed(),
      ...(valuationBase ? { valuationBase: valuationBase.toFixed() } : {}),
      ...(feeBase ? { feeBase: feeBase.toFixed() } : {}),
      ...(feeToken
        ? {
            feeAssetId: feeToken.feeAssetId,
            feeAmount: feeToken.feeAmount.toFixed(),
            feeValueBase: feeToken.feeValueBase.toFixed()
          }
        : {}),
      notes: buildNotes(first.tx),
      externalRef: `coinbase:v2:${tradeKey}`,
      tags: ['import:coinbase', `coinbaseTradeKey:${tradeKey}`, `coinbaseTxIds:${txIds.join(',')}`]
    };

    // Validate fee invariants eagerly
    assertFeeInvariants(ev);
    // Basic schema validation (guards required fields)
    LedgerEventSchema.parse(ev);

    events.push(ev);
    externalRefs.push(ev.externalRef!);
  }

  // Non-trade transactions
  for (const { accountId, tx } of nonTrade) {
    const type = String(tx.type ?? '').toLowerCase();
    const cur = upper(tx.amount.currency);
    const assetId = opts.currencyToAssetId(cur);
    const ts = iso(tx.created_at);
    const ext = txExternalRefV2(accountId, tx.id);

    const feeMoney = extractFeeMoney(tx);
    const feeCur = feeMoney ? upper(feeMoney.currency) : null;
    const feeAmt = feeMoney ? d(feeMoney.amount).abs() : new Decimal(0);
    const feeToBase = feeMoney ? convertToBase(feeAmt, feeCur!, baseCurrency, fxRatesToBase) : null;

    let feeBase: Decimal | null = null;
    let feeToken: { feeAssetId: string; feeAmount: Decimal; feeValueBase: Decimal } | null = null;
    const feeOverride = opts.overrides?.feeValueBaseByRefKey?.[tx.id];
    if (feeMoney && feeAmt.gt(0)) {
      if (feeToBase) {
        feeBase = feeToBase.abs();
      } else {
        // Token-fee valuation: try to infer from transaction price when possible
        const nativeBase = tx.native_amount ? pickMoneyToBase(tx.native_amount, baseCurrency, fxRatesToBase) : null;
        const qtyAbs = d(tx.amount.amount).abs();
        if (nativeBase && qtyAbs.gt(0) && (feeCur === cur)) {
          const px = nativeBase.abs().div(qtyAbs);
          feeToken = {
            feeAssetId: opts.currencyToAssetId(feeCur!),
            feeAmount: feeAmt,
            feeValueBase: feeAmt.mul(px)
          };
        } else {
          if (feeOverride) {
            feeToken = {
              feeAssetId: opts.currencyToAssetId(feeCur!),
              feeAmount: feeAmt,
              feeValueBase: d(feeOverride).abs()
            };
          } else {
            issues.push({ type: 'FEE_VALUE_MISSING', refKey: tx.id, feeCurrency: feeCur!, feeAmount: feeAmt.toFixed() });
          }
        }
      }
    }

    // If Coinbase reports a fee but we cannot deterministically value it in base currency,
    // do not commit an incomplete event. Ask the user for a fee valuation override.
    if (feeMoney && feeAmt.gt(0) && !feeBase && !feeToken) {
      continue;
    }

    // BUY / SELL use subtotal when available to avoid mixing fees into price.
    const bs = extractBuySellFields(tx);
    const subtotalBase = bs?.subtotal ? pickMoneyToBase(bs.subtotal, baseCurrency, fxRatesToBase) : null;
    if (bs?.subtotal && !subtotalBase) {
      issues.push({ type: 'FX_MISSING', currency: upper(bs.subtotal.currency), neededFor: 'subtotal', txIds: [tx.id] });
    }

    const nativeBase = tx.native_amount ? pickMoneyToBase(tx.native_amount, baseCurrency, fxRatesToBase) : null;
    if (tx.native_amount && !nativeBase) {
      issues.push({ type: 'FX_MISSING', currency: upper(tx.native_amount.currency), neededFor: 'native_amount', txIds: [tx.id] });
    }

    const qtySigned = d(tx.amount.amount);
    const qty = qtySigned.abs();

    if (type === 'buy') {
      const tradeValue = subtotalBase ? subtotalBase.abs() : nativeBase ? nativeBase.abs().sub(feeBase ?? new Decimal(0)) : null;
      const px = tradeValue && qty.gt(0) ? tradeValue.div(qty) : null;
      if (!px) {
        // without a deterministic base valuation we cannot price cost basis
        if (tx.native_amount) {
          issues.push({ type: 'FX_MISSING', currency: upper(tx.native_amount.currency), neededFor: 'native_amount', txIds: [tx.id] });
        }
        continue;
      }

      const ev: LedgerEvent = {
        id: `ev_cb_${tx.id}`,
        schemaVersion: 1,
        createdAtISO: ts,
        updatedAtISO: ts,
        timestampISO: ts,
        type: 'BUY',
        accountId: opts.ledgerAccountId,
        assetId,
        amount: qty.toFixed(),
        pricePerUnitBase: px.toFixed(),
        ...(feeBase ? { feeBase: feeBase.toFixed() } : {}),
        ...(feeToken
          ? { feeAssetId: feeToken.feeAssetId, feeAmount: feeToken.feeAmount.toFixed(), feeValueBase: feeToken.feeValueBase.toFixed() }
          : {}),
        notes: buildNotes(tx),
        externalRef: ext,
        tags: tagBase(accountId, tx)
      };

      assertFeeInvariants(ev);
      LedgerEventSchema.parse(ev);
      events.push(ev);
      externalRefs.push(ext);
      continue;
    }

    if (type === 'sell') {
      const tradeValue = subtotalBase ? subtotalBase.abs() : nativeBase ? nativeBase.abs().add(feeBase ?? new Decimal(0)) : null;
      const px = tradeValue && qty.gt(0) ? tradeValue.div(qty) : null;
      if (!px) {
        if (tx.native_amount) {
          issues.push({ type: 'FX_MISSING', currency: upper(tx.native_amount.currency), neededFor: 'native_amount', txIds: [tx.id] });
        }
        continue;
      }

      const ev: LedgerEvent = {
        id: `ev_cb_${tx.id}`,
        schemaVersion: 1,
        createdAtISO: ts,
        updatedAtISO: ts,
        timestampISO: ts,
        type: 'SELL',
        accountId: opts.ledgerAccountId,
        assetId,
        amount: qty.toFixed(),
        pricePerUnitBase: px.toFixed(),
        ...(feeBase ? { feeBase: feeBase.toFixed() } : {}),
        ...(feeToken
          ? { feeAssetId: feeToken.feeAssetId, feeAmount: feeToken.feeAmount.toFixed(), feeValueBase: feeToken.feeValueBase.toFixed() }
          : {}),
        notes: buildNotes(tx),
        externalRef: ext,
        tags: tagBase(accountId, tx)
      };
      assertFeeInvariants(ev);
      LedgerEventSchema.parse(ev);
      events.push(ev);
      externalRefs.push(ext);
      continue;
    }

    // Rewards
    if (type.includes('reward') || type.includes('interest') || type.includes('airdrop') || type.includes('staking')) {
      const rewardType: LedgerEvent['type'] = type.includes('staking')
        ? 'STAKING_REWARD'
        : type.includes('airdrop')
          ? 'AIRDROP'
          : 'REWARD';

      const overrideFmv = opts.overrides?.rewardFmvTotalBaseByTxId?.[tx.id];
      const fmvTotalBase = (nativeBase?.abs() ?? null) ?? (overrideFmv ? d(overrideFmv).abs() : null);
      if (rewardsMode === 'FMV' && !fmvTotalBase) {
        issues.push({ type: 'REWARD_FMV_MISSING', txId: tx.id, amount: qty.toFixed(), currency: cur });
        continue;
      }
      const ev: LedgerEvent = {
        id: `ev_cb_${tx.id}`,
        schemaVersion: 1,
        createdAtISO: ts,
        updatedAtISO: ts,
        timestampISO: ts,
        type: rewardType,
        accountId: opts.ledgerAccountId,
        assetId,
        amount: qty.toFixed(),
        ...(fmvTotalBase ? { fmvTotalBase: fmvTotalBase.toFixed() } : {}),
        notes: buildNotes(tx),
        externalRef: ext,
        tags: tagBase(accountId, tx)
      };
      LedgerEventSchema.parse(ev);
      events.push(ev);
      externalRefs.push(ext);
      continue;
    }

    // Default to TRANSFER with signed amount
    const ev: LedgerEvent = {
      id: `ev_cb_${tx.id}`,
      schemaVersion: 1,
      createdAtISO: ts,
      updatedAtISO: ts,
      timestampISO: ts,
      type: 'TRANSFER',
      accountId: opts.ledgerAccountId,
      assetId,
      amount: qtySigned.toFixed(),
      ...(feeBase ? { feeBase: feeBase.toFixed() } : {}),
      ...(feeToken
        ? { feeAssetId: feeToken.feeAssetId, feeAmount: feeToken.feeAmount.toFixed(), feeValueBase: feeToken.feeValueBase.toFixed() }
        : {}),
      notes: buildNotes(tx),
      externalRef: ext,
      tags: tagBase(accountId, tx)
    };
    assertFeeInvariants(ev);
    LedgerEventSchema.parse(ev);
    events.push(ev);
    externalRefs.push(ext);
  }

  // Stable sort by time then externalRef for deterministic output
  events.sort((a, b) => a.timestampISO.localeCompare(b.timestampISO) || String(a.externalRef ?? '').localeCompare(String(b.externalRef ?? '')));

  return { events, issues, externalRefs };
}
