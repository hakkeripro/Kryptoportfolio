import { ensureWebDbOpen, getWebDb, setMeta } from '@kp/platform-web';
import type { PricePoint } from '@kp/core';
import { coingeckoSimplePrice } from '../integrations/coingecko/coingeckoApi';
import { rebuildDerivedCaches } from './rebuildDerived';

// CoinGecko free tier has practical request limits; chunk ids to avoid long URLs.
const CHUNK = 100;

export type RefreshLivePricesResult = {
  fetched: number;
  stored: number;
  timestampISO: string;
};

export async function refreshLivePrices(apiBase: string, baseCurrency: string): Promise<RefreshLivePricesResult> {
  await ensureWebDbOpen();
  const db = getWebDb();

  const assets = await db.assets.toArray();
  const mapped = assets
    .map((a) => ({ assetId: a.id, cg: a.providerRef?.coingeckoId }))
    .filter((x) => !!x.cg);

  const timestampISO = new Date().toISOString();
  let fetched = 0;
  let stored = 0;

  for (let i = 0; i < mapped.length; i += CHUNK) {
    const chunk = mapped.slice(i, i + CHUNK);
    const ids = chunk.map((x) => x.cg!) as string[];
    const prices = await coingeckoSimplePrice(apiBase, ids, baseCurrency);
    fetched += Object.keys(prices).length;

    const points: PricePoint[] = [];
    for (const it of chunk) {
      const p = prices[it.cg!];
      if (typeof p !== 'number') continue;
      points.push({
        id: `pp_live_cg_${it.assetId}_${timestampISO}`,
        assetId: it.assetId,
        provider: 'coingecko',
        source: 'live',
        timestampISO,
        priceBase: String(p),
        createdAtISO: timestampISO,
        updatedAtISO: timestampISO
      });
    }

    if (points.length) {
      await db.pricePoints.bulkPut(points);
      stored += points.length;
    }
  }

  if (stored > 0) {
    await setMeta('prices:lastRefreshISO', timestampISO);
    // Keep portfolio/dashboards consistent without requiring a full page reload.
    await rebuildDerivedCaches({ daysBack: 365 });
  }

  return { fetched, stored, timestampISO };
}
