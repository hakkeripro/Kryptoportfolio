import { z } from 'zod';

export const IsoString = z.string().refine((s) => {
  const d = new Date(s);
  return !Number.isNaN(d.getTime()) && d.toISOString() === s;
}, 'Invalid ISO timestamp');

export const UuidString = z.string().min(8);

export const DecimalString = z
  .string()
  .refine((s) => /^-?\d+(\.\d+)?$/.test(s), 'Invalid decimal string');

export const BaseEntityFields = {
  id: UuidString,
  createdAtISO: IsoString,
  updatedAtISO: IsoString,
  schemaVersion: z.number().int().nonnegative(),
  isDeleted: z.boolean().optional()
};
