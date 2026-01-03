import { z } from 'zod';
import { BaseEntityFields } from './common.js';

export const LotMethod = z.enum(['FIFO', 'LIFO', 'HIFO', 'AVG_COST']);
export const RewardsCostBasisMode = z.enum(['ZERO', 'FMV']);
export const PriceProvider = z.enum(['coingecko', 'mock']);
export const TaxProfile = z.enum(['GENERIC', 'FINLAND']);

export const Settings = z.object({
  ...BaseEntityFields,
  baseCurrency: z.string().min(3),
  lotMethodDefault: LotMethod,
  rewardsCostBasisMode: RewardsCostBasisMode,
  priceProvider: PriceProvider,
  autoRefreshIntervalSec: z.union([z.literal(0), z.literal(60), z.literal(300), z.literal(900)]),
  taxProfile: TaxProfile,
  privacy: z.object({ telemetryOptIn: z.boolean() })
});

export type Settings = z.infer<typeof Settings>;
