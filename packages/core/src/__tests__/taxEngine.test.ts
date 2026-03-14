import { describe, it, expect } from 'vitest';
import { generateTaxYearReport, lotMethodForTax } from '../tax/taxEngine.js';
import { mapCoinbaseV2TransactionsToLedger } from '../import/coinbaseV2.js';
import type { LedgerEvent } from '../domain/ledger.js';
import type { Settings } from '../domain/settings.js';

function s(overrides?: Partial<Settings>): Settings {
  const now = new Date('2025-01-01T00:00:00.000Z').toISOString();
  return {
    id: 'settings_1',
    schemaVersion: 1,
    createdAtISO: now,
    updatedAtISO: now,
    baseCurrency: 'EUR',
    lotMethodDefault: 'FIFO',
    rewardsCostBasisMode: 'FMV',
    priceProvider: 'mock',
    autoRefreshIntervalSec: 0,
    taxProfile: 'GENERIC',
    privacy: { telemetryOptIn: false },
    ...(overrides ?? {}),
  };
}

let _evCounter = 0;
function ev(partial: Partial<LedgerEvent>): LedgerEvent {
  _evCounter++;
  const ts = partial.timestampISO ?? new Date('2025-01-02T00:00:00.000Z').toISOString();
  const base: any = {
    id: `e_tax_${_evCounter.toString().padStart(4, '0')}`,
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    timestampISO: ts,
    tags: [],
  };
  return { ...base, ...partial } as LedgerEvent;
}

