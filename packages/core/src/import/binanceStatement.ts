/**
 * Binance Statement CSV mapper.
 *
 * Supports the Binance "Statement" export format:
 *   UTC_Time,Account,Operation,Coin,Change,Remark
 *
 * Operations are grouped: Buy/Sell pairs are matched by timestamp + "Transaction Related".
 * Commission entries are attached to the nearest trade.
 *
 * ZK-compatible: runs fully client-side.
 */

import Decimal from 'decimal.js';

export interface BinanceStatementRow {
  utcTime: string; // "2024-01-15 10:30:00"
  account: string;
  operation: string;
  coin: string;
  change: string; // signed decimal, e.g. "0.001" or "-50.25"
  remark: string;
}

export interface BinanceImportResult {
  events: BinanceRawEvent[];
  issues: BinanceImportIssue[];
}

export type BinanceRawEvent = {
  timestampISO: string;
  operation: string;
  coin: string;
  amount: string; // absolute value
  side: 'in' | 'out';
  // For paired trades
  pairedCoin?: string;
  pairedAmount?: string;
  feeCoin?: string;
  feeAmount?: string;
  externalRef: string;
};

export type BinanceImportIssue =
  | { type: 'UNKNOWN_OPERATION'; operation: string; rows: number }
  | { type: 'UNPAIRED_TRADE'; operation: string; timestampISO: string; coin: string };

/** Parse Binance Statement CSV text into rows */
export function parseBinanceStatementCsv(csvText: string): BinanceStatementRow[] {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const header = lines[0]!.split(',').map((h) => h.trim().toLowerCase().replace(/\s+/g, '_'));
  const colIdx = (name: string) => header.indexOf(name);

  const utcIdx = colIdx('utc_time');
  const accIdx = colIdx('account');
  const opIdx = colIdx('operation');
  const coinIdx = colIdx('coin');
  const changeIdx = colIdx('change');
  const remarkIdx = colIdx('remark');

  if (utcIdx === -1 || opIdx === -1 || coinIdx === -1 || changeIdx === -1) {
    throw new Error(
      'Invalid Binance Statement CSV: missing required columns (UTC_Time, Operation, Coin, Change)',
    );
  }

  const rows: BinanceStatementRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i]!.split(',');
    rows.push({
      utcTime: parts[utcIdx]?.trim() ?? '',
      account: accIdx >= 0 ? (parts[accIdx]?.trim() ?? '') : '',
      operation: parts[opIdx]?.trim() ?? '',
      coin: parts[coinIdx]?.trim() ?? '',
      change: parts[changeIdx]?.trim() ?? '',
      remark: remarkIdx >= 0 ? (parts[remarkIdx]?.trim() ?? '') : '',
    });
  }
  return rows.filter((r) => r.coin && r.change && r.operation);
}

function utcToIso(utcTime: string): string {
  // "2024-01-15 10:30:00" → "2024-01-15T10:30:00.000Z"
  return new Date(utcTime.replace(' ', 'T') + 'Z').toISOString();
}

function absDecimal(v: string): string {
  return new Decimal(v).abs().toFixed();
}

