import Decimal from 'decimal.js';
import { addDays, formatISO, parseISO, startOfDay } from 'date-fns';
import type { LedgerEvent } from '../domain/ledger.js';
import { feeValueBaseOrZero, normalizeActiveLedger } from '../domain/ledger.js';
import type { PricePoint } from '../domain/price.js';
import type { PortfolioSnapshot, TxMarker } from '../domain/portfolio.js';
import type { Settings } from '../domain/settings.js';
import { createLotEngine } from './lotEngine.js';

function d(s: string | undefined | null): Decimal {
  if (!s) return new Decimal(0);
  return new Decimal(s);
}

function toFixed(x: Decimal): string {
  const s = x.toFixed();
  return s === '-0' ? '0' : s;
}

export function inferImportedPricePointsFromLedger(
  allEvents: LedgerEvent[],
  opts: { provider?: string }
): PricePoint[] {
  const provider = opts.provider ?? 'import:ledger';
  const events = normalizeActiveLedger(allEvents);
  const out: PricePoint[] = [];
  const now = new Date().toISOString();

  const push = (assetId: string, timestampISO: string, priceBase: Decimal, source: PricePoint['source']) => {
    if (!priceBase.isFinite() || priceBase.lte(0)) return;
    out.push({
      id: `pp_${provider}_${assetId}_${timestampISO}`,
      schemaVersion: 1,
      createdAtISO: now,
      updatedAtISO: now,
      assetId,
      provider,
      timestampISO,
      priceBase: toFixed(priceBase),
      source
    });
  };

  for (const e of events) {
    if (e.type === 'BUY' || e.type === 'SELL') {
      push(e.assetId, e.timestampISO, d(e.pricePerUnitBase).abs(), 'imported');
    } else if (e.type === 'SWAP') {
      const valuation = d((e as any).valuationBase).abs();
      const amtIn = d(e.amount).abs();
      const amtOut = d((e as any).amountOut).abs();
      if (amtIn.gt(0) && valuation.gt(0)) push(e.assetId, e.timestampISO, valuation.div(amtIn), 'imported');
      if (amtOut.gt(0) && valuation.gt(0)) push((e as any).assetOutId, e.timestampISO, valuation.div(amtOut), 'imported');
    } else if (e.type === 'TRANSFER') {
      // Sometimes transfers include a fiat native_amount valuation from the exchange; treat it as an imported price.
      const anyNative = (e as any).nativeAmountBase ? d((e as any).nativeAmountBase) : null;
      if (anyNative && d(e.amount).abs().gt(0)) {
        push(e.assetId, e.timestampISO, anyNative.abs().div(d(e.amount).abs()), 'imported');
      }
    }
  }

  // De-dupe by (assetId,timestampISO) keep latest updatedAt
  const seen = new Map<string, PricePoint>();
  for (const p of out) {
    const k = `${p.assetId}:${p.timestampISO}`;
    const prev = seen.get(k);
    if (!prev) seen.set(k, p);
  }
  return [...seen.values()].sort((a, b) => a.timestampISO.localeCompare(b.timestampISO));
}

