import { createVaultBlob, openVaultBlob, type VaultBlob, type VaultKdfParams } from '../vault/webVault.js';

export type SyncEnvelope = {
  id: string;
  deviceId: string;
  createdAtISO: string;
  version: number;
  kdf: VaultKdfParams;
  ciphertextBase64: string;
  nonceBase64: string;
  checksum?: string;
};

export async function createSyncEnvelope(opts: {
  passphrase: string;
  deviceId: string;
  payload: unknown;
  id: string;
  createdAtISO?: string;
}): Promise<SyncEnvelope> {
  const createdAtISO = opts.createdAtISO ?? new Date().toISOString();
  const blob: VaultBlob = await createVaultBlob(opts.passphrase, opts.payload);
  return {
    id: opts.id,
    deviceId: opts.deviceId,
    createdAtISO,
    version: blob.version,
    kdf: blob.kdf,
    ciphertextBase64: blob.ciphertextBase64,
    nonceBase64: blob.nonceBase64
  };
}

export async function openSyncEnvelope(opts: { passphrase: string; envelope: SyncEnvelope }): Promise<any> {
  const blob: VaultBlob = {
    version: opts.envelope.version,
    kdf: opts.envelope.kdf,
    nonceBase64: opts.envelope.nonceBase64,
    ciphertextBase64: opts.envelope.ciphertextBase64
  };
  return openVaultBlob(opts.passphrase, blob);
}

async function apiFetch<T>(url: string, init: RequestInit): Promise<T> {
  const r = await fetch(url, init);
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`${r.status} ${txt}`);
  }
  return r.json() as any;
}

export async function registerDevice(apiBase: string, token: string, deviceId: string, name?: string) {
  return apiFetch(`${apiBase}/v1/devices/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify({ deviceId, name })
  });
}

export async function uploadEnvelope(apiBase: string, token: string, env: SyncEnvelope) {
  return apiFetch<{ ok: boolean; cursor: number }>(`${apiBase}/v1/sync/envelopes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: JSON.stringify(env)
  });
}

export async function pullEnvelopes(apiBase: string, token: string, afterCursor: number, limit = 200) {
  const qs = new URLSearchParams({ afterCursor: String(afterCursor), limit: String(limit) });
  return apiFetch<{ envelopes: Array<SyncEnvelope & { cursor: number }> }>(`${apiBase}/v1/sync/envelopes?${qs}`, {
    method: 'GET',
    headers: { authorization: `Bearer ${token}` }
  });
}
