import Decimal from 'decimal.js';
import type { Alert, MirrorState } from '../domain/alert.js';

export type AlertEvalResult =
  | { triggered: false; context: { reason: string } }
  | { triggered: true; context: Record<string, unknown> & { reason: string } };

function dec(v: string): Decimal {
  return new Decimal(v);
}

function withinCooldown(nowISO: string, lastTriggeredAtISO?: string, cooldownMin = 0): boolean {
  if (!lastTriggeredAtISO || cooldownMin <= 0) return false;
  const now = new Date(nowISO).getTime();
  const last = new Date(lastTriggeredAtISO).getTime();
  return now - last < cooldownMin * 60_000;
}

export function evaluateServerAlert(alert: Alert, state: MirrorState): AlertEvalResult {
  if (!alert.isEnabled) return { triggered: false, context: { reason: 'disabled' } };
  if (alert.snoozedUntilISO && new Date(alert.snoozedUntilISO).getTime() > new Date(state.nowISO).getTime()) {
    return { triggered: false, context: { reason: 'snoozed' } };
  }
  if (withinCooldown(state.nowISO, alert.lastTriggeredAtISO, alert.cooldownMin ?? 0)) {
    return { triggered: false, context: { reason: 'cooldown' } };
  }

  switch (alert.type) {
    case 'PRICE': {
      if (!alert.assetId) return { triggered: false, context: { reason: 'missing assetId' } };
      if (!alert.thresholdBase) return { triggered: false, context: { reason: 'missing thresholdBase' } };
      const price = state.assetPrices[alert.assetId];
      if (!price) return { triggered: false, context: { reason: 'missing price' } };
      const threshold = dec(alert.thresholdBase);
      const current = dec(price);
      const dir = alert.direction ?? 'ABOVE';
      const ok = dir === 'ABOVE' ? current.greaterThanOrEqualTo(threshold) : current.lessThanOrEqualTo(threshold);
      return ok
        ? {
            triggered: true,
            context: {
              reason: `PRICE ${dir} ${alert.thresholdBase}`,
              type: 'PRICE',
              assetId: alert.assetId,
              currentPriceBase: price,
              thresholdBase: alert.thresholdBase,
              direction: dir,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    case 'PORTFOLIO_VALUE': {
      if (!alert.thresholdBase) return { triggered: false, context: { reason: 'missing thresholdBase' } };
      const current = dec(state.portfolioValueBase);
      const threshold = dec(alert.thresholdBase);
      const dir = alert.direction ?? 'ABOVE';
      const ok = dir === 'ABOVE' ? current.greaterThanOrEqualTo(threshold) : current.lessThanOrEqualTo(threshold);
      return ok
        ? {
            triggered: true,
            context: {
              reason: `PORTFOLIO_VALUE ${dir} ${alert.thresholdBase}`,
              type: 'PORTFOLIO_VALUE',
              currentValueBase: state.portfolioValueBase,
              thresholdBase: alert.thresholdBase,
              direction: dir,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    case 'DRAWDOWN': {
      if (!alert.thresholdPct) return { triggered: false, context: { reason: 'missing thresholdPct' } };
      const peak = state.peakPortfolioValueBase ? dec(state.peakPortfolioValueBase) : undefined;
      if (!peak || peak.lte(0)) return { triggered: false, context: { reason: 'missing peak' } };
      const current = dec(state.portfolioValueBase);
      const dd = peak.minus(current).div(peak); // 0..1
      const threshold = dec(alert.thresholdPct);
      const ok = dd.greaterThanOrEqualTo(threshold);
      return ok
        ? {
            triggered: true,
            context: {
              reason: `DRAWDOWN >= ${alert.thresholdPct}`,
              type: 'DRAWDOWN',
              peakValueBase: peak.toFixed(),
              currentValueBase: current.toFixed(),
              drawdownPct: dd.toFixed(),
              thresholdPct: alert.thresholdPct,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    case 'PCT_CHANGE': {
      if (!alert.assetId) return { triggered: false, context: { reason: 'missing assetId' } };
      if (!alert.thresholdPct) return { triggered: false, context: { reason: 'missing thresholdPct' } };
      const history = state.priceHistory?.[alert.assetId];
      const currentPrice = state.assetPrices[alert.assetId];
      if (!currentPrice || !history || history.length === 0) return { triggered: false, context: { reason: 'missing history' } };

      // use oldest point as reference (caller provides window-specific history)
      const ref = history[0]?.priceBase;
      if (!ref) return { triggered: false, context: { reason: 'missing ref' } };
      const pct = dec(currentPrice).minus(dec(ref)).div(dec(ref)).abs();
      const threshold = dec(alert.thresholdPct);
      const ok = pct.greaterThanOrEqualTo(threshold);
      return ok
        ? {
            triggered: true,
            context: {
              reason: `PCT_CHANGE >= ${alert.thresholdPct}`,
              type: 'PCT_CHANGE',
              assetId: alert.assetId,
              refPriceBase: ref,
              currentPriceBase: currentPrice,
              changePct: pct.toFixed(),
              thresholdPct: alert.thresholdPct,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    case 'DRIFT': {
      if (!alert.thresholdPct) return { triggered: false, context: { reason: 'missing thresholdPct' } };
      const threshold = dec(alert.thresholdPct);
      const drifts = state.driftPct;
      if (!drifts || Object.keys(drifts).length === 0) return { triggered: false, context: { reason: 'missing drift' } };
      const hit = Object.entries(drifts).find(([, v]) => dec(v).abs().greaterThanOrEqualTo(threshold));
      return hit
        ? {
            triggered: true,
            context: {
              reason: `DRIFT >= ${alert.thresholdPct}`,
              type: 'DRIFT',
              assetId: hit[0],
              driftPct: hit[1],
              thresholdPct: alert.thresholdPct,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    case 'TAKE_PROFIT': {
      if (!alert.assetId || !alert.thresholdBase) return { triggered: false, context: { reason: 'missing fields' } };
      const price = state.assetPrices[alert.assetId];
      if (!price) return { triggered: false, context: { reason: 'missing price' } };
      const ok = dec(price).greaterThanOrEqualTo(dec(alert.thresholdBase));
      return ok
        ? {
            triggered: true,
            context: {
              reason: `TAKE_PROFIT price >= ${alert.thresholdBase}`,
              type: 'TAKE_PROFIT',
              assetId: alert.assetId,
              currentPriceBase: price,
              triggerPriceBase: alert.thresholdBase,
              provider: state.provider
            }
          }
        : { triggered: false, context: { reason: 'not met' } };
    }
    default:
      return { triggered: false, context: { reason: 'unsupported type' } };
  }
}
