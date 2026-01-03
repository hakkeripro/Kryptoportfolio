import { describe, it, expect } from 'vitest';
import { generateTaxYearReport, mapCoinbaseV2TransactionsToLedger } from '..';

describe('taxEngine', () => {
  it('generates realized disposals + income + year-end holdings for a tax year', () => {
    // Minimal Coinbase v2-like payloads (aligned with api fixture)
    const baseTx = (id: string, type: string, created_at: string, amount: { amount: string; currency: string }) => ({
      id,
      type,
      status: 'completed',
      created_at,
      amount,
      details: { title: type, subtitle: `fixture:${id}` }
    });

    const txs: Array<{ accountId: string; tx: any }> = [
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_buy_btc_1', 'buy', '2025-01-02T12:00:00Z', { amount: '0.10', currency: 'BTC' }),
          native_amount: { amount: '2997.00', currency: 'EUR' },
          buy: {
            subtotal: { amount: '2997.00', currency: 'EUR' },
            fee: { amount: '0.00010', currency: 'BTC' },
            total: { amount: '2997.00', currency: 'EUR' }
          }
        }
      },
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_sell_btc_1', 'sell', '2025-02-01T12:00:00Z', { amount: '-0.02', currency: 'BTC' }),
          native_amount: { amount: '600.00', currency: 'EUR' },
          sell: {
            subtotal: { amount: '600.00', currency: 'EUR' },
            fee: { amount: '0.00005', currency: 'BTC' },
            total: { amount: '600.00', currency: 'EUR' }
          }
        }
      },
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_trade_btc_out', 'trade', '2025-03-01T12:00:00Z', { amount: '-0.03', currency: 'BTC' }),
          native_amount: { amount: '900.00', currency: 'EUR' },
          fee: { amount: '0.00001', currency: 'BTC' },
          trade: { id: 't1' }
        }
      },
      {
        accountId: 'acc_eth',
        tx: {
          ...baseTx('tx_trade_eth_in', 'trade', '2025-03-01T12:00:00Z', { amount: '0.50', currency: 'ETH' }),
          native_amount: { amount: '900.00', currency: 'EUR' },
          trade: { id: 't1' }
        }
      },
      {
        accountId: 'acc_eth',
        tx: {
          ...baseTx('tx_staking_reward_eth', 'staking_reward', '2025-04-01T12:00:00Z', { amount: '0.01', currency: 'ETH' }),
          native_amount: { amount: '15.00', currency: 'EUR' }
        }
      }
    ];

    // Create a deterministic assetId mapper for tests.
    const currencyToAssetId = (c: string) => {
      if (c === 'BTC') return 'asset_btc';
      if (c === 'ETH') return 'asset_eth';
      if (c === 'EUR') return 'asset_eur';
      return `asset_${c.toLowerCase()}`;
    };

    const map = mapCoinbaseV2TransactionsToLedger(txs, {
      baseCurrency: 'EUR',
      fxRatesToBase: { EUR: '1' },
      currencyToAssetId,
      ledgerAccountId: 'acct_coinbase'
    });

    expect(map.issues).toEqual([]);
    expect(map.events.length).toBeGreaterThanOrEqual(4);

    const settings: any = {
      id: 'settings_1',
      schemaVersion: 1,
      createdAtISO: new Date('2025-01-01T00:00:00.000Z').toISOString(),
      updatedAtISO: new Date('2025-01-01T00:00:00.000Z').toISOString(),
      baseCurrency: 'EUR',
      lotMethodDefault: 'FIFO',
      rewardsCostBasisMode: 'FMV',
      priceProvider: 'mock',
      autoRefreshIntervalSec: 0,
      taxProfile: 'GENERIC',
      privacy: { telemetryOptIn: false }
    };

    const report = generateTaxYearReport(map.events, settings, 2025);
    // Should include SELL + SWAP as disposals
    expect(report.disposals.length).toBe(2);
    // Should include staking reward income
    expect(report.income.length).toBe(1);
    expect(report.totals.incomeBase).toBe('15');
    // Year-end holdings should include BTC and ETH
    expect(report.yearEndHoldings.some((h) => h.assetId === 'asset_btc')).toBe(true);
    expect(report.yearEndHoldings.some((h) => h.assetId === 'asset_eth')).toBe(true);
  });
});
