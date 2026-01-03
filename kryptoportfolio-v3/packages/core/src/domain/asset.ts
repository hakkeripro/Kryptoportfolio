import { z } from 'zod';
import { BaseEntityFields } from './common.js';

export const AssetType = z.enum(['crypto', 'stable', 'fiat', 'lp', 'other']);

export const ProviderRef = z.object({
  coingeckoId: z.string().min(1).optional()
});

export const Asset = z.object({
  ...BaseEntityFields,
  symbol: z.string().min(1),
  name: z.string().min(1),
  decimals: z.number().int().positive().optional(),
  type: AssetType.optional(),
  providerRef: ProviderRef,
  color: z.string().optional(),
  isActive: z.boolean(),
  metadata: z
    .object({
      tags: z.array(z.string()).optional(),
      notes: z.string().optional()
    })
    .optional()
});

export type Asset = z.infer<typeof Asset>;
