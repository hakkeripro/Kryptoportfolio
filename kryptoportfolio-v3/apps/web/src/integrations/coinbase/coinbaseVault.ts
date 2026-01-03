import { z } from 'zod';
import { createVaultBlob, getMeta, openVaultBlob, setMeta } from '@kp/platform-web';

const CoinbaseCredsSchema = z.object({
  keyName: z.string().min(1),
  privateKeyPem: z.string().min(1)
});

export const CoinbaseIntegrationSchema = z.object({
  schemaVersion: z.literal(1),
  credentials: CoinbaseCredsSchema.optional(),
  settings: z.object({
    autoSync: z.boolean().default(true),
    autoCommit: z.boolean().default(true),
    intervalMinutes: z.number().int().min(1).max(120).default(10),
    // latest imported tx id per Coinbase account id (used for incremental fetch)
    lastSeenTxIdByAccount: z.record(z.string(), z.string()).default({})
  }).default({ autoSync: true, autoCommit: true, intervalMinutes: 10, lastSeenTxIdByAccount: {} })
});

export type CoinbaseIntegration = z.infer<typeof CoinbaseIntegrationSchema>;
export type CoinbaseCredentials = z.infer<typeof CoinbaseCredsSchema>;

const META_KEY = 'vault_coinbase_v2';

export async function loadCoinbaseIntegration(passphrase: string): Promise<CoinbaseIntegration> {
  const blobJson = await getMeta(META_KEY);
  if (!blobJson) {
    return CoinbaseIntegrationSchema.parse({ schemaVersion: 1 });
  }
  const blob = JSON.parse(blobJson);
  const payload = await openVaultBlob(passphrase, blob);
  return CoinbaseIntegrationSchema.parse(payload);
}

export async function saveCoinbaseIntegration(passphrase: string, data: CoinbaseIntegration): Promise<void> {
  const parsed = CoinbaseIntegrationSchema.parse(data);
  const blob = await createVaultBlob(passphrase, parsed);
  await setMeta(META_KEY, JSON.stringify(blob));
}

export async function clearCoinbaseIntegration(): Promise<void> {
  await setMeta(META_KEY, '');
}
