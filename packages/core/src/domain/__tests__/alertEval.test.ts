import { describe, expect, it } from 'vitest';
import { evaluateServerAlert, type MirrorState } from '../../alerts/serverAlertEval';
import { AlertSchema, MirrorStateSchema } from '../alert';

const BTC = 'asset_btc_1234';

const baseState: MirrorState = MirrorStateSchema.parse({
  nowISO: '2025-01-01T00:00:00.000Z',
  baseCurrency: 'EUR',
  provider: 'coingecko',
  portfolioValueBase: '1000',
  peakPortfolioValueBase: '1200',
  assetPrices: { [BTC]: '50000' },
  allocationPct: { [BTC]: '0.5' },
  priceHistory: {
    [BTC]: [
      { timestampISO: '2024-12-31T00:00:00.000Z', priceBase: '40000' },
      { timestampISO: '2025-01-01T00:00:00.000Z', priceBase: '50000' }
    ]
  },
  driftPct: { [BTC]: '0.10' }
});

describe('server alert eval', () => {
  it('price above triggers', () => {
    const alert = AlertSchema.parse({
      id: 'alert_001',
      schemaVersion: 1,
      createdAtISO: baseState.nowISO,
      updatedAtISO: baseState.nowISO,
      type: 'PRICE',
      assetId: BTC,
      direction: 'ABOVE',
      thresholdBase: '49000',
      cooldownMin: 0,
      isEnabled: true,
      source: 'server'
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('drawdown triggers', () => {
    const alert = AlertSchema.parse({
      id: 'alert_002',
      schemaVersion: 1,
      createdAtISO: baseState.nowISO,
      updatedAtISO: baseState.nowISO,
      type: 'DRAWDOWN',
      thresholdPct: '0.15',
      isEnabled: true,
      source: 'server'
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });
});
