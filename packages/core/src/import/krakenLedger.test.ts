import { describe, expect, it } from 'vitest';
import { mapKrakenLedgerToEvents, type KrakenLedgerEntry } from './krakenLedger.js';
import { normalizeKrakenAsset } from './krakenAssetMap.js';

describe('normalizeKrakenAsset', () => {
  it('normalizes XXBT to BTC', () => {
    expect(normalizeKrakenAsset('XXBT')).toBe('BTC');
  });
  it('normalizes XETH to ETH', () => {
    expect(normalizeKrakenAsset('XETH')).toBe('ETH');
  });
  it('normalizes ZUSD to USD', () => {
    expect(normalizeKrakenAsset('ZUSD')).toBe('USD');
  });
  it('strips .S staking suffix', () => {
    expect(normalizeKrakenAsset('DOT.S')).toBe('DOT');
  });
  it('passes through unknown assets unchanged', () => {
    expect(normalizeKrakenAsset('NEWTOKEN')).toBe('NEWTOKEN');
  });
});

describe('mapKrakenLedgerToEvents', () => {
  it('pairs trade entries by refid into BUY event', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'ABC-001',
        time: 1705312200,
        type: 'trade',
        asset: 'XXBT',
        amount: '0.001',
        fee: '0.0000026',
      },
      {
        refid: 'ABC-001',
        time: 1705312200,
        type: 'trade',
        asset: 'ZUSD',
        amount: '-42.00',
        fee: '0',
      },
    ];
    const { events, issues } = mapKrakenLedgerToEvents(entries);
    expect(issues).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('BUY');
    expect(events[0]!.coin).toBe('BTC'); // normalized
    expect(events[0]!.amount).toBe('0.001');
    expect(events[0]!.pairedCoin).toBe('USD'); // normalized
    expect(events[0]!.pairedAmount).toBe('42');
  });

  it('maps deposit to DEPOSIT event', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'DEP-001',
        time: 1704000000,
        type: 'deposit',
        asset: 'XXBT',
        amount: '0.01',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('DEPOSIT');
    expect(events[0]!.side).toBe('in');
  });

  it('maps withdrawal to WITHDRAW event', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'WD-001',
        time: 1704100000,
        type: 'withdrawal',
        asset: 'XETH',
        amount: '-0.5',
        fee: '0.001',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('WITHDRAW');
    expect(events[0]!.coin).toBe('ETH');
    expect(events[0]!.feeAmount).toBe('0.001');
  });

  it('maps staking to STAKING_REWARD', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'STK-001',
        time: 1704200000,
        type: 'staking',
        asset: 'XETH',
        amount: '0.001',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('STAKING_REWARD');
  });

  it('maps earn to STAKING_REWARD', () => {
    const entries: KrakenLedgerEntry[] = [
      { refid: 'ERN-001', time: 1704300000, type: 'earn', asset: 'ZUSD', amount: '1.00', fee: '0' },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events[0]!.operation).toBe('STAKING_REWARD');
  });

  it('maps airdrop to AIRDROP', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'AIR-001',
        time: 1704400000,
        type: 'airdrop',
        asset: 'SHIB',
        amount: '1000',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events[0]!.operation).toBe('AIRDROP');
  });

  it('skips internal transfer entries silently', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'TRF-001',
        time: 1704500000,
        type: 'transfer',
        asset: 'XXBT',
        amount: '0.1',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(0);
  });

  it('generates stable externalRef', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'ABC-002',
        time: 1705312200,
        type: 'deposit',
        asset: 'XXBT',
        amount: '0.01',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events[0]!.externalRef).toBe('kraken:ledger:ABC-002:XXBT');
  });

  it('deduplicates same refid+asset across multiple calls', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'DEP-DUP',
        time: 1704000000,
        type: 'deposit',
        asset: 'XXBT',
        amount: '0.01',
        fee: '0',
      },
      {
        refid: 'DEP-DUP',
        time: 1704000000,
        type: 'deposit',
        asset: 'XXBT',
        amount: '0.01',
        fee: '0',
      },
    ];
    const { events } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(1); // deduplicated
  });

  it('surfaces unpaired trade as issue', () => {
    const entries: KrakenLedgerEntry[] = [
      {
        refid: 'UNPAIRED',
        time: 1705312200,
        type: 'trade',
        asset: 'XXBT',
        amount: '0.001',
        fee: '0',
      },
    ];
    const { events, issues } = mapKrakenLedgerToEvents(entries);
    expect(events).toHaveLength(1); // still emitted
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('UNPAIRED_TRADE');
  });
});
