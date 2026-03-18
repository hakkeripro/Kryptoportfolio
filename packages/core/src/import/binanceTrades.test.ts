import { describe, expect, it } from 'vitest';
import {
  splitBinanceSymbol,
  mapBinanceTradesToEvents,
  mapBinanceDepositsToEvents,
  mapBinanceWithdrawalsToEvents,
  type BinanceApiTrade,
  type BinanceApiDeposit,
  type BinanceApiWithdrawal,
} from './binanceTrades.js';

describe('splitBinanceSymbol', () => {
  it('splits BTCUSDT', () => {
    expect(splitBinanceSymbol('BTCUSDT')).toEqual({ base: 'BTC', quote: 'USDT' });
  });
  it('splits ETHBTC', () => {
    expect(splitBinanceSymbol('ETHBTC')).toEqual({ base: 'ETH', quote: 'BTC' });
  });
  it('splits BNBETH', () => {
    expect(splitBinanceSymbol('BNBETH')).toEqual({ base: 'BNB', quote: 'ETH' });
  });
  it('splits SOLUSDT', () => {
    expect(splitBinanceSymbol('SOLUSDT')).toEqual({ base: 'SOL', quote: 'USDT' });
  });
  it('returns undefined for unknown symbol', () => {
    expect(splitBinanceSymbol('XYZXYZ')).toBeUndefined();
  });
});

describe('mapBinanceTradesToEvents', () => {
  it('maps a buy trade to BUY event', () => {
    const trade: BinanceApiTrade = {
      symbol: 'BTCUSDT',
      id: 100001,
      orderId: 200001,
      price: '42000.00',
      qty: '0.001',
      quoteQty: '42.00',
      commission: '0.0000001',
      commissionAsset: 'BTC',
      time: 1705312200000,
      isBuyer: true,
    };
    const events = mapBinanceTradesToEvents([trade]);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('BUY');
    expect(events[0]!.coin).toBe('BTC');
    expect(events[0]!.amount).toBe('0.001');
    expect(events[0]!.pairedCoin).toBe('USDT');
    expect(events[0]!.pairedAmount).toBe('42');
    expect(events[0]!.feeCoin).toBe('BTC');
    expect(events[0]!.externalRef).toBe('binance:api:BTCUSDT:100001');
  });

  it('maps a sell trade to SELL event', () => {
    const trade: BinanceApiTrade = {
      symbol: 'ETHUSDT',
      id: 100002,
      orderId: 200002,
      price: '3000.00',
      qty: '0.5',
      quoteQty: '1500.00',
      commission: '0.001',
      commissionAsset: 'USDT',
      time: 1705400000000,
      isBuyer: false,
    };
    const events = mapBinanceTradesToEvents([trade]);
    expect(events[0]!.operation).toBe('SELL');
    expect(events[0]!.coin).toBe('ETH');
    expect(events[0]!.side).toBe('out');
  });

  it('skips trades with unknown symbol', () => {
    const trade: BinanceApiTrade = {
      symbol: 'UNKNOWNXYZ',
      id: 1,
      orderId: 1,
      price: '1',
      qty: '1',
      quoteQty: '1',
      commission: '0',
      commissionAsset: 'BNB',
      time: 1705312200000,
      isBuyer: true,
    };
    expect(mapBinanceTradesToEvents([trade])).toHaveLength(0);
  });
});

describe('mapBinanceDepositsToEvents', () => {
  it('maps successful deposit', () => {
    const deposit: BinanceApiDeposit = {
      coin: 'BTC',
      amount: '0.01',
      insertTime: 1704000000000,
      txId: 'txhash001',
      status: 1,
    };
    const events = mapBinanceDepositsToEvents([deposit]);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('DEPOSIT');
    expect(events[0]!.side).toBe('in');
    expect(events[0]!.externalRef).toBe('binance:api:deposit:txhash001');
  });

  it('filters out non-successful deposits', () => {
    const deposit: BinanceApiDeposit = {
      coin: 'BTC',
      amount: '0.01',
      insertTime: 1704000000000,
      status: 0, // pending
    };
    expect(mapBinanceDepositsToEvents([deposit])).toHaveLength(0);
  });
});

describe('mapBinanceWithdrawalsToEvents', () => {
  it('maps completed withdrawal', () => {
    const withdrawal: BinanceApiWithdrawal = {
      coin: 'ETH',
      amount: '0.5',
      applyTime: '2024-01-10 08:00:00',
      id: 'wid-001',
      status: 6,
    };
    const events = mapBinanceWithdrawalsToEvents([withdrawal]);
    expect(events).toHaveLength(1);
    expect(events[0]!.operation).toBe('WITHDRAW');
    expect(events[0]!.side).toBe('out');
  });

  it('filters out non-completed withdrawals', () => {
    const withdrawal: BinanceApiWithdrawal = {
      coin: 'ETH',
      amount: '0.5',
      applyTime: '2024-01-10 08:00:00',
      id: 'wid-002',
      status: 2, // awaiting approval
    };
    expect(mapBinanceWithdrawalsToEvents([withdrawal])).toHaveLength(0);
  });
});
