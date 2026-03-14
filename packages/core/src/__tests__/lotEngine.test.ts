import { describe, it, expect } from 'vitest';
import { replayLedgerToLotsAndDisposals } from '../portfolio/lotEngine.js';
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
    rewardsCostBasisMode: 'ZERO',
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
    id: `e_test_${_evCounter.toString().padStart(4, '0')}`,
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    timestampISO: ts,
    tags: [],
  };
  return { ...base, ...partial } as LedgerEvent;
}

describe('lot engine', () => {
  // ── Existing tests ──

  it('FIFO: BUY fee adds to cost basis, SELL fee reduces proceeds', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        feeBase: '10',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '0.5',
        pricePerUnitBase: '20000',
        feeBase: '5',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'FIFO' }));
    expect(r.disposals).toHaveLength(1);
    const d0 = r.disposals[0];
    expect(d0.proceedsBase).toBe('9995');
    expect(d0.costBasisBase).toBe('5005');
    expect(d0.realizedGainBase).toBe('4990');
    expect(r.positions[0].amount).toBe('0.5');
    expect(r.positions[0].costBasisBase).toBe('5005');
  });

  it('SWAP is disposal(assetIn) + acquisition(assetOut); swap fee reduces proceeds only', () => {
    const events: LedgerEvent[] = [
      ev({ type: 'BUY', assetId: 'asset_btc', amount: '1', pricePerUnitBase: '10000' }),
      ev({
        type: 'SWAP',
        assetId: 'asset_btc',
        amount: '0.5',
        assetOutId: 'asset_eth',
        amountOut: '10',
        valuationBase: '15000',
        feeBase: '20',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'FIFO' }));
    expect(r.disposals).toHaveLength(1);
    expect(r.disposals[0].proceedsBase).toBe('14980');
    expect(r.disposals[0].costBasisBase).toBe('5000');
    expect(r.disposals[0].realizedGainBase).toBe('9980');
    const btc = r.positions.find((p) => p.assetId === 'asset_btc');
    const eth = r.positions.find((p) => p.assetId === 'asset_eth');
    expect(btc?.amount).toBe('0.5');
    expect(eth?.amount).toBe('10');
    expect(eth?.costBasisBase).toBe('15000');
  });

  it('Token-fee requires deterministic feeValueBase', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        feeAssetId: 'asset_btc',
        feeAmount: '0.001',
      }),
    ];
    expect(() => replayLedgerToLotsAndDisposals(events, s())).toThrow(
      /ledger_fee_missing_value_base/,
    );
  });

  // ── NEW: Edge case tests ──

  it('empty portfolio returns empty results', () => {
    const r = replayLedgerToLotsAndDisposals([], s());
    expect(r.positions).toEqual([]);
    expect(r.disposals).toEqual([]);
    expect(r.realizedPnlBase).toBe('0');
    expect(r.warnings).toEqual([]);
  });

  it('negative inventory: SELL without prior BUY produces warning', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '50000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.warnings).toContain('lot_engine_negative_inventory');
    expect(r.disposals).toHaveLength(1);
    // cost basis is 0 for unknown lot
    expect(r.disposals[0].costBasisBase).toBe('0');
  });

  it('SELL more than available triggers negative inventory warning', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '0.5',
        pricePerUnitBase: '10000',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '20000',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.warnings).toContain('lot_engine_negative_inventory');
    expect(r.disposals).toHaveLength(1);
    // partial from real lot + partial from unknown
    expect(r.disposals[0].lotsMatched.length).toBeGreaterThanOrEqual(2);
  });

  it('LIFO: sells from most recently acquired lot first', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '20000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '25000',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'LIFO' }));
    expect(r.disposals).toHaveLength(1);
    // LIFO: cost basis from the second lot (20000)
    expect(r.disposals[0].costBasisBase).toBe('20000');
    expect(r.disposals[0].realizedGainBase).toBe('5000'); // 25000 - 20000
  });

  it('HIFO: sells from highest cost per unit lot first', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '30000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '20000',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '25000',
        timestampISO: '2025-01-04T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'HIFO' }));
    expect(r.disposals).toHaveLength(1);
    // HIFO: should pick the 30000 lot (highest cost)
    expect(r.disposals[0].costBasisBase).toBe('30000');
    expect(r.disposals[0].realizedGainBase).toBe('-5000'); // 25000 - 30000 = loss
  });

  it('AVG_COST: uses average cost basis across all lots', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '20000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '25000',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'AVG_COST' }));
    expect(r.disposals).toHaveLength(1);
    // AVG: (10000 + 20000) / 2 = 15000
    expect(r.disposals[0].costBasisBase).toBe('15000');
    expect(r.disposals[0].realizedGainBase).toBe('10000'); // 25000 - 15000
  });

  it('TRANSFER in: adds 0-cost lot', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'TRANSFER',
        assetId: 'asset_btc',
        amount: '1',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].amount).toBe('1');
    expect(r.positions[0].costBasisBase).toBe('0');
  });

  it('TRANSFER out: reduces inventory using FIFO', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '2',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'TRANSFER',
        assetId: 'asset_btc',
        amount: '-1',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].amount).toBe('1');
    expect(r.positions[0].costBasisBase).toBe('10000');
    // Transfer out is NOT a disposal
    expect(r.disposals).toHaveLength(0);
  });

  it('REWARD with ZERO cost basis mode: creates lot with 0 cost', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'REWARD',
        assetId: 'asset_btc',
        amount: '0.01',
        fmvPerUnitBase: '50000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ rewardsCostBasisMode: 'ZERO' }));
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].amount).toBe('0.01');
    expect(r.positions[0].costBasisBase).toBe('0');
  });

  it('REWARD with FMV cost basis mode: creates lot with FMV cost', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'STAKING_REWARD',
        assetId: 'asset_eth',
        amount: '0.5',
        fmvPerUnitBase: '3000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ rewardsCostBasisMode: 'FMV' }));
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].amount).toBe('0.5');
    expect(r.positions[0].costBasisBase).toBe('1500'); // 0.5 * 3000
  });

  it('REWARD with FMV mode but missing FMV produces warning', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'AIRDROP',
        assetId: 'asset_xyz',
        amount: '100',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ rewardsCostBasisMode: 'FMV' }));
    expect(r.warnings.some((w) => w.startsWith('reward_missing_fmv'))).toBe(true);
    expect(r.positions[0].costBasisBase).toBe('0');
  });

  it('REWARD with fmvTotalBase uses total directly', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'REWARD',
        assetId: 'asset_btc',
        amount: '0.01',
        fmvTotalBase: '750',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ rewardsCostBasisMode: 'FMV' }));
    expect(r.positions[0].costBasisBase).toBe('750');
  });

  it('multiple assets: positions are independent', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '50000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_eth',
        amount: '10',
        pricePerUnitBase: '3000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'SELL',
        assetId: 'asset_btc',
        amount: '0.5',
        pricePerUnitBase: '60000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toHaveLength(2);
    const btc = r.positions.find((p) => p.assetId === 'asset_btc');
    const eth = r.positions.find((p) => p.assetId === 'asset_eth');
    expect(btc?.amount).toBe('0.5');
    expect(eth?.amount).toBe('10');
    expect(eth?.costBasisBase).toBe('30000');
  });

  it('SWAP with AVG_COST method', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '2',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '2',
        pricePerUnitBase: '20000',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
      ev({
        type: 'SWAP',
        assetId: 'asset_btc',
        amount: '1',
        assetOutId: 'asset_eth',
        amountOut: '10',
        valuationBase: '18000',
        timestampISO: '2025-01-03T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'AVG_COST' }));
    expect(r.disposals).toHaveLength(1);
    // avg cost: (20000 + 40000) / 4 = 15000 per unit
    expect(r.disposals[0].costBasisBase).toBe('15000');
    expect(r.disposals[0].proceedsBase).toBe('18000');
    expect(r.disposals[0].realizedGainBase).toBe('3000');
  });

  it('SWAP missing valuation produces warning', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        type: 'SWAP',
        assetId: 'asset_btc',
        amount: '0.5',
        assetOutId: 'asset_eth',
        amountOut: '5',
        timestampISO: '2025-01-02T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.warnings.some((w) => w.startsWith('swap_missing_valuation'))).toBe(true);
  });

  it('TRANSFER with amount 0 is a no-op', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'TRANSFER',
        assetId: 'asset_btc',
        amount: '0',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toEqual([]);
  });

  it('BUY with feeBase using feeValueBase field', () => {
    const events: LedgerEvent[] = [
      ev({
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        feeAssetId: 'asset_btc',
        feeAmount: '0.001',
        feeValueBase: '10',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].costBasisBase).toBe('10010'); // 10000 + 10 fee
  });

  it('replacement events: replaced event is excluded from calculation', () => {
    const events: LedgerEvent[] = [
      ev({
        id: 'e_original_001',
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
      ev({
        id: 'e_replacement_001',
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '2',
        pricePerUnitBase: '10000',
        replacesEventId: 'e_original_001',
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    // Only the replacement should count: 2 BTC, not 1+2=3
    expect(r.positions).toHaveLength(1);
    expect(r.positions[0].amount).toBe('2');
  });

  it('tombstone (isDeleted) events are excluded', () => {
    const events: LedgerEvent[] = [
      ev({
        id: 'e_deleted_001',
        type: 'BUY',
        assetId: 'asset_btc',
        amount: '1',
        pricePerUnitBase: '10000',
        isDeleted: true,
        timestampISO: '2025-01-01T00:00:00.000Z',
      }),
    ];
    const r = replayLedgerToLotsAndDisposals(events, s());
    expect(r.positions).toEqual([]);
  });
});
