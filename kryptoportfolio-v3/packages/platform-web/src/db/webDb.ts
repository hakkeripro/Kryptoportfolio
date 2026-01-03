import Dexie, { type Table } from 'dexie';
import type { Asset } from '@kp/core';
import type { Account } from '@kp/core';
import type { Settings } from '@kp/core';
import type { LedgerEvent } from '@kp/core';
import type { Alert, PricePoint, PortfolioSnapshot } from '@kp/core';

export type KeyValue = { key: string; value: string };

export class WebDb extends Dexie {
  meta!: Table<KeyValue, string>;
  assets!: Table<Asset, string>;
  accounts!: Table<Account, string>;
  settings!: Table<Settings, string>;
  ledgerEvents!: Table<LedgerEvent, string>;
  alerts!: Table<Alert, string>;
  pricePoints!: Table<PricePoint, string>;
  portfolioSnapshots!: Table<PortfolioSnapshot, string>;

  constructor(name = 'kp_web_v3') {
    super(name);
    this.version(1).stores({
      meta: '&key',
      assets: '&id, symbol, name',
      accounts: '&id, type, name',
      settings: '&id',
      ledgerEvents: '&id, type, timestampISO, assetId, externalRef, replacesEventId, isDeleted',
      alerts: '&id, type, assetId, isEnabled'
    });

    // v2: derived caches (non-authoritative)
    this.version(2).stores({
      meta: '&key',
      assets: '&id, symbol, name',
      accounts: '&id, type, name',
      settings: '&id',
      ledgerEvents: '&id, type, timestampISO, assetId, externalRef, replacesEventId, isDeleted',
      alerts: '&id, type, assetId, isEnabled',
      pricePoints: '&id, assetId, provider, timestampISO',
      portfolioSnapshots: '&dayISO'
    });
  }
}

let singleton: WebDb | null = null;

export function getWebDb(): WebDb {
  if (!singleton) singleton = new WebDb();
  return singleton;
}

export async function ensureWebDbOpen() {
  const db = getWebDb();
  if (!db.isOpen()) await db.open();
  return db;
}

export async function getMeta(key: string): Promise<string | null> {
  await ensureWebDbOpen();
  const db = getWebDb();
  const row = await db.meta.get(key);
  return row?.value ?? null;
}

export async function setMeta(key: string, value: string): Promise<void> {
  await ensureWebDbOpen();
  const db = getWebDb();
  await db.meta.put({ key, value });
}
