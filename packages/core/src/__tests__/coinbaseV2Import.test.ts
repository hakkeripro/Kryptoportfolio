import { describe, it, expect } from 'vitest';
import { mapCoinbaseV2TransactionsToLedger } from '../import/coinbaseV2.js';

const currencyToAssetId = (c: string) => `asset_${String(c).toLowerCase()}`;

describe('coinbase v2 mapping', () => {
  it('maps BUY with subtotal + fee', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'tx1',
          type: 'buy',
          created_at: '2025-01-02T00:00:00Z',
          amount: { amount: '0.1', currency: 'BTC' },
          native_amount: { amount: '-1010', currency: 'EUR' },
          buy: {
            subtotal: { amount: '-1000', currency: 'EUR' },
            fee: { amount: '-10', currency: 'EUR' },
            total: { amount: '-1010', currency: 'EUR' }
          },
          details: { title: 'Bought BTC', subtitle: 'Using EUR' }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'ZERO' },
      ledgerAccountId: 'acct_coinbase'
    });

    expect(r.issues).toHaveLength(0);
    expect(r.events).toHaveLength(1);
    const e = r.events[0];
    expect(e.type).toBe('BUY');
    expect(e.assetId).toBe('asset_btc');
    expect(e.amount).toBe('0.1');
    expect((e as any).pricePerUnitBase).toBe('10000');
    expect((e as any).feeBase).toBe('10');
  });

  it('maps SELL with subtotal + fee', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'tx2',
          type: 'sell',
          created_at: '2025-01-03T00:00:00Z',
          amount: { amount: '-0.2', currency: 'BTC' },
          native_amount: { amount: '1990', currency: 'EUR' },
          sell: {
            subtotal: { amount: '2000', currency: 'EUR' },
            fee: { amount: '10', currency: 'EUR' },
            total: { amount: '1990', currency: 'EUR' }
          }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'ZERO' },
      ledgerAccountId: 'acct_coinbase'
    });

    expect(r.issues).toHaveLength(0);
    const e = r.events[0];
    expect(e.type).toBe('SELL');
    expect((e as any).pricePerUnitBase).toBe('10000');
    expect((e as any).feeBase).toBe('10');
  });

  it('pairs trade txs into a single SWAP', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'txA',
          type: 'trade',
          created_at: '2025-01-04T00:00:00Z',
          amount: { amount: '-0.5', currency: 'BTC' },
          native_amount: { amount: '-15000', currency: 'EUR' },
          trade: { id: 't1' }
        }
      },
      {
        accountId: 'acc_eth',
        tx: {
          id: 'txB',
          type: 'trade',
          created_at: '2025-01-04T00:00:00Z',
          amount: { amount: '10', currency: 'ETH' },
          native_amount: { amount: '15000', currency: 'EUR' },
          trade: { id: 't1' }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'ZERO' },
      ledgerAccountId: 'acct_coinbase'
    });

    expect(r.events).toHaveLength(1);
    const e = r.events[0];
    expect(e.type).toBe('SWAP');
    expect(e.assetId).toBe('asset_btc');
    expect(e.amount).toBe('0.5');
    expect((e as any).assetOutId).toBe('asset_eth');
    expect((e as any).amountOut).toBe('10');
    expect((e as any).valuationBase).toBe('15000');
    expect(e.externalRef).toBe('coinbase:v2:trade:t1');
  });

  it('FMV rewards require native_amount (issue surfaced)', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'txR',
          type: 'staking_reward',
          created_at: '2025-01-05T00:00:00Z',
          amount: { amount: '0.01', currency: 'BTC' }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'FMV' },
      ledgerAccountId: 'acct_coinbase'
    });

    // In FMV mode we must not commit a reward without an explicit base valuation.
    expect(r.events).toHaveLength(0);
    expect(r.issues.some((i) => i.type === 'REWARD_FMV_MISSING')).toBe(true);
  });

  it('values token fee deterministically when fee currency equals the traded asset', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'txF1',
          type: 'buy',
          created_at: '2025-01-06T00:00:00Z',
          amount: { amount: '1', currency: 'BTC' },
          native_amount: { amount: '-10000', currency: 'EUR' },
          buy: {
            subtotal: { amount: '-9990', currency: 'EUR' },
            // fee paid in BTC (token fee)
            fee: { amount: '-0.0001', currency: 'BTC' },
            total: { amount: '-10000', currency: 'EUR' }
          }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'ZERO' },
      ledgerAccountId: 'acct_coinbase'
    });

    expect(r.issues).toHaveLength(0);
    expect(r.events).toHaveLength(1);
    const e = r.events[0] as any;
    expect(e.type).toBe('BUY');
    expect(e.feeAssetId).toBe('asset_btc');
    expect(e.feeAmount).toBe('0.0001');
    // Deterministic fee valuation based on native_amount / qty (10000 EUR per BTC)
    expect(e.feeValueBase).toBe('1');
  });

  it('blocks events when fee valuation is missing (issue surfaced)', () => {
    const r = mapCoinbaseV2TransactionsToLedger([
      {
        accountId: 'acc_btc',
        tx: {
          id: 'txF2',
          type: 'buy',
          created_at: '2025-01-07T00:00:00Z',
          amount: { amount: '0.1', currency: 'BTC' },
          native_amount: { amount: '-1001', currency: 'EUR' },
          buy: {
            subtotal: { amount: '-1000', currency: 'EUR' },
            fee: { amount: '-1', currency: 'USDC' },
            total: { amount: '-1001', currency: 'EUR' }
          }
        }
      }
    ], {
      baseCurrency: 'EUR',
      currencyToAssetId,
      fxRatesToBase: { EUR: '1' },
      settings: { rewardsCostBasisMode: 'ZERO' },
      ledgerAccountId: 'acct_coinbase'
    });

    expect(r.events).toHaveLength(0);
    expect(r.issues.some((i) => i.type === 'FEE_VALUE_MISSING')).toBe(true);
  });
});
