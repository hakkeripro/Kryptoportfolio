import Decimal from 'decimal.js';
import type { Disposal } from '../domain/portfolio.js';
import type { HmoAdjustment, HmoResult } from '../domain/tax.js';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  return new Decimal(s);
}

function toFixed(x: Decimal): string {
  const s = x.toFixed();
  return s === '-0' ? '0' : s;
}

function computeHoldingYears(disposal: Disposal): number {
  const timestamps = disposal.lotsMatched
    .map((m) => m.acquiredAtISO)
    .filter((t): t is string => !!t);

  if (!timestamps.length) return 0; // fallback: 0 years → 20% rate

  const earliest = timestamps.reduce((a, b) => (a < b ? a : b));
  const holdingMs =
    new Date(disposal.disposedAtISO).getTime() - new Date(earliest).getTime();
  return holdingMs / (365.25 * 24 * 60 * 60 * 1000);
}

/**
 * Finnish acquisition cost assumption (hankintameno-olettama, HMO).
 *
 * Rate: < 10 years → 20% of proceeds, ≥ 10 years → 40% of proceeds.
 * Applied only when hmoCostBasis > actualCostBasis (beneficial to the taxpayer).
 *
 * Returns HmoResult alongside the original disposals (does not mutate them).
 */
export function applyHmo(disposals: Disposal[], hmoEnabled: boolean): HmoResult {
  const adjustments: HmoAdjustment[] = [];
  let totalSaving = new Decimal(0);

  for (const disposal of disposals) {
    const holdingYears = computeHoldingYears(disposal);
    const hmoRate: 0.2 | 0.4 = holdingYears >= 10 ? 0.4 : 0.2;
    const hmoCostBasis = d(disposal.proceedsBase).mul(hmoRate);
    const actualCostBasis = d(disposal.costBasisBase);
    // HMO is beneficial when it yields a higher cost basis (lower taxable gain)
    const beneficial = hmoCostBasis.gt(actualCostBasis);
    const applied = hmoEnabled && beneficial;
    const saved = hmoCostBasis.sub(actualCostBasis); // positive = tax saving

    if (applied) totalSaving = totalSaving.add(saved);

    adjustments.push({
      disposalEventId: disposal.eventId,
      holdingYears,
      hmoRate,
      hmoCostBasisBase: toFixed(hmoCostBasis),
      actualCostBasisBase: toFixed(actualCostBasis),
      savedBase: toFixed(saved),
      applied,
    });
  }

  return {
    adjustments,
    totalSavingBase: toFixed(totalSaving),
  };
}
