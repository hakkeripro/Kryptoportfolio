import Decimal from 'decimal.js';
import type { LedgerEvent } from '../domain/ledger.js';
import { assertFeeInvariants, feeValueBaseOrZero, normalizeActiveLedger } from '../domain/ledger.js';
import type { Settings } from '../domain/settings.js';
import type { Disposal, Lot, Position } from '../domain/portfolio.js';

export type ReplayResult = {
  lotsByAssetId: Record<string, Lot[]>;
  disposals: Disposal[];
  positions: Position[];
  realizedPnlBase: string;
  warnings: string[];
};

export type LotEngine = {
  applyEvent: (e: LedgerEvent) => void;
  getPositions: () => Position[];
  getRealizedPnlBaseToDate: () => string;
  getLotsByAssetId: () => Record<string, Lot[]>;
  getDisposals: () => Disposal[];
  getWarnings: () => string[];
};

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  return new Decimal(s);
}

function yearFromISO(ts: string): number {
  // ISO timestamp is UTC
  return Number(ts.slice(0, 4));
}

function toFixed(x: Decimal): string {
  // Decimal.js default toFixed() can produce scientific notation for huge numbers unless we specify.
  // Use a reasonably high precision and trim trailing zeros.
  const s = x.toFixed();
  // normalize -0 -> 0
  if (s === '-0') return '0';
  return s;
}

function lotCostPerUnit(lot: Lot): Decimal {
  const amt = d(lot.amountRemaining);
  if (amt.isZero()) return new Decimal(0);
  return d(lot.costBasisBaseRemaining).div(amt);
}

type LotPick = {
  matched: { lotId: string; amount: Decimal; costBasisBase: Decimal }[];
  costBasisBase: Decimal;
};

function pickLots(
  lots: Lot[],
  qtyToDispose: Decimal,
  method: Settings['lotMethodDefault'],
  warnings: string[]
): LotPick {
  const want = qtyToDispose;
  let remaining = want;
  const matched: LotPick['matched'] = [];
  let cost = new Decimal(0);

  const takeFromLot = (lot: Lot, takeAmt: Decimal) => {
    const lotAmt = d(lot.amountRemaining);
    const lotCost = d(lot.costBasisBaseRemaining);
    if (lotAmt.lte(0)) return;
    const actual = Decimal.min(lotAmt, takeAmt);
    const ratio = actual.div(lotAmt);
    const costPart = lotCost.mul(ratio);
    // mutate lot
    lot.amountRemaining = toFixed(lotAmt.sub(actual));
    lot.costBasisBaseRemaining = toFixed(lotCost.sub(costPart));

    matched.push({ lotId: lot.lotId, amount: actual, costBasisBase: costPart });
    cost = cost.add(costPart);
    remaining = remaining.sub(actual);
  };

  const selectOrder = (): Lot[] => {
    if (method === 'FIFO') return lots;
    if (method === 'LIFO') return [...lots].reverse();
    if (method === 'HIFO') {
      // Highest cost per unit first. Sort every pick to reflect mutations.
      return [...lots].sort((a, b) => lotCostPerUnit(b).cmp(lotCostPerUnit(a)));
    }
    // AVG_COST handled elsewhere
    return lots;
  };

  // Iterate until we satisfy or we run out
  while (remaining.gt(0)) {
    const ordered = selectOrder();
    const next = ordered.find((l) => d(l.amountRemaining).gt(0));
    if (!next) {
      warnings.push('lot_engine_negative_inventory');
      // Synthetic "unknown" lot at 0 cost basis for missing inventory.
      matched.push({ lotId: 'unknown', amount: remaining, costBasisBase: new Decimal(0) });
      remaining = new Decimal(0);
      break;
    }
    takeFromLot(next, remaining);
  }

  return { matched, costBasisBase: cost };
}

function addLot(lots: Lot[], lot: Lot) {
  lots.push(lot);
  // Keep stable order by acquisition time (useful for FIFO/LIFO)
  lots.sort((a, b) => a.acquiredAtISO.localeCompare(b.acquiredAtISO));
}

function computePositions(lotsByAssetId: Record<string, Lot[]>): Position[] {
  const positions: Position[] = [];
  for (const [assetId, lots] of Object.entries(lotsByAssetId)) {
    const amount = lots.reduce((acc, l) => acc.add(d(l.amountRemaining)), new Decimal(0));
    const cost = lots.reduce((acc, l) => acc.add(d(l.costBasisBaseRemaining)), new Decimal(0));
    if (amount.isZero()) continue;
    const avg = amount.gt(0) ? cost.div(amount) : new Decimal(0);
    positions.push({
      assetId,
      amount: toFixed(amount),
      avgCostBase: toFixed(avg),
      costBasisBase: toFixed(cost)
    });
  }
  positions.sort((a, b) => d(b.costBasisBase).cmp(d(a.costBasisBase)));
  return positions;
}

