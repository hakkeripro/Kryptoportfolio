/**
 * Kraken Ledger API mapper.
 *
 * Maps POST /0/private/Ledgers response entries to KrakenRawEvent[].
 * Kraken ledger is the canonical source: covers trades, deposits,
 * withdrawals, staking, airdrops, and internal transfers.
 *
 * Trade pairing: two entries share the same `refid` (one per leg of the trade).
 */

import Decimal from 'decimal.js';
import { normalizeKrakenAsset } from './krakenAssetMap.js';

export interface KrakenLedgerEntry {
  refid: string;
  time: number; // unix timestamp (seconds, float)
  type: string; // 'trade' | 'deposit' | 'withdrawal' | 'staking' | 'reward' | 'earn' | 'airdrop' | 'transfer' | ...
  subtype?: string;
  aclass?: string;
  asset: string; // e.g. "XXBT", "XETH", "ZUSD"
  amount: string; // signed decimal
  fee: string; // always positive
  balance?: string;
}

export interface KrakenRawEvent {
  timestampISO: string;
  operation: string;
  coin: string; // normalized
  amount: string; // absolute value
  side: 'in' | 'out';
  feeCoin?: string;
  feeAmount?: string;
  pairedCoin?: string;
  pairedAmount?: string;
  externalRef: string; // "kraken:ledger:<refid>:<asset>"
}

export interface KrakenImportResult {
  events: KrakenRawEvent[];
  issues: KrakenImportIssue[];
}

export type KrakenImportIssue =
  | { type: 'UNKNOWN_LEDGER_TYPE'; ledgerType: string; count: number }
  | { type: 'UNPAIRED_TRADE'; refid: string };

function unixToIso(unixSec: number): string {
  return new Date(unixSec * 1000).toISOString();
}

function absStr(v: string): string {
  return new Decimal(v).abs().toFixed();
}

/** Map Kraken Ledger entries to raw events.
 *  Entries can come from multiple paginated fetches — deduplicate by refid+asset.
 */
export function mapKrakenLedgerToEvents(entries: KrakenLedgerEntry[]): KrakenImportResult {
  const events: KrakenRawEvent[] = [];
  const issues: KrakenImportIssue[] = [];
  const unknownTypes = new Map<string, number>();

  // Group by refid for trade pairing
  const byRefid = new Map<string, KrakenLedgerEntry[]>();
  for (const entry of entries) {
    if (!byRefid.has(entry.refid)) byRefid.set(entry.refid, []);
    byRefid.get(entry.refid)!.push(entry);
  }

  const processedRefids = new Set<string>();

  for (const entry of entries) {
    if (processedRefids.has(`${entry.refid}:${entry.asset}`)) continue;
    processedRefids.add(`${entry.refid}:${entry.asset}`);

    const ts = unixToIso(entry.time);
    const coin = normalizeKrakenAsset(entry.asset);
    const amount = absStr(entry.amount);
    const side: 'in' | 'out' = new Decimal(entry.amount).gte(0) ? 'in' : 'out';
    const feeAmount = entry.fee && new Decimal(entry.fee).gt(0) ? entry.fee : undefined;
    const type = entry.type.toLowerCase();
    const externalRef = `kraken:ledger:${entry.refid}:${entry.asset}`;

    if (type === 'trade') {
      // Find the other leg of the trade (same refid, different asset)
      const group = byRefid.get(entry.refid) ?? [];
      const paired = group.find((e) => e.asset !== entry.asset);

      if (paired) {
        processedRefids.add(`${paired.refid}:${paired.asset}`);
        const pairedCoin = normalizeKrakenAsset(paired.asset);
        const pairedAmount = absStr(paired.amount);
        // isBuyer = this entry's amount is positive (coin received)
        const isBuyer = new Decimal(entry.amount).gt(0);
        events.push({
          timestampISO: ts,
          operation: isBuyer ? 'BUY' : 'SELL',
          coin,
          amount,
          side,
          pairedCoin,
          pairedAmount,
          feeCoin: feeAmount ? coin : undefined,
          feeAmount,
          externalRef,
        });
      } else {
        // Unpaired trade — surface as issue, still emit as raw event
        issues.push({ type: 'UNPAIRED_TRADE', refid: entry.refid });
        events.push({
          timestampISO: ts,
          operation: 'BUY',
          coin,
          amount,
          side,
          feeCoin: feeAmount ? coin : undefined,
          feeAmount,
          externalRef,
        });
      }
    } else if (type === 'deposit') {
      events.push({
        timestampISO: ts,
        operation: 'DEPOSIT',
        coin,
        amount,
        side: 'in',
        feeCoin: feeAmount ? coin : undefined,
        feeAmount,
        externalRef,
      });
    } else if (type === 'withdrawal') {
      events.push({
        timestampISO: ts,
        operation: 'WITHDRAW',
        coin,
        amount,
        side: 'out',
        feeCoin: feeAmount ? coin : undefined,
        feeAmount,
        externalRef,
      });
    } else if (type === 'staking' || type === 'reward' || type === 'earn') {
      events.push({
        timestampISO: ts,
        operation: 'STAKING_REWARD',
        coin,
        amount,
        side: 'in',
        externalRef,
      });
    } else if (type === 'airdrop') {
      events.push({
        timestampISO: ts,
        operation: 'AIRDROP',
        coin,
        amount,
        side: 'in',
        externalRef,
      });
    } else if (type === 'transfer') {
      // Internal Kraken transfers (Spot ↔ Futures ↔ Earn) — skip
      // These are vault moves, not taxable events
    } else if (type === 'adjustment' || type === 'rollover' || type === 'settled') {
      // Skip internal accounting entries
    } else {
      unknownTypes.set(type, (unknownTypes.get(type) ?? 0) + 1);
    }
  }

  for (const [ledgerType, count] of unknownTypes.entries()) {
    issues.push({ type: 'UNKNOWN_LEDGER_TYPE', ledgerType, count });
  }

  return { events, issues };
}
