import type { Asset, Settings, PortfolioSnapshot } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from './useDbQuery';

export interface DashboardData {
  settings: Settings | null;
  latest: PortfolioSnapshot | null;
  snaps: PortfolioSnapshot[];
  assets: Asset[];
}

const DEFAULT: DashboardData = {
  settings: null,
  latest: null,
  snaps: [],
  assets: [],
};

export function useDashboardData() {
  return useDbQuery<DashboardData>(
    async (db) => {
      await ensureWebDbOpen();
      const settings = (await db.settings.get('settings_1')) ?? (await ensureDefaultSettings());
      const latest = (await db.portfolioSnapshots.orderBy('dayISO').last()) ?? null;
      const snaps = await db.portfolioSnapshots.orderBy('dayISO').reverse().limit(120).toArray();
      const assets = await db.assets.toArray();
      return { settings, latest, snaps: snaps.reverse(), assets } as DashboardData;
    },
    [],
    DEFAULT,
  );
}
