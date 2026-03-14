import type { Asset, Settings, LedgerEvent, PortfolioSnapshot } from '@kp/core';
import { ensureWebDbOpen } from '@kp/platform-web';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import { useDbQuery } from './useDbQuery';

export interface PortfolioData {
  settings: Settings | null;
  baseCurrency: string;
  accounts: Array<{ id: string; name: string }>;
  assets: Asset[];
  latest: PortfolioSnapshot | null;
  events: LedgerEvent[];
}

const DEFAULT: PortfolioData = {
  settings: null,
  baseCurrency: 'EUR',
  accounts: [],
  assets: [],
  latest: null,
  events: [],
};

export function usePortfolioData() {
  return useDbQuery<PortfolioData>(
    async (db) => {
      await ensureWebDbOpen();
      const settings = (await db.settings.get('settings_1')) ?? (await ensureDefaultSettings());
      const baseCurrency = String(settings.baseCurrency ?? 'EUR').toUpperCase();
      const accounts = await db.accounts.toArray();
      const assets = await db.assets.toArray();
      const latest = (await db.portfolioSnapshots.orderBy('dayISO').last()) ?? null;
      const events = await db.ledgerEvents.toArray();
      return { settings, baseCurrency, accounts, assets, latest, events } as PortfolioData;
    },
    [],
    DEFAULT,
  );
}
