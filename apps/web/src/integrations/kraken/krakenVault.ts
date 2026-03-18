import { z } from 'zod';
import { createVaultBlob, getMeta, openVaultBlob, setMeta } from '@kp/platform-web';

const KrakenCredsSchema = z.object({
  apiKey: z.string().min(1),
  apiSecret: z.string().min(1),
});

export const KrakenIntegrationSchema = z.object({
  schemaVersion: z.literal(1),
  credentials: KrakenCredsSchema.optional(),
  settings: z
    .object({
      autoSync: z.boolean().default(false),
      lastFetchedOffset: z.number().int().min(0).default(0),
      lastFetchedTs: z.number().int().optional(), // unix seconds cursor
    })
    .default({ autoSync: false, lastFetchedOffset: 0 }),
});

export type KrakenIntegration = z.infer<typeof KrakenIntegrationSchema>;
export type KrakenCredentials = z.infer<typeof KrakenCredsSchema>;

const META_KEY = 'vault_kraken_v1';

export async function loadKrakenIntegration(passphrase: string): Promise<KrakenIntegration> {
  const blobJson = await getMeta(META_KEY);
  if (!blobJson) {
    return KrakenIntegrationSchema.parse({ schemaVersion: 1 });
  }
  const blob = JSON.parse(blobJson);
  const payload = await openVaultBlob(passphrase, blob);
  return KrakenIntegrationSchema.parse(payload);
}

export async function saveKrakenIntegration(
  passphrase: string,
  data: KrakenIntegration,
): Promise<void> {
  const parsed = KrakenIntegrationSchema.parse(data);
  const blob = await createVaultBlob(passphrase, parsed);
  await setMeta(META_KEY, JSON.stringify(blob));
}

export async function clearKrakenIntegration(): Promise<void> {
  await setMeta(META_KEY, '');
}
