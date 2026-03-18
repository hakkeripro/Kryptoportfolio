import { describe, expect, it } from 'vitest';
import {
  parseBinanceStatementCsv,
  mapBinanceStatementToEvents,
} from './binanceStatement.js';

const HEADER = 'UTC_Time,Account,Operation,Coin,Change,Remark\n';

describe('parseBinanceStatementCsv', () => {
  it('returns empty array for header-only input', () => {
    expect(parseBinanceStatementCsv(HEADER)).toHaveLength(0);
  });

  it('parses basic rows', () => {
    const csv = HEADER + '2024-01-15 10:30:00,Spot,Buy,BTC,0.001,\n';
    const rows = parseBinanceStatementCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.coin).toBe('BTC');
    expect(rows[0]!.operation).toBe('Buy');
    expect(rows[0]!.change).toBe('0.001');
  });

  it('throws for missing required columns', () => {
    expect(() => parseBinanceStatementCsv('foo,bar\n1,2\n')).toThrow(/Invalid Binance/);
  });
});

describe('mapBinanceStatementToEvents', () => {
  it('maps Buy + Transaction Related pair to BUY event', () => {
    const csv =
      HEADER +
      '2024-01-15 10:30:00,Spot,Buy,BTC,0.001,\n' +
      '2024-01-15 10:30:00,Spot,Transaction Related,USDT,-42.00,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events, issues } = mapBinanceStatementToEvents(rows);
    expect(issues).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('BUY');
    expect(events[0]!.coin).toBe('BTC');
    expect(events[0]!.amount).toBe('0.001');
    expect(events[0]!.pairedCoin).toBe('USDT');
    expect(events[0]!.pairedAmount).toBe('42');
  });

  it('maps Sell + Transaction Related pair to SELL event', () => {
    const csv =
      HEADER +
      '2024-01-16 12:00:00,Spot,Sell,ETH,-0.5,\n' +
      '2024-01-16 12:00:00,Spot,Transaction Related,USDT,1600.00,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('SELL');
    expect(events[0]!.coin).toBe('ETH');
  });

  it('maps Deposit to DEPOSIT event', () => {
    const csv = HEADER + '2024-01-10 08:00:00,Spot,Deposit,BTC,0.01,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('DEPOSIT');
    expect(events[0]!.side).toBe('in');
  });

  it('maps Withdraw to WITHDRAW event', () => {
    const csv = HEADER + '2024-01-11 09:00:00,Spot,Withdraw,ETH,-0.5,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('WITHDRAW');
    expect(events[0]!.side).toBe('out');
  });

  it('maps POS savings interest to STAKING_REWARD', () => {
    const csv = HEADER + '2024-01-12 00:00:00,Spot,POS savings interest,BNB,0.001,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('STAKING_REWARD');
  });

  it('maps Airdrop Assets to AIRDROP', () => {
    const csv = HEADER + '2024-01-13 00:00:00,Spot,Airdrop Assets,SHIB,1000000,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('AIRDROP');
  });

  it('attaches commission to buy trade', () => {
    const csv =
      HEADER +
      '2024-01-15 10:30:00,Spot,Buy,BTC,0.001,\n' +
      '2024-01-15 10:30:00,Spot,Transaction Related,USDT,-42.00,\n' +
      '2024-01-15 10:30:00,Spot,Commission History,BNB,-0.0001,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(1);
    expect(events[0]!.feeCoin).toBe('BNB');
    expect(events[0]!.feeAmount).toBe('0.0001');
  });

  it('surfaces unknown operations as issues', () => {
    const csv = HEADER + '2024-01-14 00:00:00,Spot,FuturesMysteryOp,BNB,1,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events, issues } = mapBinanceStatementToEvents(rows);
    expect(events).toHaveLength(0);
    expect(issues).toHaveLength(1);
    expect(issues[0]!.type).toBe('UNKNOWN_OPERATION');
  });

  it('generates stable externalRef for deduplication', () => {
    const csv =
      HEADER +
      '2024-01-15 10:30:00,Spot,Buy,BTC,0.001,\n' +
      '2024-01-15 10:30:00,Spot,Transaction Related,USDT,-42.00,\n';
    const rows = parseBinanceStatementCsv(csv);
    const { events } = mapBinanceStatementToEvents(rows);
    expect(events[0]!.externalRef).toMatch(/^binance:statement:/);
  });
});
