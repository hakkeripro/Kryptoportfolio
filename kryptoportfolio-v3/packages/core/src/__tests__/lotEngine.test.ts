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
    ...(overrides ?? {})
  };
}

function ev(partial: Partial<LedgerEvent>): LedgerEvent {
  const ts = partial.timestampISO ?? new Date('2025-01-02T00:00:00.000Z').toISOString();
  const base: any = {
    id: 'e_' + Math.random().toString(16).slice(2),
    schemaVersion: 1,
    createdAtISO: ts,
    updatedAtISO: ts,
    timestampISO: ts,
    tags: []
  };
  return { ...base, ...partial } as LedgerEvent;
}

describe('lot engine', () => {
  it('FIFO: BUY fee adds to cost basis, SELL fee reduces proceeds', () => {
    const events: LedgerEvent[] = [
      ev({ type: 'BUY', assetId: 'asset_btc', amount: '1', pricePerUnitBase: '10000', feeBase: '10' }),
      ev({ type: 'SELL', assetId: 'asset_btc', amount: '0.5', pricePerUnitBase: '20000', feeBase: '5', timestampISO: '2025-01-03T00:00:00.000Z' })
    ];
    const r = replayLedgerToLotsAndDisposals(events, s({ lotMethodDefault: 'FIFO' }));
    expect(r.disposals).toHaveLength(1);
    const d0 = r.disposals[0];
    expect(d0.proceedsBase).toBe('9995');
    // cost basis from lot includes proportional BUY fee: (10000+10)*0.5 = 5005
    expect(d0.costBasisBase).toBe('5005');
    expect(d0.realizedGainBase).toBe('4990');
    // remaining position: 0.5 BTC with remaining cost basis 5005
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
        timestampISO: '2025-01-03T00:00:00.000Z'
      })
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
    // acquired ETH cost basis equals valuationBase (fee not added)
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
        feeAmount: '0.001'
      })
    ];
    expect(() => replayLedgerToLotsAndDisposals(events, s())).toThrow(/ledger_fee_missing_value_base/);
  });
});
