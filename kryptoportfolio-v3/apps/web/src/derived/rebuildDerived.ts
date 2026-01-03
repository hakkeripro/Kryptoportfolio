import { inferImportedPricePointsFromLedger, rebuildPortfolioSnapshots } from '@kp/core';
import type { Settings } from '@kp/core';
import { ensureWebDbOpen, getMeta, getWebDb, setMeta } from '@kp/platform-web';
import { ensureDefaultSettings } from './ensureDefaultSettings';

export async function rebuildDerivedCaches(opts?: { daysBack?: number }) {
  await ensureWebDbOpen();
  const db = getWebDb();
  const settings = ((await db.settings.get('settings_1')) as Settings | undefined) ?? (await ensureDefaultSettings());

  const events = await db.ledgerEvents.toArray();

  // Performance: skip expensive rebuild when ledger hasn't changed.
  const maxUpdatedAtISO = events.reduce((acc, e: any) => {
    const t = String(e.updatedAtISO ?? e.timestampISO ?? '');
    return t > acc ? t : acc;
  }, '');
  const digest = `${events.length}:${maxUpdatedAtISO}`;
  const prev = await getMeta('derived:ledgerDigest');
  if (prev && String(prev) === digest) {
    await setMeta('derived:lastRebuildSkippedISO', new Date().toISOString());
    return;
  }

  // Incremental rebuild hint: find the earliest *transaction day* among events appended
  // since the last successful rebuild.
  const lastRebuildISO = (await getMeta('derived:lastRebuildISO')) ?? '';
  const newEvents = lastRebuildISO
    ? events.filter((e: any) => String(e.createdAtISO ?? '') > lastRebuildISO)
    : [];
  const earliestChangedTs = newEvents.reduce((acc: string | null, e: any) => {
    const ts = String(e.timestampISO ?? '');
    if (!ts) return acc;
    if (!acc) return ts;
    return ts < acc ? ts : acc;
  }, null);
  const earliestChangedDayISO = earliestChangedTs ? earliestChangedTs.slice(0, 10) : undefined;

  // Merge imported price points (deterministic from ledger)
  const imported = inferImportedPricePointsFromLedger(events, { provider: 'import:ledger' });
  await db.transaction('rw', db.pricePoints, db.portfolioSnapshots, async () => {
    await db.pricePoints.bulkPut(imported);
    const allPrices = await db.pricePoints.toArray();

    const snaps = rebuildPortfolioSnapshots(events, settings, allPrices, {
      daysBack: opts?.daysBack ?? 365,
      rangeStartDayISO: earliestChangedDayISO
    });

    // If we have an incremental range, replace only that suffix. If not, do a full rebuild.
    const regenFrom = snaps[0]?.dayISO;
    if (regenFrom && earliestChangedDayISO) {
      await db.portfolioSnapshots.where('dayISO').aboveOrEqual(regenFrom).delete();
    } else {
      await db.portfolioSnapshots.clear();
    }
    await db.portfolioSnapshots.bulkPut(snaps);
  });

  // For UI status badges and support.
  await setMeta('derived:lastRebuildISO', new Date().toISOString());
  await setMeta('derived:ledgerDigest', digest);
}
