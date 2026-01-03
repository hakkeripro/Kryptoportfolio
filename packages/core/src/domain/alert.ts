import { z } from 'zod';
import { BaseEntityFields, DecimalString, IsoString, UuidString } from './common.js';

export const AlertTypeEnum = z.enum([
  'PRICE',
  'PORTFOLIO_VALUE',
  'PCT_CHANGE',
  'DRAWDOWN',
  'DRIFT',
  'TAKE_PROFIT'
]);
export type AlertType = z.infer<typeof AlertTypeEnum>;

export const AlertDirectionEnum = z.enum(['ABOVE', 'BELOW']);
export type AlertDirection = z.infer<typeof AlertDirectionEnum>;

export const AlertSourceEnum = z.enum(['foreground', 'server', 'both']);
export type AlertSource = z.infer<typeof AlertSourceEnum>;

export const AlertSchema = z.object({
  ...BaseEntityFields,
  type: AlertTypeEnum,
  assetId: UuidString.optional(),
  thresholdBase: DecimalString.optional(),
  thresholdPct: DecimalString.optional(),
  direction: AlertDirectionEnum.optional(),
  cooldownMin: z.number().int().nonnegative().optional(),
  snoozedUntilISO: IsoString.optional(),
  isEnabled: z.boolean(),
  lastTriggeredAtISO: IsoString.optional(),
  source: AlertSourceEnum
});

export type Alert = z.infer<typeof AlertSchema>;

export const AlertTriggerLogSchema = z.object({
  ...BaseEntityFields,
  alertId: UuidString,
  triggeredAtISO: IsoString,
  source: z.enum(['foreground', 'server']),
  context: z.record(z.any())
});
export type AlertTriggerLog = z.infer<typeof AlertTriggerLogSchema>;

// Mirror state for server-side runner (explicit opt-in, not part of ciphertext sync)
export const MirrorStateSchema = z.object({
  baseCurrency: z.string().min(3),
  provider: z.string().min(1),
  nowISO: IsoString,
  portfolioValueBase: DecimalString,
  peakPortfolioValueBase: DecimalString.optional(),
  assetPrices: z.record(UuidString, DecimalString),
  allocationPct: z.record(UuidString, DecimalString).optional(),
  // Optional history points for pct-change evaluation
  portfolioHistory: z.array(z.object({ timestampISO: IsoString, valueBase: DecimalString })).optional(),
  priceHistory: z.record(UuidString, z.array(z.object({ timestampISO: IsoString, priceBase: DecimalString }))).optional(),
  driftPct: z.record(UuidString, DecimalString).optional()
});
export type MirrorState = z.infer<typeof MirrorStateSchema>;