export function rebuildPortfolioSnapshots(
  allEvents: LedgerEvent[],
  settings: Settings,
  pricePoints: PricePoint[],
  opts: { daysBack?: number; rangeStartDayISO?: string }
): PortfolioSnapshot[] {
  const events = normalizeActiveLedger(allEvents);
  if (!events.length) return [];

  // Determine snapshot range (we always replay the full ledger for correctness,
  // but we only emit snapshots for the requested range for performance).
  const lastEvent = events.at(-1);
  const firstEvent = events[0];
  if (!lastEvent || !firstEvent) return [];

  const lastDay = startOfDay(parseISO(lastEvent.timestampISO));
  const firstEventDay = startOfDay(parseISO(firstEvent.timestampISO));
  const daysBack = opts.daysBack ?? 365;
  const rangeStart = startOfDay(addDays(lastDay, -daysBack));
  let start = rangeStart > firstEventDay ? rangeStart : firstEventDay;
  if (opts.rangeStartDayISO) {
    const forced = startOfDay(parseISO(`${opts.rangeStartDayISO}T00:00:00.000Z`));
    // Incremental rebuild: if the earliest changed day is within our snapshot range,
    // we can emit snapshots only from that day onwards. If it is before our range,
    // we still must rebuild the whole range (but we don't need to emit older days).
    if (forced > start) start = forced;
  }

  // Index price points per asset sorted
  const pricesByAsset: Record<string, PricePoint[]> = {};
  for (const p of pricePoints) (pricesByAsset[p.assetId] ??= []).push(p);
  for (const arr of Object.values(pricesByAsset)) arr.sort((a, b) => a.timestampISO.localeCompare(b.timestampISO));

  // Marker index: dayISO -> markers
  const markersByDay: Record<string, TxMarker[]> = {};
  for (const e of events) {
    const fee = d(feeValueBaseOrZero(e)).abs();
    const valueBase = (() => {
      if (e.type === 'BUY' || e.type === 'SELL') {
        return toFixed(d(e.amount).abs().mul(d(e.pricePerUnitBase).abs()).add(e.type === 'BUY' ? fee : fee.neg()));
      }
      if (e.type === 'SWAP') return (e as any).valuationBase ? toFixed(d((e as any).valuationBase).abs()) : undefined;
      return undefined;
    })();
    const dayISO = e.timestampISO.slice(0, 10);
    (markersByDay[dayISO] ??= []).push({
      eventId: e.id,
      type: e.type,
      timestampISO: e.timestampISO,
      assetId: e.assetId ?? 'unknown',
      ...(valueBase ? { valueBase } : {})
    });
  }

  // Precompute rolling latest prices per asset per day.
  const priceCursor: Record<string, number> = {};
  const priceLatest: Record<string, Decimal> = {};
  const updateLatestPrices = (dayEndISO: string) => {
    for (const [assetId, arr] of Object.entries(pricesByAsset)) {
      let i = priceCursor[assetId] ?? 0;
      while (i < arr.length && arr[i]!.timestampISO < dayEndISO) {
        priceLatest[assetId] = d(arr[i]!.priceBase);
        i++;
      }
      priceCursor[assetId] = i;
    }
  };

  // Streaming rebuild: replay events once and advance day-by-day.
  // This avoids O(days * events) filtering.
  const snaps: PortfolioSnapshot[] = [];
  let eventIdx = 0;
  const engine = createLotEngine(settings);

  const startISO = start.toISOString();
  while (eventIdx < events.length && events[eventIdx]!.timestampISO < startISO) {
    engine.applyEvent(events[eventIdx]!);
    eventIdx++;
  }

  // From 'start' to lastDay emit snapshots.
  for (let day = start; day <= lastDay; day = addDays(day, 1)) {
    const dayEndISO = addDays(day, 1).toISOString();

    // Apply events that occurred during this day.
    while (eventIdx < events.length && events[eventIdx]!.timestampISO < dayEndISO) {
      engine.applyEvent(events[eventIdx]!);
      eventIdx++;
    }

    updateLatestPrices(dayEndISO);

    let total = new Decimal(0);
    const positions = engine.getPositions();
    const pos = positions.map((p) => {
      const price = priceLatest[p.assetId] ?? null;
      const amount = d(p.amount);
      const cost = d(p.costBasisBase);
      const value = price ? amount.mul(price) : cost;
      const unrl = value.sub(cost);
      total = total.add(value);
      return {
        assetId: p.assetId,
        amount: toFixed(amount),
        valueBase: toFixed(value),
        costBasisBase: toFixed(cost),
        unrealizedPnlBase: toFixed(unrl)
      };
    });

    const dayISO = formatISO(day, { representation: 'date' });
    const dayMarkers = markersByDay[dayISO] ?? [];
    const unrealized = pos.reduce((acc, p) => acc.add(d(p.unrealizedPnlBase)), new Decimal(0));

    snaps.push({
      dayISO,
      totalValueBase: toFixed(total),
      realizedPnlBaseToDate: engine.getRealizedPnlBaseToDate(),
      unrealizedPnlBase: toFixed(unrealized),
      positions: pos,
      txMarkers: dayMarkers
    });
  }

  return snaps;
}
