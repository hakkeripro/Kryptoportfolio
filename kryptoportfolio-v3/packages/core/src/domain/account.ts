import { z } from 'zod';
import { BaseEntityFields } from './common.js';

export const AccountType = z.enum(['exchange', 'wallet', 'cold', 'defi', 'manual']);

export const Account = z.object({
  ...BaseEntityFields,
  name: z.string().min(1),
  type: AccountType,
  chain: z.string().optional(),
  address: z.string().optional(),
  isActive: z.boolean(),
  notes: z.string().optional()
});

export type Account = z.infer<typeof Account>;
