import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import type { CoinbaseTransaction } from './coinbaseApi';
import {
  inferAssetType,
  lookupKnownAsset,
  mapCoinbaseV2TransactionsToLedger,
  type CoinbaseV2ImportItem,
  type FxRatesToBase,
  type ImportIssue,
  type LedgerEvent,
  type Settings
} from '@kp/core';

export type CoinbaseImportResult = {
  createdAssets: number;
  createdAccount: boolean;
  createdLedgerEvents: number;
  skippedDuplicates: number;
};

export type CoinbaseImportOverrides = {
  fxRatesToBase: FxRatesToBase;
  feeValueBaseByRefKey?: Record<string, string>;
  tradeValuationBaseByTradeKey?: Record<string, string>;
  rewardFmvTotalBaseByTxId?: Record<string, string>;
};

export type CoinbaseImportPreview = {
  baseCurrency: string;
  events: LedgerEvent[];
  issues: ImportIssue[];
  newEvents: LedgerEvent[];
  duplicateExternalRefs: string[];
  touchedAssetIds: string[];
  rawCount: number;
};

export function assetIdForCurrency(code: string): string {
  return `asset_${code.trim().toLowerCase()}`;
}

export function buildCoinbaseImportPreview(args: {
  items: { accountId: string; tx: CoinbaseTransaction }[];
  baseCurrency: string;
  settings: Settings;
  overrides: CoinbaseImportOverrides;
}): CoinbaseImportPreview {
  const items: CoinbaseV2ImportItem[] = args.items.map((it) => ({ accountId: it.accountId, tx: it.tx }));
  const r = mapCoinbaseV2TransactionsToLedger(items, {
    baseCurrency: args.baseCurrency,
    currencyToAssetId: assetIdForCurrency,
    fxRatesToBase: args.overrides.fxRatesToBase,
    settings: args.settings,
    ledgerAccountId: 'acct_coinbase',
    overrides: {
      feeValueBaseByRefKey: args.overrides.feeValueBaseByRefKey,
      tradeValuationBaseByTradeKey: args.overrides.tradeValuationBaseByTradeKey,
      rewardFmvTotalBaseByTxId: args.overrides.rewardFmvTotalBaseByTxId
    }
  });

  const touchedAssetIds = new Set<string>();
  for (const e of r.events) {
    if (e.assetId) touchedAssetIds.add(e.assetId);
    if (e.type === 'SWAP') touchedAssetIds.add((e as any).assetOutId);
    if ((e as any).feeAssetId) touchedAssetIds.add((e as any).feeAssetId);
  }

  return {
    baseCurrency: args.baseCurrency.toUpperCase(),
    events: r.events,
    issues: r.issues,
    newEvents: r.events, // filtered during commit when DB is available
    duplicateExternalRefs: [],
    touchedAssetIds: [...touchedAssetIds],
    rawCount: args.items.length
  };
}

async function ensureCoinbaseAccount(now: string): Promise<boolean> {
  const db = getWebDb();
  const existing = await db.accounts.get('acct_coinbase');
  if (existing) return false;
  await db.accounts.add({
    id: 'acct_coinbase',
    schemaVersion: 1,
    createdAtISO: now,
    updatedAtISO: now,
    name: 'Coinbase',
    type: 'exchange',
    isActive: true,
    notes: 'Imported via Coinbase API'
  } as any);
  return true;
}

async function ensureAssets(assetIds: string[], now: string): Promise<number> {
  const db = getWebDb();
  const existing = await db.assets.bulkGet(assetIds);
  const toCreate: any[] = [];

  for (let i = 0; i < assetIds.length; i++) {
    const id = assetIds[i];
    if (existing[i]) continue;
    const symbol = id.replace(/^asset_/, '').toUpperCase();
    const known = lookupKnownAsset(symbol);
    toCreate.push({
      id,
      schemaVersion: 1,
      createdAtISO: now,
      updatedAtISO: now,
      symbol,
      name: known?.name ?? symbol,
      type: known?.type ?? inferAssetType(symbol),
      // IMPORTANT: Do not guess provider ids from symbol. The user links coingeckoId manually in Assets.
      providerRef: {},
      isActive: true
    });
  }

  if (toCreate.length) {
    await db.assets.bulkAdd(toCreate);
  }
  return toCreate.length;
}

export async function commitCoinbaseImport(preview: CoinbaseImportPreview): Promise<CoinbaseImportResult> {
  await ensureWebDbOpen();
  const db = getWebDb();

  const now = new Date().toISOString();
  const createdAccount = await ensureCoinbaseAccount(now);

  // Deduplicate deterministically by externalRef.
  const externalRefs = preview.events.map((e) => e.externalRef).filter(Boolean) as string[];
  const existing = externalRefs.length
    ? await db.ledgerEvents.where('externalRef').anyOf(externalRefs).toArray()
    : [];
  const existingRefs = new Set(existing.map((e) => String((e as any).externalRef ?? '')));

  const newEvents = preview.events.filter((e) => e.externalRef && !existingRefs.has(e.externalRef));
  const dupRefs = preview.events
    .filter((e) => e.externalRef && existingRefs.has(e.externalRef))
    .map((e) => e.externalRef!) as string[];

  // Ensure required assets exist before inserting ledger events.
  const touchedAssetIds = new Set<string>(preview.touchedAssetIds);
  for (const e of newEvents) {
    if (e.assetId) touchedAssetIds.add(e.assetId);
    if (e.type === 'SWAP') touchedAssetIds.add((e as any).assetOutId);
    if ((e as any).feeAssetId) touchedAssetIds.add((e as any).feeAssetId);
  }
  const createdAssets = await ensureAssets([...touchedAssetIds], now);

  // Append-only: never overwrite existing rows.
  await db.transaction('rw', db.ledgerEvents, async () => {
    if (newEvents.length) {
      await db.ledgerEvents.bulkAdd(newEvents as any);
    }
  });

  return {
    createdAssets,
    createdAccount,
    createdLedgerEvents: newEvents.length,
    skippedDuplicates: dupRefs.length
  };
}

export async function computeCoinbaseDedupe(preview: CoinbaseImportPreview): Promise<CoinbaseImportPreview> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const externalRefs = preview.events.map((e) => e.externalRef).filter(Boolean) as string[];
  if (!externalRefs.length) {
    return { ...preview, newEvents: preview.events, duplicateExternalRefs: [] };
  }
  const existing = await db.ledgerEvents.where('externalRef').anyOf(externalRefs).toArray();
  const existingRefs = new Set(existing.map((e) => String((e as any).externalRef ?? '')));
  const newEvents = preview.events.filter((e) => e.externalRef && !existingRefs.has(e.externalRef));
  const dupRefs = preview.events.filter((e) => e.externalRef && existingRefs.has(e.externalRef)).map((e) => e.externalRef!) as string[];
  return { ...preview, newEvents, duplicateExternalRefs: dupRefs };
}
