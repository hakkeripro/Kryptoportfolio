import { z } from 'zod';
import { createVaultBlob, getMeta, openVaultBlob, setMeta } from '@kp/platform-web';

const BinanceCredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export const BinanceIntegrationSchema = z.object({
  schemaVersion: z.literal(1),
  credentials: BinanceCredsSchema.optional(),
  settings: z
    .object({
      autoSync: z.boolean().default(false),
      lastFetchedTs: z.number().int().optional(), // unix ms cursor for incremental fetch
    })
    .default({ autoSync: false }),
});

export type BinanceIntegration = z.infer<typeof BinanceIntegrationSchema>;
export type BinanceCredentials = z.infer<typeof BinanceCredsSchema>;

const META_KEY = 'vault_binance_v1';

export async function loadBinanceIntegration(passphrase: string): Promise<BinanceIntegration> {
  const blobJson = await getMeta(META_KEY);
  if (!blobJson) {
    return BinanceIntegrationSchema.parse({ schemaVersion: 1 });
  }
  const blob = JSON.parse(blobJson);
  const payload = await openVaultBlob(passphrase, blob);
  return BinanceIntegrationSchema.parse(payload);
}

export async function saveBinanceIntegration(
  passphrase: string,
  data: BinanceIntegration,
): Promise<void> {
  const parsed = BinanceIntegrationSchema.parse(data);
  const blob = await createVaultBlob(passphrase, parsed);
  await setMeta(META_KEY, JSON.stringify(blob));
}

export async function clearBinanceIntegration(): Promise<void> {
  await setMeta(META_KEY, '');
}
