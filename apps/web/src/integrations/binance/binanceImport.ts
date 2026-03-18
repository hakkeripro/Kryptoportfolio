/**
 * Binance import: converts BinanceRawEvent[] to LedgerEvent[] and commits to DB.
 * Uses externalRef for deduplication (append-only).
 */
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { uuid, lookupKnownAsset, inferAssetType, type LedgerEvent } from '@kp/core';
import type { BinanceRawEvent } from '@kp/core';

export type BinanceImportResult = {
  createdAssets: number;
  createdAccount: boolean;
  createdLedgerEvents: number;
  skippedDuplicates: number;
};

export type BinanceImportPreview = {
  events: LedgerEvent[];
  newEvents: LedgerEvent[];
  duplicateExternalRefs: string[];
  rawCount: number;
  issues: { type: string; message: string }[];
};

function assetId(symbol: string): string {
  return `asset_${symbol.toLowerCase()}`;
}

function now(): string {
  return new Date().toISOString();
}

/** Convert BinanceRawEvent[] → LedgerEvent[] (no DB access) */
export function buildBinancePreviewEvents(rawEvents: BinanceRawEvent[]): LedgerEvent[] {
  const ts = now();
  const events: LedgerEvent[] = [];

  for (const raw of rawEvents) {
    const base: Omit<LedgerEvent, 'type'> & { type: string } = {
      id: uuid(),
      schemaVersion: 1,
      createdAtISO: ts,
      updatedAtISO: ts,
      type: 'BUY',
      timestampISO: raw.timestampISO,
      accountId: 'acct_binance',
      assetId: assetId(raw.coin),
      amount: raw.amount,
      externalRef: raw.externalRef,
    };

    if (raw.operation === 'BUY' || raw.operation === 'SELL') {
      const pricePerUnit =
        raw.pairedAmount && raw.amount
          ? String(parseFloat(raw.pairedAmount) / parseFloat(raw.amount))
          : '0';
      events.push({
        ...base,
        type: raw.operation as 'BUY' | 'SELL',
        pricePerUnitBase: pricePerUnit,
        feeAssetId: raw.feeCoin ? assetId(raw.feeCoin) : undefined,
        feeAmount: raw.feeAmount,
        feeValueBase: undefined, // FMV unknown at import time
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'DEPOSIT') {
      events.push({
        ...base,
        type: 'TRANSFER',
        amount: raw.amount,
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'WITHDRAW') {
      events.push({
        ...base,
        type: 'TRANSFER',
        amount: raw.amount,
        side: 'out',
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'STAKING_REWARD') {
      events.push({
        ...base,
        type: 'STAKING_REWARD',
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'AIRDROP') {
      events.push({
        ...base,
        type: 'AIRDROP',
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'SWAP') {
      events.push({
        ...base,
        type: 'SWAP',
        assetOutId: raw.pairedCoin ? assetId(raw.pairedCoin) : assetId(raw.coin),
        amountOut: raw.pairedAmount ?? raw.amount,
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'REWARD') {
      events.push({
        ...base,
        type: 'REWARD',
      } as unknown as LedgerEvent);
    }
    // Unknown operations are skipped
  }

  return events;
}

async function ensureBinanceAccount(nowTs: string): Promise<boolean> {
  const db = getWebDb();
  const existing = await db.accounts.get('acct_binance');
  if (existing) return false;
  await db.accounts.add({
    id: 'acct_binance',
    schemaVersion: 1,
    createdAtISO: nowTs,
    updatedAtISO: nowTs,
    name: 'Binance',
    type: 'exchange',
    isActive: true,
    notes: 'Imported via Binance API',
  } as any);
  return true;
}

async function ensureAssets(assetIds: string[], nowTs: string): Promise<number> {
  const db = getWebDb();
  const existing = await db.assets.bulkGet(assetIds);
  const toCreate: any[] = [];
  for (let i = 0; i < assetIds.length; i++) {
    const id = assetIds[i]!;
    if (existing[i]) continue;
    const symbol = id.replace(/^asset_/, '').toUpperCase();
    const known = lookupKnownAsset(symbol);
    toCreate.push({
      id,
      schemaVersion: 1,
      createdAtISO: nowTs,
      updatedAtISO: nowTs,
      symbol,
      name: known?.name ?? symbol,
      type: known?.type ?? inferAssetType(symbol),
      providerRef: {},
      isActive: true,
    });
  }
  if (toCreate.length) await db.assets.bulkAdd(toCreate);
  return toCreate.length;
}

export async function computeBinanceDedupe(events: LedgerEvent[]): Promise<{
  newEvents: LedgerEvent[];
  duplicateExternalRefs: string[];
}> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const refs = events.map((e) => e.externalRef).filter(Boolean) as string[];
  if (!refs.length) return { newEvents: events, duplicateExternalRefs: [] };
  const existing = await db.ledgerEvents.where('externalRef').anyOf(refs).toArray();
  const existingRefs = new Set(existing.map((e) => String((e as any).externalRef ?? '')));
  const newEvents = events.filter((e) => e.externalRef && !existingRefs.has(e.externalRef));
  const dupRefs = events
    .filter((e) => e.externalRef && existingRefs.has(e.externalRef))
    .map((e) => e.externalRef!);
  return { newEvents, duplicateExternalRefs: dupRefs };
}

export async function commitBinanceImport(events: LedgerEvent[]): Promise<BinanceImportResult> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const nowTs = now();

  const createdAccount = await ensureBinanceAccount(nowTs);

  const { newEvents, duplicateExternalRefs } = await computeBinanceDedupe(events);

  const touchedAssetIds = new Set<string>();
  for (const e of newEvents) {
    if (e.assetId) touchedAssetIds.add(e.assetId);
    if (e.type === 'SWAP') touchedAssetIds.add((e as any).assetOutId);
    if ((e as any).feeAssetId) touchedAssetIds.add((e as any).feeAssetId);
  }
  const createdAssets = await ensureAssets([...touchedAssetIds], nowTs);

  await db.transaction('rw', db.ledgerEvents, async () => {
    if (newEvents.length) await db.ledgerEvents.bulkAdd(newEvents as any);
  });

  return {
    createdAssets,
    createdAccount,
    createdLedgerEvents: newEvents.length,
    skippedDuplicates: duplicateExternalRefs.length,
  };
}
