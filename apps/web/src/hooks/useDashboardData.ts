import type { Asset, Settings, PortfolioSnapshot, PricePoint } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from './useDbQuery';

export interface DashboardData {
  settings: Settings | null;
  latest: PortfolioSnapshot | null;
  snaps: PortfolioSnapshot[];
  assets: Asset[];
  ledgerEventCount: number;
  recentPricePoints: PricePoint[];
}

const DEFAULT: DashboardData = {
  settings: null,
  latest: null,
  snaps: [],
  assets: [],
  ledgerEventCount: 0,
  recentPricePoints: [],
};

export function useDashboardData() {
  return useDbQuery<DashboardData>(
    async (db) => {
      await ensureWebDbOpen();
      const settings = (await db.settings.get('settings_1')) ?? (await ensureDefaultSettings());
      const latest = (await db.portfolioSnapshots.orderBy('dayISO').last()) ?? null;
      const snaps = await db.portfolioSnapshots.orderBy('dayISO').reverse().limit(120).toArray();
      const assets = await db.assets.toArray();
      const ledgerEventCount = await db.ledgerEvents
        .filter((e) => !e.isDeleted)
        .count();
      // Recent 2 days of live price points for 24h change calculation
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const recentPricePoints = await db.pricePoints
        .where('timestampISO')
        .aboveOrEqual(twoDaysAgo)
        .filter((p) => p.provider === 'live')
        .toArray();
      return {
        settings,
        latest,
        snaps: snaps.reverse(),
        assets,
        ledgerEventCount,
        recentPricePoints,
      } as DashboardData;
    },
    [],
    DEFAULT,
  );
}
