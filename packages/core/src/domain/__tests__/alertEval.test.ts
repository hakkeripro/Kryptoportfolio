import { describe, expect, it } from 'vitest';
import { evaluateServerAlert } from '../../alerts/serverAlertEval';
import { AlertSchema, MirrorStateSchema } from '../alert';
import type { Alert, MirrorState } from '../alert';

const BTC = 'asset_btc_1234';
const ETH = 'asset_eth_5678';

const baseState: MirrorState = MirrorStateSchema.parse({
  nowISO: '2025-01-01T00:00:00.000Z',
  baseCurrency: 'EUR',
  provider: 'coingecko',
  portfolioValueBase: '1000',
  peakPortfolioValueBase: '1200',
  assetPrices: { [BTC]: '50000', [ETH]: '3000' },
  allocationPct: { [BTC]: '0.5', [ETH]: '0.3' },
  priceHistory: {
    [BTC]: [
      { timestampISO: '2024-12-31T00:00:00.000Z', priceBase: '40000' },
      { timestampISO: '2025-01-01T00:00:00.000Z', priceBase: '50000' },
    ],
  },
  driftPct: { [BTC]: '0.10', [ETH]: '0.02' },
});

function makeAlert(overrides: Partial<Alert>): Alert {
  return AlertSchema.parse({
    id: 'alert_test_001',
    schemaVersion: 1,
    createdAtISO: baseState.nowISO,
    updatedAtISO: baseState.nowISO,
    type: 'PRICE',
    isEnabled: true,
    source: 'server',
    ...overrides,
  });
}

