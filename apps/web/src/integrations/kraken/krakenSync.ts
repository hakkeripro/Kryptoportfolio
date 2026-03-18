/**
 * Kraken incremental sync using offset-based pagination.
 * Fetches all ledger entries, using lastFetchedTs as start filter when available.
 */
import type { KrakenCredentials } from './krakenVault';
import { krakenFetchLedgers } from './krakenApi';
import { mapKrakenLedgerToEvents, type KrakenRawEvent, type KrakenLedgerEntry } from '@kp/core';

const PAGE_SIZE = 50; // Kraken default page size

export interface KrakenSyncResult {
  events: KrakenRawEvent[];
  issueCount: number;
  totalEntries: number;
}

export async function fetchKrakenNewest(
  apiBase: string,
  token: string,
  creds: KrakenCredentials,
  lastFetchedTs?: number,
): Promise<KrakenSyncResult> {
  const allEntries: KrakenLedgerEntry[] = [];

  // First page to get total count
  const first = await krakenFetchLedgers(apiBase, token, creds, 0, lastFetchedTs);
  allEntries.push(...first.entries);

  // Fetch remaining pages
  let offset = first.entries.length;
  while (offset < first.count) {
    const page = await krakenFetchLedgers(apiBase, token, creds, offset, lastFetchedTs);
    if (page.entries.length === 0) break;
    allEntries.push(...page.entries);
    offset += page.entries.length;
  }

  const { events, issues } = mapKrakenLedgerToEvents(allEntries);
  return { events, issueCount: issues.length, totalEntries: allEntries.length };
}
