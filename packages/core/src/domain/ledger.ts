import { z } from 'zod';
import { BaseEntityFields, DecimalString, IsoString, UuidString } from './common.js';

export const LedgerEventType = z.enum([
  'BUY',
  'SELL',
  'SWAP',
  'TRANSFER',
  'REWARD',
  'STAKING_REWARD',
  'AIRDROP',
  'LP_DEPOSIT',
  'LP_WITHDRAW',
  'LEND_DEPOSIT',
  'LEND_WITHDRAW',
  'BORROW',
  'REPAY',
  'INTEREST_ACCRUAL'
]);

export const LedgerEventBase = z.object({
  ...BaseEntityFields,
  type: LedgerEventType,
  timestampISO: IsoString,
  accountId: UuidString.optional(),
  assetId: UuidString.optional(),
  amount: DecimalString.optional(),
  pricePerUnitBase: DecimalString.optional(),
  feeBase: DecimalString.optional(),
  feeAssetId: UuidString.optional(),
  feeAmount: DecimalString.optional(),
  feeValueBase: DecimalString.optional(),
  notes: z.string().optional(),
  externalRef: z.string().optional(),
  tags: z.array(z.string()).optional(),
  replacesEventId: UuidString.optional()
});

// Swap specifics
export const SwapFields = z.object({
  assetOutId: UuidString,
  amountOut: DecimalString,
  valuationBase: DecimalString.optional()
});

export const LedgerEvent = z.discriminatedUnion('type', [
  LedgerEventBase.extend({ type: z.literal('BUY'), assetId: UuidString, amount: DecimalString, pricePerUnitBase: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('SELL'), assetId: UuidString, amount: DecimalString, pricePerUnitBase: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('SWAP'), assetId: UuidString, amount: DecimalString }).merge(SwapFields),
  LedgerEventBase.extend({ type: z.literal('TRANSFER'), assetId: UuidString, amount: DecimalString }).extend({ fromAccountId: UuidString.optional(), toAccountId: UuidString.optional() }),
  LedgerEventBase.extend({ type: z.literal('REWARD'), assetId: UuidString, amount: DecimalString }).extend({ fmvPerUnitBase: DecimalString.optional(), fmvTotalBase: DecimalString.optional() }),
  LedgerEventBase.extend({ type: z.literal('STAKING_REWARD'), assetId: UuidString, amount: DecimalString }).extend({ fmvPerUnitBase: DecimalString.optional(), fmvTotalBase: DecimalString.optional() }),
  LedgerEventBase.extend({ type: z.literal('AIRDROP'), assetId: UuidString, amount: DecimalString }).extend({ fmvPerUnitBase: DecimalString.optional(), fmvTotalBase: DecimalString.optional() }),
  // DeFi minimal structures
  LedgerEventBase.extend({ type: z.literal('LP_DEPOSIT'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('LP_WITHDRAW'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('LEND_DEPOSIT'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('LEND_WITHDRAW'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('BORROW'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('REPAY'), assetId: UuidString, amount: DecimalString }),
  LedgerEventBase.extend({ type: z.literal('INTEREST_ACCRUAL'), assetId: UuidString, amount: DecimalString })
]);

export type LedgerEvent = z.infer<typeof LedgerEvent>;

export type LedgerView = {
  /**
   * Active (non-deleted) events in timestamp order.
   *
   * Note: replacements are modelled as append-only events that reference `replacesEventId`.
   * The UI still needs the full stream for audit, but calculations should use `activeEvents`.
   */
  activeEvents: LedgerEvent[];
  /** Full stream (unsorted is fine) */
  allEvents: LedgerEvent[];
  /** Map: replacedEventId -> replacementEventId */
  replacedById: Record<string, string>;
};

export function buildLedgerView(events: LedgerEvent[]): LedgerView {
  // Multiple replacement events *can* exist for the same target (buggy producers, merges, retries).
  // Choose the latest replacement deterministically.
  const latestReplacementByTarget: Record<string, LedgerEvent> = {};
  for (const e of events) {
    if (!e.replacesEventId) continue;
    const target = e.replacesEventId;
    const prev = latestReplacementByTarget[target];
    if (!prev) {
      latestReplacementByTarget[target] = e;
      continue;
    }
    const prevKey = `${prev.updatedAtISO ?? prev.createdAtISO}:${prev.id}`;
    const nextKey = `${e.updatedAtISO ?? e.createdAtISO}:${e.id}`;
    if (nextKey > prevKey) latestReplacementByTarget[target] = e;
  }

  const replacedById: Record<string, string> = {};
  for (const [targetId, repl] of Object.entries(latestReplacementByTarget)) {
    replacedById[targetId] = repl.id;
  }

  // Calculations should not double-count replaced events even if a buggy producer forgot to soft-delete them.
  const activeEvents = events
    .filter((e) => !e.isDeleted)
    .filter((e) => !replacedById[e.id])
    .sort((a, b) => a.timestampISO.localeCompare(b.timestampISO));

  return { activeEvents, allEvents: events, replacedById };
}

export function normalizeActiveLedger(events: LedgerEvent[]): LedgerEvent[] {
  return buildLedgerView(events).activeEvents;
}

export function feeValueBaseOrZero(e: LedgerEvent): string {
  // Fee can be stored either directly in base currency or as a token fee with a deterministic base valuation.
  if (e.feeBase) return e.feeBase;
  if (e.feeValueBase) return e.feeValueBase;
  return '0';
}

export function assertFeeInvariants(e: LedgerEvent): void {
  // If fee is expressed as a token fee, we require both amount and deterministic base valuation.
  if (e.feeAssetId) {
    if (!e.feeAmount) throw new Error('ledger_fee_missing_amount');
    if (!e.feeValueBase && !e.feeBase) throw new Error('ledger_fee_missing_value_base');
  }
}