describe('taxEngine', () => {
  // ── Existing integration test ──

  it('generates realized disposals + income + year-end holdings for a tax year', () => {
    const baseTx = (
      id: string,
      type: string,
      created_at: string,
      amount: { amount: string; currency: string },
    ) => ({
      id,
      type,
      status: 'completed',
      created_at,
      amount,
      details: { title: type, subtitle: `fixture:${id}` },
    });

    const txs: Array<{ accountId: string; tx: any }> = [
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_buy_btc_1', 'buy', '2025-01-02T12:00:00Z', {
            amount: '0.10',
            currency: 'BTC',
          }),
          native_amount: { amount: '2997.00', currency: 'EUR' },
          buy: {
            subtotal: { amount: '2997.00', currency: 'EUR' },
            fee: { amount: '0.00010', currency: 'BTC' },
            total: { amount: '2997.00', currency: 'EUR' },
          },
        },
      },
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_sell_btc_1', 'sell', '2025-02-01T12:00:00Z', {
            amount: '-0.02',
            currency: 'BTC',
          }),
          native_amount: { amount: '600.00', currency: 'EUR' },
          sell: {
            subtotal: { amount: '600.00', currency: 'EUR' },
            fee: { amount: '0.00005', currency: 'BTC' },
            total: { amount: '600.00', currency: 'EUR' },
          },
        },
      },
      {
        accountId: 'acc_btc',
        tx: {
          ...baseTx('tx_trade_btc_out', 'trade', '2025-03-01T12:00:00Z', {
            amount: '-0.03',
            currency: 'BTC',
          }),
          native_amount: { amount: '900.00', currency: 'EUR' },
          fee: { amount: '0.00001', currency: 'BTC' },
          trade: { id: 't1' },
        },
      },
      {
        accountId: 'acc_eth',
        tx: {
          ...baseTx('tx_trade_eth_in', 'trade', '2025-03-01T12:00:00Z', {
            amount: '0.50',
            currency: 'ETH',
          }),
          native_amount: { amount: '900.00', currency: 'EUR' },
          trade: { id: 't1' },
        },
      },
      {
        accountId: 'acc_eth',
        tx: {
          ...baseTx('tx_staking_reward_eth', 'staking_reward', '2025-04-01T12:00:00Z', {
            amount: '0.01',
            currency: 'ETH',
          }),
          native_amount: { amount: '15.00', currency: 'EUR' },
        },
      },
    ];

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
      ledgerAccountId: 'acct_coinbase',
    });

    expect(map.issues).toEqual([]);
    expect(map.events.length).toBeGreaterThanOrEqual(4);

    const report = generateTaxYearReport(map.events, s(), 2025);
    expect(report.disposals.length).toBe(2);
    expect(report.income.length).toBe(1);
    expect(report.totals.incomeBase).toBe('15');
    expect(report.yearEndHoldings.some((h) => h.assetId === 'asset_btc')).toBe(true);
    expect(report.yearEndHoldings.some((h) => h.assetId === 'asset_eth')).toBe(true);
  });

  // ── NEW: Scenario tests ──

  it('buys only: no disposals, no income, year-end holdings', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '50000',
        timestampISO: '2025-03-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_eth',
        amount: '10',
        pricePerUnitBase: '3000',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report = generateTaxYearReport(events, s(), 2025);
    expect(report.disposals).toEqual([]);
    expect(report.income).toEqual([]);
    expect(report.yearEndHoldings).toHaveLength(2);
    expect(report.totals.realizedGainBase).toBe('0');
    expect(report.totals.incomeBase).toBe('0');
  });

  it('rewards + disposals: income and gains are separate', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'STAKING_REWARD',
        assetId: 'asset_eth',
        amount: '1',
        fmvPerUnitBase: '3000',
        timestampISO: '2025-01-15T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_eth',
        amount: '0.5',
        pricePerUnitBase: '4000',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report = generateTaxYearReport(events, s({ rewardsCostBasisMode: 'FMV' }), 2025);
    expect(report.income).toHaveLength(1);
    expect(report.income[0].incomeBase).toBe('3000'); // 1 ETH * 3000
    expect(report.disposals).toHaveLength(1);
    // sell 0.5 ETH @ 4000 = 2000 proceeds, cost basis = 0.5 * 3000 = 1500 (FMV mode)
    expect(report.disposals[0].proceedsBase).toBe('2000');
    expect(report.disposals[0].costBasisBase).toBe('1500');
    expect(report.disposals[0].realizedGainBase).toBe('500');
    // remaining 0.5 ETH in year-end holdings
    expect(report.yearEndHoldings).toHaveLength(1);
    expect(report.yearEndHoldings[0].amount).toBe('0.5');
  });

  it('rewards with ZERO mode: income is 0, cost basis is 0', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'REWARD',
        assetId: 'asset_btc',
        amount: '0.1',
        fmvPerUnitBase: '50000',
        timestampISO: '2025-03-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '0.1',
        pricePerUnitBase: '60000',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report = generateTaxYearReport(events, s({ rewardsCostBasisMode: 'ZERO' }), 2025);
    expect(report.income).toHaveLength(1);
    expect(report.income[0].incomeBase).toBe('0');
    expect(report.disposals).toHaveLength(1);
    expect(report.disposals[0].costBasisBase).toBe('0');
    expect(report.disposals[0].realizedGainBase).toBe('6000'); // full proceeds are gain
  });

  it('swap chain: BTC → ETH → sell ETH, multiple disposals', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '40000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'SWAP',
        assetId: 'asset_btc',
        amount: '1',
        assetOutId: 'asset_eth',
        amountOut: '15',
        valuationBase: '45000',
        timestampISO: '2025-03-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_eth',
        amount: '15',
        pricePerUnitBase: '3500',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report = generateTaxYearReport(events, s(), 2025);
    expect(report.disposals).toHaveLength(2);
    // First disposal: SWAP BTC→ETH (gain 45000 - 40000 = 5000)
    const swapDisposal = report.disposals.find((d) => d.assetId === 'asset_btc');
    expect(swapDisposal).toBeDefined();
    expect(swapDisposal!.realizedGainBase).toBe('5000');
    // Second disposal: SELL ETH (cost basis = 45000 from swap, proceeds = 15 * 3500 = 52500)
    const sellDisposal = report.disposals.find((d) => d.assetId === 'asset_eth');
    expect(sellDisposal).toBeDefined();
    expect(sellDisposal!.proceedsBase).toBe('52500');
    expect(sellDisposal!.costBasisBase).toBe('45000');
    expect(sellDisposal!.realizedGainBase).toBe('7500');
  });

  it('multi-year: only events from requested year appear in report', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '30000',
        timestampISO: '2024-06-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '0.5',
        pricePerUnitBase: '40000',
        timestampISO: '2024-12-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '0.5',
        pricePerUnitBase: '50000',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report2024 = generateTaxYearReport(events, s(), 2024);
    const report2025 = generateTaxYearReport(events, s(), 2025);

    expect(report2024.disposals).toHaveLength(1);
    expect(report2024.disposals[0].taxYear).toBe(2024);
    expect(report2025.disposals).toHaveLength(1);
    expect(report2025.disposals[0].taxYear).toBe(2025);

    // Year-end holdings for 2024: 0.5 BTC (after 2024 sell, before 2025 sell)
    expect(report2024.yearEndHoldings).toHaveLength(1);
    expect(report2024.yearEndHoldings[0].amount).toBe('0.5');
  });

  it('empty year: no events yields empty report', () => {
    const report = generateTaxYearReport([], s(), 2025);
    expect(report.disposals).toEqual([]);
    expect(report.income).toEqual([]);
    expect(report.yearEndHoldings).toEqual([]);
    expect(report.totals.realizedGainBase).toBe('0');
    expect(report.totals.incomeBase).toBe('0');
  });

  it('lotMethodForTax: FINLAND profile forces FIFO', () => {
    expect(lotMethodForTax(s({ taxProfile: 'FINLAND', lotMethodDefault: 'HIFO' }))).toBe('FIFO');
  });

  it('lotMethodForTax: override takes precedence', () => {
    expect(lotMethodForTax(s({ taxProfile: 'FINLAND' }), 'LIFO')).toBe('LIFO');
  });

  it('lotMethodForTax: GENERIC profile uses settings default', () => {
    expect(lotMethodForTax(s({ taxProfile: 'GENERIC', lotMethodDefault: 'HIFO' }))).toBe('HIFO');
  });

  it('report totals aggregate correctly', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '2',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '15000',
        feeBase: '50',
        timestampISO: '2025-03-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '20000',
        feeBase: '100',
        timestampISO: '2025-06-01T00:00:00.000Z',
      }),
    ];
    const report = generateTaxYearReport(events, s(), 2025);
    expect(report.disposals).toHaveLength(2);
    // disposal 1: proceeds = 15000 - 50 = 14950, cost = 10000, gain = 4950
    // disposal 2: proceeds = 20000 - 100 = 19900, cost = 10000, gain = 9900
    expect(report.totals.proceedsBase).toBe('34850');
    expect(report.totals.costBasisBase).toBe('20000');
    expect(report.totals.feesBase).toBe('150');
    expect(report.totals.realizedGainBase).toBe('14850');
  });
});
