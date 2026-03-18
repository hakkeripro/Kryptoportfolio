import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { uuid, lookupKnownAsset, inferAssetType, type LedgerEvent } from '@kp/core';
import type { KrakenRawEvent } from '@kp/core';

export type KrakenImportResult = {
  createdAssets: number;
  createdAccount: boolean;
  createdLedgerEvents: number;
  skippedDuplicates: number;
};

function assetId(symbol: string): string {
  return `asset_${symbol.toLowerCase()}`;
}

function nowTs(): string {
  return new Date().toISOString();
}

export function buildKrakenPreviewEvents(rawEvents: KrakenRawEvent[]): LedgerEvent[] {
  const ts = nowTs();
  const events: LedgerEvent[] = [];

  for (const raw of rawEvents) {
    const base = {
      id: uuid(),
      schemaVersion: 1,
      createdAtISO: ts,
      updatedAtISO: ts,
      timestampISO: raw.timestampISO,
      accountId: 'acct_kraken',
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
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'DEPOSIT' || raw.operation === 'WITHDRAW') {
      events.push({
        ...base,
        type: 'TRANSFER',
        feeAssetId: raw.feeCoin ? assetId(raw.feeCoin) : undefined,
        feeAmount: raw.feeAmount,
      } as unknown as LedgerEvent);
    } else if (raw.operation === 'STAKING_REWARD') {
      events.push({ ...base, type: 'STAKING_REWARD' } as unknown as LedgerEvent);
    } else if (raw.operation === 'AIRDROP') {
      events.push({ ...base, type: 'AIRDROP' } as unknown as LedgerEvent);
    }
  }

  return events;
}

async function ensureKrakenAccount(ts: string): Promise<boolean> {
  const db = getWebDb();
  const existing = await db.accounts.get('acct_kraken');
  if (existing) return false;
  await db.accounts.add({
    id: 'acct_kraken',
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    name: 'Kraken',
    type: 'exchange',
    isActive: true,
    notes: 'Imported via Kraken API',
  } as any);
  return true;
}

async function ensureAssets(assetIds: string[], ts: string): Promise<number> {
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
      createdAtISO: ts,
      updatedAtISO: ts,
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

export async function computeKrakenDedupe(events: LedgerEvent[]): Promise<{
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

export async function commitKrakenImport(events: LedgerEvent[]): Promise<KrakenImportResult> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const ts = nowTs();

  const createdAccount = await ensureKrakenAccount(ts);
  const { newEvents, duplicateExternalRefs } = await computeKrakenDedupe(events);

  const touchedAssetIds = new Set<string>();
  for (const e of newEvents) {
    if (e.assetId) touchedAssetIds.add(e.assetId);
    if ((e as any).feeAssetId) touchedAssetIds.add((e as any).feeAssetId);
  }
  const createdAssets = await ensureAssets([...touchedAssetIds], ts);

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
