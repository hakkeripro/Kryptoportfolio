import { describe, it, expect } from 'vitest';
import { detectSelfTransfers } from './transferDetection.js';
import type { LedgerEvent } from '../domain/ledger.js';

let _counter = 0;
function makeTransfer(overrides: {
  id?: string;
  assetId: string;
  amount: string;
  timestampISO: string;
  accountId?: string;
}): LedgerEvent {
  _counter++;
  const ts = overrides.timestampISO;
  return {
    id: overrides.id ?? `e_transfer_${_counter.toString().padStart(4, '0')}`,
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    type: 'TRANSFER',
    timestampISO: ts,
    assetId: overrides.assetId as any,
    amount: overrides.amount,
    accountId: overrides.accountId as any,
    tags: [],
  } as any;
}

const BTC = 'asset-btc-uuid-0000-0000-000000000001';
const ETH = 'asset-eth-uuid-0000-0000-000000000002';

describe('detectSelfTransfers', () => {
  it('perfect pair — matched as high confidence (≤30 min)', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-1',
      timestampISO: '2024-01-01T10:00:00.000Z',
      accountId: 'acc-coinbase',
    });
    const inn = makeTransfer({
      assetId: BTC,
      amount: '1',
      timestampISO: '2024-01-01T10:15:00.000Z',
      accountId: 'acc-ledger',
    });
    const result = detectSelfTransfers([out, inn]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.outEventId).toBe(out.id);
    expect(result.matched[0]!.inEventId).toBe(inn.id);
    expect(result.matched[0]!.confidence).toBe('high');
    expect(result.unmatchedOut).toHaveLength(0);
    expect(result.unmatchedIn).toHaveLength(0);
  });

  it('dust tolerance — 0.05% diff matched (below 0.5% threshold)', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-1.0000',
      timestampISO: '2024-01-02T12:00:00.000Z',
      accountId: 'acc-a',
    });
    const inn = makeTransfer({
      assetId: BTC,
      amount: '0.9995', // 0.05% diff < 0.5% tolerance
      timestampISO: '2024-01-02T12:20:00.000Z',
      accountId: 'acc-b',
    });
    const result = detectSelfTransfers([out, inn]);
    expect(result.matched).toHaveLength(1);
  });

  it('outside time window (3h) — not matched', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-1',
      timestampISO: '2024-01-03T10:00:00.000Z',
      accountId: 'acc-a',
    });
    const inn = makeTransfer({
      assetId: BTC,
      amount: '1',
      timestampISO: '2024-01-03T13:01:00.000Z', // 3h 1min
      accountId: 'acc-b',
    });
    const result = detectSelfTransfers([out, inn]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedOut).toContain(out.id);
    expect(result.unmatchedIn).toContain(inn.id);
  });

  it('same account — not matched (no inter-wallet transfer)', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-1',
      timestampISO: '2024-01-04T10:00:00.000Z',
      accountId: 'acc-same',
    });
    const inn = makeTransfer({
      assetId: BTC,
      amount: '1',
      timestampISO: '2024-01-04T10:05:00.000Z',
      accountId: 'acc-same', // same account
    });
    const result = detectSelfTransfers([out, inn]);
    expect(result.matched).toHaveLength(0);
  });

  it('multiple candidates — closest time matched first (greedy)', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-1',
      timestampISO: '2024-01-05T10:00:00.000Z',
      accountId: 'acc-a',
    });
    const inn1 = makeTransfer({
      assetId: BTC,
      amount: '1',
      timestampISO: '2024-01-05T11:30:00.000Z', // 90 min away
      accountId: 'acc-b',
    });
    const inn2 = makeTransfer({
      assetId: BTC,
      amount: '1',
      timestampISO: '2024-01-05T10:05:00.000Z', // 5 min away — closer
      accountId: 'acc-c',
    });
    const result = detectSelfTransfers([out, inn1, inn2]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.inEventId).toBe(inn2.id); // closer match wins
    expect(result.unmatchedIn).toContain(inn1.id);
  });

  it('no counterpart — outgoing goes to unmatchedOut', () => {
    const out = makeTransfer({
      assetId: ETH,
      amount: '-2',
      timestampISO: '2024-01-06T10:00:00.000Z',
      accountId: 'acc-a',
    });
    const result = detectSelfTransfers([out]);
    expect(result.matched).toHaveLength(0);
    expect(result.unmatchedOut).toContain(out.id);
    expect(result.unmatchedIn).toHaveLength(0);
  });

  it('medium confidence — 31 min to 2h window', () => {
    const out = makeTransfer({
      assetId: BTC,
      amount: '-0.5',
      timestampISO: '2024-01-07T10:00:00.000Z',
      accountId: 'acc-a',
    });
    const inn = makeTransfer({
      assetId: BTC,
      amount: '0.5',
      timestampISO: '2024-01-07T11:00:00.000Z', // 60 min → medium
      accountId: 'acc-b',
    });
    const result = detectSelfTransfers([out, inn]);
    expect(result.matched).toHaveLength(1);
    expect(result.matched[0]!.confidence).toBe('medium');
  });
});
