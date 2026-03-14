/**
 * Shared Zod schemas for sync endpoints (device registration, envelope CRUD).
 */
import { z } from 'zod';

export const DeviceSchema = z.object({
  deviceId: z.string().min(4),
  name: z.string().optional(),
});

export const EnvelopeSchema = z.object({
  id: z.string().min(8),
  deviceId: z.string().min(4),
  createdAtISO: z.string().datetime(),
  version: z.coerce.number().int().positive().default(1),
  kdf: z.object({
    saltBase64: z.string().min(8),
    iterations: z.coerce.number().int().positive(),
  }),
  ciphertextBase64: z.string().min(8),
  nonceBase64: z.string().min(8),
  checksum: z.string().optional(),
});

export const EnvelopeQuerySchema = z.object({
  afterCursor: z.coerce.number().int().nonnegative().default(0),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type DeviceInput = z.infer<typeof DeviceSchema>;
export type EnvelopeInput = z.infer<typeof EnvelopeSchema>;
export type EnvelopeQuery = z.infer<typeof EnvelopeQuerySchema>;

/**
 * Map a raw DB row (camelCase or snake_case) to the canonical envelope response shape.
 */
export function mapEnvelopeRow(r: Record<string, unknown>) {
  return {
    id: r.id as string,
    deviceId: (r.deviceId ?? r.device_id) as string,
    cursor: Number(r.cursor ?? 0),
    createdAtISO: (r.createdAtISO ?? r.created_at_iso) as string,
    version: Number(r.version ?? 1),
    kdf: {
      saltBase64: String(r.kdfSaltBase64 ?? r.kdf_salt_base64 ?? ''),
      iterations: Number(r.kdfIterations ?? r.kdf_iterations ?? 0),
    },
    ciphertextBase64: (r.ciphertextBase64 ?? r.ciphertext_base64) as string,
    nonceBase64: (r.nonceBase64 ?? r.nonce_base64) as string,
    checksum: (r.checksum as string | undefined) ?? undefined,
  };
}
