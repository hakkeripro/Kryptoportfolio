import Decimal from 'decimal.js';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { MirrorState, PortfolioSnapshot, PricePoint } from '@kp/core';
import { MirrorStateSchema } from '@kp/core';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';

function isoFromDay(dayISO: string) {
  // dayISO is "YYYY-MM-DD"; convert to midnight UTC ISO
  return `${dayISO}T00:00:00.000Z`;
}

export async function buildMirrorState(): Promise<MirrorState> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const settings = await ensureDefaultSettings();
  const baseCurrency = settings.baseCurrency || 'EUR';

  const nowISO = new Date().toISOString();

  const snapshots = (await db.portfolioSnapshots.orderBy('dayISO').toArray()) as PortfolioSnapshot[];
  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;

  let peakValue = new Decimal(0);
  for (const s of snapshots) {
    const v = new Decimal(s.totalValueBase || '0');
    if (v.greaterThan(peakValue)) peakValue = v;
  }

  const portfolioValueBase = latest?.totalValueBase ?? '0';
  const peakPortfolioValueBase = peakValue.toFixed();

  const allocationPct: Record<string, string> = {};
  if (latest && new Decimal(latest.totalValueBase || '0').greaterThan(0)) {
    const total = new Decimal(latest.totalValueBase);
    for (const p of latest.positions) {
      const v = new Decimal(p.valueBase || '0');
      if (v.lte(0)) continue;
      allocationPct[p.assetId] = v.div(total).times(100).toFixed(6);
    }
  }

  const pricePoints = (await db.pricePoints.toArray()) as PricePoint[];

  const assetPrices: Record<string, string> = {};
  const priceHistory: Record<string, { timestampISO: string; priceBase: string }[]> = {};

  // latest price per asset + a tiny history (first+last within last 7 days) for pct-change alerts.
  const byAsset: Record<string, PricePoint[]> = {};
  for (const pp of pricePoints) {
    if (!pp.assetId) continue;
    (byAsset[pp.assetId] ||= []).push(pp);
  }

  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  for (const [assetId, arr] of Object.entries(byAsset)) {
    arr.sort((a, b) => String(a.timestampISO).localeCompare(String(b.timestampISO)));
    const last = arr[arr.length - 1];
    if (last?.priceBase) assetPrices[assetId] = String(last.priceBase);

    const inWeek = arr.filter((p) => {
      const t = Date.parse(String(p.timestampISO));
      return Number.isFinite(t) && t >= weekAgo;
    });
    if (inWeek.length >= 2) {
      const first = inWeek[0];
      const lastW = inWeek[inWeek.length - 1];
      priceHistory[assetId] = [
        { timestampISO: String(first.timestampISO), priceBase: String(first.priceBase) },
        { timestampISO: String(lastW.timestampISO), priceBase: String(lastW.priceBase) }
      ];
    }
  }

  const portfolioHistory = snapshots
    .slice(Math.max(0, snapshots.length - 60))
    .map((s) => ({ timestampISO: isoFromDay(s.dayISO), valueBase: String(s.totalValueBase) }));

  const state: MirrorState = {
    baseCurrency,
    provider: 'kp-web',
    nowISO,
    portfolioValueBase,
    peakPortfolioValueBase,
    portfolioHistory,
    assetPrices,
    priceHistory,
    allocationPct
  };

  // Validate and return normalized output
  return MirrorStateSchema.parse(state);
}