export function createLotEngine(settings: Settings): LotEngine {
  const lotsByAssetId: Record<string, Lot[]> = {};
  const disposals: Disposal[] = [];
  const warnings: string[] = [];
  let realized = new Decimal(0);

  // For AVG_COST we keep a rolling pool by asset.
  const avgPool: Record<string, { amount: Decimal; cost: Decimal }> = {};

  const ensureLots = (assetId: string): Lot[] => {
    (lotsByAssetId[assetId] ??= []);
    return lotsByAssetId[assetId]!;
  };

  const ensurePool = (assetId: string): { amount: Decimal; cost: Decimal } => {
    (avgPool[assetId] ??= { amount: new Decimal(0), cost: new Decimal(0) });
    return avgPool[assetId]!;
  };

  const applyEvent = (e: LedgerEvent) => {
    // Fee invariants: token fee requires both amount + base value
    assertFeeInvariants(e);
    const fee = d(feeValueBaseOrZero(e)).abs();

    if (e.type === 'BUY') {
      const qty = d(e.amount).abs();
      const px = d(e.pricePerUnitBase).abs();
      const cost = qty.mul(px).add(fee); // BUY fee -> cost basis

      const lot: Lot = {
        lotId: `lot_${e.id}`,
        assetId: e.assetId,
        acquiredAtISO: e.timestampISO,
        amountRemaining: toFixed(qty),
        costBasisBaseRemaining: toFixed(cost),
        originEventId: e.id
      };
      const lots = ensureLots(e.assetId);
      const pool = ensurePool(e.assetId);
      addLot(lots, lot);
      pool.amount = pool.amount.add(qty);
      pool.cost = pool.cost.add(cost);
      return;
    }

    if (e.type === 'REWARD' || e.type === 'STAKING_REWARD' || e.type === 'AIRDROP') {
      const qty = d(e.amount).abs();
      let cost = new Decimal(0);
      if (settings.rewardsCostBasisMode === 'FMV') {
        if (e.fmvTotalBase) cost = d(e.fmvTotalBase);
        else if (e.fmvPerUnitBase) cost = qty.mul(d(e.fmvPerUnitBase));
        else {
          warnings.push(`reward_missing_fmv:${e.id}`);
          cost = new Decimal(0);
        }
      }

      const lot: Lot = {
        lotId: `lot_${e.id}`,
        assetId: e.assetId,
        acquiredAtISO: e.timestampISO,
        amountRemaining: toFixed(qty),
        costBasisBaseRemaining: toFixed(cost),
        originEventId: e.id
      };
      const lots = ensureLots(e.assetId);
      const pool = ensurePool(e.assetId);
      addLot(lots, lot);
      pool.amount = pool.amount.add(qty);
      pool.cost = pool.cost.add(cost);
      return;
    }

    if (e.type === 'SELL') {
      const qty = d(e.amount).abs();
      const px = d(e.pricePerUnitBase).abs();
      const gross = qty.mul(px);
      const proceeds = gross.sub(fee); // SELL disposal fee -> proceeds reduction

      const lots = ensureLots(e.assetId);
      let costBasis: Decimal;
      let matched: { lotId: string; amount: Decimal; costBasisBase: Decimal }[] = [];

      if (settings.lotMethodDefault === 'AVG_COST') {
        const pool = ensurePool(e.assetId);
        const avg = pool.amount.gt(0) ? pool.cost.div(pool.amount) : new Decimal(0);
        costBasis = qty.mul(avg);
        pool.amount = pool.amount.sub(qty);
        pool.cost = pool.cost.sub(costBasis);
        matched = [{ lotId: 'avg_cost_pool', amount: qty, costBasisBase: costBasis }];
        // Also reduce actual lots using FIFO to keep inventory consistent
        pickLots(lots, qty, 'FIFO', warnings);
      } else {
        const pick = pickLots(lots, qty, settings.lotMethodDefault, warnings);
        costBasis = pick.costBasisBase;
        matched = pick.matched;
        const pool = ensurePool(e.assetId);
        pool.amount = pool.amount.sub(qty);
        pool.cost = pool.cost.sub(costBasis);
      }

      const gain = proceeds.sub(costBasis);
      realized = realized.add(gain);
      disposals.push({
        eventId: e.id,
        assetId: e.assetId,
        disposedAtISO: e.timestampISO,
        amount: toFixed(qty),
        proceedsBase: toFixed(proceeds),
        costBasisBase: toFixed(costBasis),
        feeBase: toFixed(fee),
        realizedGainBase: toFixed(gain),
        lotsMatched: matched.map((m) => ({
          lotId: m.lotId,
          amount: toFixed(m.amount),
          costBasisBase: toFixed(m.costBasisBase)
        })),
        taxYear: yearFromISO(e.timestampISO)
      });
      return;
    }

    if (e.type === 'SWAP') {
      const qtyIn = d(e.amount).abs();
      const qtyOut = d(e.amountOut).abs();
      const valuationStr = (e as any).valuationBase as string | undefined;
      const valuation = valuationStr ? d(valuationStr) : new Decimal(0);
      if (!valuation || valuation.isZero()) warnings.push(`swap_missing_valuation:${e.id}`);
      const gross = valuation.abs();
      const proceeds = gross.sub(fee); // swap disposal fee reduces proceeds

      // Dispose assetIn
      const lotsIn = ensureLots(e.assetId);
      let costBasis: Decimal;
      let matched: { lotId: string; amount: Decimal; costBasisBase: Decimal }[] = [];
      if (settings.lotMethodDefault === 'AVG_COST') {
        const pool = ensurePool(e.assetId);
        const avg = pool.amount.gt(0) ? pool.cost.div(pool.amount) : new Decimal(0);
        costBasis = qtyIn.mul(avg);
        pool.amount = pool.amount.sub(qtyIn);
        pool.cost = pool.cost.sub(costBasis);
        matched = [{ lotId: 'avg_cost_pool', amount: qtyIn, costBasisBase: costBasis }];
        pickLots(lotsIn, qtyIn, 'FIFO', warnings);
      } else {
        const pick = pickLots(lotsIn, qtyIn, settings.lotMethodDefault, warnings);
        costBasis = pick.costBasisBase;
        matched = pick.matched;
        const pool = ensurePool(e.assetId);
        pool.amount = pool.amount.sub(qtyIn);
        pool.cost = pool.cost.sub(costBasis);
      }
      const gain = proceeds.sub(costBasis);
      realized = realized.add(gain);
      disposals.push({
        eventId: e.id,
        assetId: e.assetId,
        disposedAtISO: e.timestampISO,
        amount: toFixed(qtyIn),
        proceedsBase: toFixed(proceeds),
        costBasisBase: toFixed(costBasis),
        feeBase: toFixed(fee),
        realizedGainBase: toFixed(gain),
        lotsMatched: matched.map((m) => ({
          lotId: m.lotId,
          amount: toFixed(m.amount),
          costBasisBase: toFixed(m.costBasisBase)
        })),
        taxYear: yearFromISO(e.timestampISO)
      });

      // Acquire assetOut (fee is applied to disposal leg only)
      const assetOutId = (e as any).assetOutId as string | undefined;
      const lotOut: Lot = {
        lotId: `lot_${e.id}_out`,
        assetId: assetOutId ?? 'unknown',
        acquiredAtISO: e.timestampISO,
        amountRemaining: toFixed(qtyOut),
        costBasisBaseRemaining: toFixed(gross),
        originEventId: e.id
      };
      if (!assetOutId) {
        warnings.push(`swap_missing_asset_out:${e.id}`);
        return;
      }
      const lotsOut = ensureLots(assetOutId);
      const poolOut = ensurePool(assetOutId);
      addLot(lotsOut, lotOut);
      poolOut.amount = poolOut.amount.add(qtyOut);
      poolOut.cost = poolOut.cost.add(gross);
      return;
    }

    if (e.type === 'TRANSFER') {
      const qtySigned = d(e.amount);
      const qty = qtySigned.abs();
      if (qty.isZero()) return;

      if (qtySigned.gt(0)) {
        const lot: Lot = {
          lotId: `lot_${e.id}`,
          assetId: e.assetId,
          acquiredAtISO: e.timestampISO,
          amountRemaining: toFixed(qty),
          costBasisBaseRemaining: '0',
          originEventId: e.id
        };
        const lots = ensureLots(e.assetId);
        const pool = ensurePool(e.assetId);
        addLot(lots, lot);
        pool.amount = pool.amount.add(qty);
      } else {
        const lots = ensureLots(e.assetId);
        const pick = pickLots(
          lots,
          qty,
          settings.lotMethodDefault === 'AVG_COST' ? 'FIFO' : settings.lotMethodDefault,
          warnings
        );
        const pool = ensurePool(e.assetId);
        pool.amount = pool.amount.sub(qty);
        pool.cost = pool.cost.sub(pick.costBasisBase);
      }
    }
  };

  return {
    applyEvent,
    getPositions: () => computePositions(lotsByAssetId),
    getRealizedPnlBaseToDate: () => toFixed(realized),
    getLotsByAssetId: () => lotsByAssetId,
    getDisposals: () => disposals,
    getWarnings: () => warnings
  };
}

export function replayLedgerToLotsAndDisposals(
  allEvents: LedgerEvent[],
  settings: Settings
): ReplayResult {
  const events = normalizeActiveLedger(allEvents);
  const engine = createLotEngine(settings);
  for (const e of events) engine.applyEvent(e);

  return {
    lotsByAssetId: engine.getLotsByAssetId(),
    disposals: engine.getDisposals(),
    positions: engine.getPositions(),
    realizedPnlBase: engine.getRealizedPnlBaseToDate(),
    warnings: engine.getWarnings()
  };
}