describe('server alert eval', () => {
  // ── PRICE ──

  it('price ABOVE triggers when price >= threshold', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      direction: 'ABOVE',
      thresholdBase: '49000',
      cooldownMin: 0,
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('price ABOVE does not trigger when price < threshold', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      direction: 'ABOVE',
      thresholdBase: '60000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('price BELOW triggers when price <= threshold', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      direction: 'BELOW',
      thresholdBase: '55000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('price BELOW does not trigger when price > threshold', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      direction: 'BELOW',
      thresholdBase: '40000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('price defaults direction to ABOVE', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '49000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
    if (r.triggered) {
      expect(r.context.direction).toBe('ABOVE');
    }
  });

  it('price missing assetId returns not triggered', () => {
    const alert = makeAlert({
      type: 'PRICE',
      thresholdBase: '49000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing assetId');
  });

  it('price missing thresholdBase returns not triggered', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing thresholdBase');
  });

  it('price missing price data returns not triggered', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: 'asset_unknown_xyz',
      thresholdBase: '100',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing price');
  });

  // ── PORTFOLIO_VALUE ──

  it('portfolio value ABOVE triggers', () => {
    const alert = makeAlert({
      type: 'PORTFOLIO_VALUE',
      direction: 'ABOVE',
      thresholdBase: '900',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('portfolio value BELOW triggers', () => {
    const alert = makeAlert({
      type: 'PORTFOLIO_VALUE',
      direction: 'BELOW',
      thresholdBase: '1100',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('portfolio value missing thresholdBase', () => {
    const alert = makeAlert({ type: 'PORTFOLIO_VALUE' });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing thresholdBase');
  });

  // ── DRAWDOWN ──

  it('drawdown triggers when dd >= threshold', () => {
    const alert = makeAlert({
      type: 'DRAWDOWN',
      thresholdPct: '0.15',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('drawdown does not trigger when dd < threshold', () => {
    const alert = makeAlert({
      type: 'DRAWDOWN',
      thresholdPct: '0.50',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('drawdown missing peak returns not triggered', () => {
    const stateNoPeak: MirrorState = { ...baseState, peakPortfolioValueBase: undefined };
    const alert = makeAlert({
      type: 'DRAWDOWN',
      thresholdPct: '0.10',
    });
    const r = evaluateServerAlert(alert, stateNoPeak);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing peak');
  });

  it('drawdown with zero peak returns not triggered', () => {
    const stateZeroPeak: MirrorState = { ...baseState, peakPortfolioValueBase: '0' };
    const alert = makeAlert({
      type: 'DRAWDOWN',
      thresholdPct: '0.10',
    });
    const r = evaluateServerAlert(alert, stateZeroPeak);
    expect(r.triggered).toBe(false);
  });

  it('drawdown missing thresholdPct', () => {
    const alert = makeAlert({ type: 'DRAWDOWN' });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing thresholdPct');
  });

  // ── PCT_CHANGE ──

  it('pct change triggers when change >= threshold', () => {
    const alert = makeAlert({
      type: 'PCT_CHANGE',
      assetId: BTC,
      thresholdPct: '0.20',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('pct change does not trigger when change < threshold', () => {
    const alert = makeAlert({
      type: 'PCT_CHANGE',
      assetId: BTC,
      thresholdPct: '0.50',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('pct change missing assetId', () => {
    const alert = makeAlert({
      type: 'PCT_CHANGE',
      thresholdPct: '0.10',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing assetId');
  });

  it('pct change missing history', () => {
    const alert = makeAlert({
      type: 'PCT_CHANGE',
      assetId: ETH,
      thresholdPct: '0.10',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing history');
  });

  it('pct change missing thresholdPct', () => {
    const alert = makeAlert({
      type: 'PCT_CHANGE',
      assetId: BTC,
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing thresholdPct');
  });

  // ── DRIFT ──

  it('drift triggers when any asset drift >= threshold', () => {
    const alert = makeAlert({
      type: 'DRIFT',
      thresholdPct: '0.05',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
    if (r.triggered) {
      expect(r.context.assetId).toBe(BTC);
    }
  });

  it('drift does not trigger when all drifts < threshold', () => {
    const alert = makeAlert({
      type: 'DRIFT',
      thresholdPct: '0.50',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('drift missing driftPct data', () => {
    const stateNoDrift: MirrorState = { ...baseState, driftPct: undefined };
    const alert = makeAlert({
      type: 'DRIFT',
      thresholdPct: '0.05',
    });
    const r = evaluateServerAlert(alert, stateNoDrift);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing drift');
  });

  it('drift missing thresholdPct', () => {
    const alert = makeAlert({ type: 'DRIFT' });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing thresholdPct');
  });

  // ── TAKE_PROFIT ──

  it('take profit triggers when price >= threshold', () => {
    const alert = makeAlert({
      type: 'TAKE_PROFIT',
      assetId: BTC,
      thresholdBase: '45000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('take profit does not trigger when price < threshold', () => {
    const alert = makeAlert({
      type: 'TAKE_PROFIT',
      assetId: BTC,
      thresholdBase: '60000',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
  });

  it('take profit missing fields', () => {
    const alert = makeAlert({ type: 'TAKE_PROFIT' });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing fields');
  });

  it('take profit missing price data', () => {
    const alert = makeAlert({
      type: 'TAKE_PROFIT',
      assetId: 'asset_unknown',
      thresholdBase: '100',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('missing price');
  });

  // ── GLOBAL GUARDS ──

  it('disabled alert never triggers', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      isEnabled: false,
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('disabled');
  });

  it('snoozed alert does not trigger', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      snoozedUntilISO: '2025-12-31T00:00:00.000Z',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('snoozed');
  });

  it('expired snooze allows trigger', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      snoozedUntilISO: '2024-12-31T00:00:00.000Z',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('cooldown prevents trigger within window', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      cooldownMin: 60,
      lastTriggeredAtISO: '2025-01-01T00:00:00.000Z',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('cooldown');
  });

  it('cooldown expired allows trigger', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      cooldownMin: 60,
      lastTriggeredAtISO: '2024-12-31T00:00:00.000Z',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('cooldownMin 0 does not block', () => {
    const alert = makeAlert({
      type: 'PRICE',
      assetId: BTC,
      thresholdBase: '1',
      direction: 'ABOVE',
      cooldownMin: 0,
      lastTriggeredAtISO: '2025-01-01T00:00:00.000Z',
    });
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(true);
  });

  it('unsupported alert type returns not triggered', () => {
    const alert = { ...makeAlert({ type: 'PRICE' }), type: 'UNKNOWN_TYPE' as any };
    const r = evaluateServerAlert(alert, baseState);
    expect(r.triggered).toBe(false);
    expect(r.context.reason).toBe('unsupported type');
  });
});