/** Map parsed rows to raw events */
export function mapBinanceStatementToEvents(rows: BinanceStatementRow[]): BinanceImportResult {
  const events: BinanceRawEvent[] = [];
  const issues: BinanceImportIssue[] = [];
  const unknownOps = new Map<string, number>();

  // Group by timestamp for trade pairing
  const byTimestamp = new Map<string, BinanceStatementRow[]>();
  for (const row of rows) {
    const ts = row.utcTime;
    if (!byTimestamp.has(ts)) byTimestamp.set(ts, []);
    byTimestamp.get(ts)!.push(row);
  }

  const processedKeys = new Set<string>();

  for (const row of rows) {
    const key = `${row.utcTime}|${row.operation}|${row.coin}`;
    if (processedKeys.has(key)) continue;

    const ts = utcToIso(row.utcTime);
    const op = row.operation.toLowerCase();
    const amount = absDecimal(row.change);
    const side: 'in' | 'out' = new Decimal(row.change).gte(0) ? 'in' : 'out';
    const tsGroup = byTimestamp.get(row.utcTime) ?? [];

    if (op === 'buy' || op === 'sell') {
      // Find the matching "Transaction Related" row (opposite coin)
      const relatedRow = tsGroup.find(
        (r) =>
          r.operation.toLowerCase() === 'transaction related' &&
          r.coin !== row.coin &&
          !processedKeys.has(`${r.utcTime}|${r.operation}|${r.coin}`),
      );
      // Find commission
      const commissionRow = tsGroup.find(
        (r) =>
          r.operation.toLowerCase() === 'commission history' &&
          !processedKeys.has(`${r.utcTime}|${r.operation}|${r.coin}`),
      );

      const externalRef = `binance:statement:${row.utcTime}:${row.coin}:${op}`;
      events.push({
        timestampISO: ts,
        operation: op === 'buy' ? 'BUY' : 'SELL',
        coin: row.coin,
        amount,
        side,
        pairedCoin: relatedRow?.coin,
        pairedAmount: relatedRow ? absDecimal(relatedRow.change) : undefined,
        feeCoin: commissionRow?.coin,
        feeAmount: commissionRow ? absDecimal(commissionRow.change) : undefined,
        externalRef,
      });

      processedKeys.add(key);
      if (relatedRow)
        processedKeys.add(`${relatedRow.utcTime}|${relatedRow.operation}|${relatedRow.coin}`);
      if (commissionRow)
        processedKeys.add(
          `${commissionRow.utcTime}|${commissionRow.operation}|${commissionRow.coin}`,
        );
    } else if (op === 'transaction related') {
      // Skip — handled by buy/sell pairing above
      processedKeys.add(key);
    } else if (op === 'commission history') {
      // Skip — attached to trade above
      processedKeys.add(key);
    } else if (op === 'deposit') {
      events.push({
        timestampISO: ts,
        operation: 'DEPOSIT',
        coin: row.coin,
        amount,
        side: 'in',
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:deposit`,
      });
      processedKeys.add(key);
    } else if (op === 'withdraw') {
      events.push({
        timestampISO: ts,
        operation: 'WITHDRAW',
        coin: row.coin,
        amount,
        side: 'out',
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:withdraw`,
      });
      processedKeys.add(key);
    } else if (
      op === 'pos savings interest' ||
      op === 'staking rewards' ||
      op === 'staking reward' ||
      op === 'savings interest' ||
      op === 'eth 2.0 staking rewards' ||
      op === 'simple earn flexible interest' ||
      op === 'simple earn locked rewards'
    ) {
      events.push({
        timestampISO: ts,
        operation: 'STAKING_REWARD',
        coin: row.coin,
        amount,
        side: 'in',
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:staking`,
      });
      processedKeys.add(key);
    } else if (op === 'distribution' || op === 'airdrop assets' || op === 'airdrop') {
      events.push({
        timestampISO: ts,
        operation: 'AIRDROP',
        coin: row.coin,
        amount,
        side: 'in',
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:airdrop`,
      });
      processedKeys.add(key);
    } else if (op === 'small assets exchange bnb' || op === 'small assets exchange bnb (locked)') {
      // Dust conversion
      events.push({
        timestampISO: ts,
        operation: 'SWAP',
        coin: row.coin,
        amount,
        side,
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:dust`,
      });
      processedKeys.add(key);
    } else if (op === 'referral commission' || op === 'referral kickback') {
      events.push({
        timestampISO: ts,
        operation: 'REWARD',
        coin: row.coin,
        amount,
        side: 'in',
        externalRef: `binance:statement:${row.utcTime}:${row.coin}:reward`,
      });
      processedKeys.add(key);
    } else if (
      op === 'transfer between main account/futures and margin' ||
      op === 'pos savings purchase' ||
      op === 'pos savings redemption' ||
      op === 'simple earn flexible subscription' ||
      op === 'simple earn flexible redemption' ||
      op === 'simple earn locked subscription' ||
      op === 'simple earn locked redemption' ||
      op === 'asset recovery' ||
      op === 'crypto box' ||
      op === 'binance convert' ||
      op === 'fee' ||
      op === 'transaction fee' ||
      op === 'transaction buy' ||
      op === 'transaction spend' ||
      op === 'transaction revenue' ||
      op === 'transaction sold'
    ) {
      // Known but skip for now — internal vault moves, earn positions, fees
      processedKeys.add(key);
    } else {
      unknownOps.set(op, (unknownOps.get(op) ?? 0) + 1);
      processedKeys.add(key);
    }
  }

  for (const [operation, count] of unknownOps.entries()) {
    issues.push({ type: 'UNKNOWN_OPERATION', operation, rows: count });
  }

  return { events, issues };
}
