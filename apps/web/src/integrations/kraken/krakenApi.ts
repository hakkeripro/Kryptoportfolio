import type { KrakenCredentials } from './krakenVault';
import type { KrakenLedgerEntry } from '@kp/core';

async function post<T>(apiBase: string, token: string, path: string, body: object): Promise<T> {
  const res = await fetch(`${apiBase}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error((err as any).message ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function krakenVerify(
  apiBase: string,
  token: string,
  creds: KrakenCredentials,
): Promise<{ ok: boolean }> {
  return post(apiBase, token, '/v1/import/kraken/verify', creds);
}

export async function krakenFetchLedgers(
  apiBase: string,
  token: string,
  creds: KrakenCredentials,
  offset = 0,
  start?: number,
): Promise<{ entries: KrakenLedgerEntry[]; count: number }> {
  return post(apiBase, token, '/v1/import/kraken/ledgers', { ...creds, offset, start });
}
