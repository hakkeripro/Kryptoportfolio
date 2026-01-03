import { z } from 'zod';
import { DecimalString, IsoString, UuidString } from './common.js';
import { TaxProfile } from './settings.js';
import { Disposal } from './portfolio.js';

/**
 * Derived report row for reward / airdrop income.
 *
 * NOTE: This is not persisted as source-of-truth; it is computed from the ledger.
 */
export const TaxIncomeRow = z.object({
  eventId: UuidString,
  assetId: UuidString,
  timestampISO: IsoString,
  amount: DecimalString,
  /** Income in base currency (0 in ZERO mode). */
  incomeBase: DecimalString,
  /**
   * The FMV in base currency used (only for FMV mode). Optional to allow warning rows.
   */
  fmvTotalBase: DecimalString.optional(),
  type: z.enum(['REWARD', 'STAKING_REWARD', 'AIRDROP'])
});

export type TaxIncomeRow = z.infer<typeof TaxIncomeRow>;

export const TaxHoldingRow = z.object({
  assetId: UuidString,
  amount: DecimalString,
  costBasisBase: DecimalString
});

export type TaxHoldingRow = z.infer<typeof TaxHoldingRow>;

export const TaxYearTotals = z.object({
  proceedsBase: DecimalString,
  costBasisBase: DecimalString,
  feesBase: DecimalString,
  realizedGainBase: DecimalString,
  incomeBase: DecimalString
});

export type TaxYearTotals = z.infer<typeof TaxYearTotals>;

export const TaxYearReport = z.object({
  year: z.number().int().min(2000).max(2100),
  baseCurrency: z.string().min(3),
  taxProfile: TaxProfile,
  lotMethodUsed: z.enum(['FIFO', 'LIFO', 'HIFO', 'AVG_COST']),
  generatedAtISO: IsoString,
  disposals: z.array(Disposal),
  income: z.array(TaxIncomeRow),
  yearEndHoldings: z.array(TaxHoldingRow),
  totals: TaxYearTotals,
  warnings: z.array(z.string())
});

export type TaxYearReport = z.infer<typeof TaxYearReport>;
