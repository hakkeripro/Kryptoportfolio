import Decimal from 'decimal.js';
import type { LedgerEvent } from '../domain/ledger.js';

export type SelfTransferMatch = {
  outEventId: string;
  inEventId: string;
  assetId: string;
  amount: string;
  timeDiffSec: number;
  confidence: 'high' | 'medium';
};

export type TransferDetectionResult = {
  matched: SelfTransferMatch[];
  unmatchedOut: string[]; // eventId[] — outgoing without a pair
  unmatchedIn: string[]; // eventId[] — incoming without a pair
};

const DEFAULT_MAX_TIME_DIFF_HOURS = 2;
const DEFAULT_DUST_TOLERANCE_PCT = 0.005; // 0.5%
const HIGH_CONFIDENCE_THRESHOLD_SEC = 30 * 60; // 30 minutes

function toFixed(x: Decimal): string {
  const s = x.toFixed();
  return s === '-0' ? '0' : s;
}

/**
 * Detect self-transfers: pairs of outgoing + incoming TRANSFER events for the same asset
 * between different accounts, within a time window, with matching amounts (dust tolerance).
 *
 * Algorithm: greedy — closest-in-time unmatched incoming is paired with each outgoing.
 */
export function detectSelfTransfers(
  events: LedgerEvent[],
  options?: { maxTimeDiffHours?: number; dustTolerancePct?: number },
): TransferDetectionResult {
  const maxTimeDiffSec =
    (options?.maxTimeDiffHours ?? DEFAULT_MAX_TIME_DIFF_HOURS) * 3600;
  const dustTolerance = options?.dustTolerancePct ?? DEFAULT_DUST_TOLERANCE_PCT;

  // Only TRANSFER events
  const transfers = events.filter((e) => e.type === 'TRANSFER');

  // Group by assetId
  const byAsset: Record<string, LedgerEvent[]> = {};
  for (const e of transfers) {
    const assetId = (e as any).assetId as string | undefined;
    if (!assetId) continue;
    byAsset[assetId] ??= [];
    byAsset[assetId]!.push(e);
  }

  const matched: SelfTransferMatch[] = [];
  const matchedOutIds = new Set<string>();
  const matchedInIds = new Set<string>();

  for (const assetEvents of Object.values(byAsset)) {
    // Separate outgoing (amount < 0) and incoming (amount > 0)
    const outgoing = assetEvents.filter(
      (e) => new Decimal((e as any).amount ?? '0').lt(0),
    );
    const incoming = assetEvents.filter(
      (e) => new Decimal((e as any).amount ?? '0').gt(0),
    );

    if (outgoing.length === 0 || incoming.length === 0) continue;

    // Sort outgoing by timestamp for deterministic greedy processing
    const sortedOut = [...outgoing].sort((a, b) =>
      a.timestampISO.localeCompare(b.timestampISO),
    );

    for (const outEv of sortedOut) {
      const outAmt = new Decimal((outEv as any).amount ?? '0').abs();
      const outTimeSec = new Date(outEv.timestampISO).getTime() / 1000;
      const outAccountId = outEv.accountId;

      let bestIn: LedgerEvent | null = null;
      let bestTimeDiff = Infinity;

      for (const inEv of incoming) {
        if (matchedInIds.has(inEv.id)) continue;

        const inAmt = new Decimal((inEv as any).amount ?? '0').abs();
        const inTimeSec = new Date(inEv.timestampISO).getTime() / 1000;
        const inAccountId = inEv.accountId;

        // Time constraint
        const timeDiff = Math.abs(outTimeSec - inTimeSec);
        if (timeDiff > maxTimeDiffSec) continue;

        // Amount constraint (dust tolerance)
        if (outAmt.isZero()) continue;
        const relDiff = outAmt.sub(inAmt).abs().div(outAmt);
        if (relDiff.gt(new Decimal(dustTolerance))) continue;

        // Must be different accounts (if both have accountId set)
        if (outAccountId && inAccountId && outAccountId === inAccountId) continue;

        // Prefer closest in time
        if (timeDiff < bestTimeDiff) {
          bestTimeDiff = timeDiff;
          bestIn = inEv;
        }
      }

      if (bestIn) {
        matchedOutIds.add(outEv.id);
        matchedInIds.add(bestIn.id);
        const outAmt2 = new Decimal((outEv as any).amount ?? '0').abs();
        matched.push({
          outEventId: outEv.id,
          inEventId: bestIn.id,
          assetId: (outEv as any).assetId as string,
          amount: toFixed(outAmt2),
          timeDiffSec: Math.round(bestTimeDiff),
          confidence: bestTimeDiff <= HIGH_CONFIDENCE_THRESHOLD_SEC ? 'high' : 'medium',
        });
      }
    }
  }

  const unmatchedOut = transfers
    .filter(
      (e) =>
        new Decimal((e as any).amount ?? '0').lt(0) && !matchedOutIds.has(e.id),
    )
    .map((e) => e.id);

  const unmatchedIn = transfers
    .filter(
      (e) =>
        new Decimal((e as any).amount ?? '0').gt(0) && !matchedInIds.has(e.id),
    )
    .map((e) => e.id);

  return { matched, unmatchedOut, unmatchedIn };
}
