import { z } from 'zod';
import { DecimalString, IsoString, UuidString } from './common.js';

export const Lot = z.object({
  lotId: z.string().min(1),
  assetId: UuidString,
  acquiredAtISO: IsoString,
  amountRemaining: DecimalString,
  costBasisBaseRemaining: DecimalString,
  originEventId: UuidString
});

export type Lot = z.infer<typeof Lot>;

export const DisposalLotMatch = z.object({
  lotId: z.string().min(1),
  amount: DecimalString,
  costBasisBase: DecimalString
});

export const Disposal = z.object({
  eventId: UuidString,
  assetId: UuidString,
  disposedAtISO: IsoString,
  amount: DecimalString,
  proceedsBase: DecimalString,
  costBasisBase: DecimalString,
  feeBase: DecimalString,
  realizedGainBase: DecimalString,
  lotsMatched: z.array(DisposalLotMatch),
  taxYear: z.number().int()
});

export type Disposal = z.infer<typeof Disposal>;

export const Position = z.object({
  assetId: UuidString,
  amount: DecimalString,
  valueBase: DecimalString.optional(),
  avgCostBase: DecimalString.optional(),
  costBasisBase: DecimalString.optional(),
  unrealizedPnlBase: DecimalString.optional(),
  unrealizedPnlPct: DecimalString.optional()
});

export type Position = z.infer<typeof Position>;

export const TxMarker = z.object({
  eventId: UuidString,
  type: z.string().min(1),
  timestampISO: IsoString,
  assetId: UuidString,
  valueBase: DecimalString.optional()
});

export type TxMarker = z.infer<typeof TxMarker>;

export const PortfolioSnapshot = z.object({
  dayISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  totalValueBase: DecimalString,
  realizedPnlBaseToDate: DecimalString.optional(),
  unrealizedPnlBase: DecimalString.optional(),
  positions: z.array(
    z.object({
      assetId: UuidString,
      amount: DecimalString,
      valueBase: DecimalString,
      costBasisBase: DecimalString,
      unrealizedPnlBase: DecimalString.optional()
    })
  ),
  txMarkers: z.array(TxMarker)
});

export type PortfolioSnapshot = z.infer<typeof PortfolioSnapshot>;
