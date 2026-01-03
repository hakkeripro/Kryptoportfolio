import { z } from 'zod';
import { BaseEntityFields, DecimalString, IsoString, UuidString } from './common.js';

export const PriceSource = z.enum(['live', 'cached', 'imported']);

export const PricePoint = z.object({
  ...BaseEntityFields,
  assetId: UuidString,
  provider: z.string().min(1),
  timestampISO: IsoString,
  priceBase: DecimalString,
  source: PriceSource
});

export type PricePoint = z.infer<typeof PricePoint>;
