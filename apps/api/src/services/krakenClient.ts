/**
 * Kraken private API client.
 * All requests signed server-side; secret never exposed to client.
 */
import { signKrakenRequest } from './krakenHmac.js';
import type { KrakenLedgerEntry } from '@kp/core';

const KRAKEN_BASE = 'https://api.kraken.com';

interface KrakenCreds {
  apiKey: string;
  apiSecret: string;
}

interface KrakenApiResponse<T> {
  error: string[];
  result?: T;
}

async function krakenPrivate<T>(
  path: string,
  creds: KrakenCreds,
  params: Record<string, string | number> = {},
): Promise<T> {
  const nonce = String(Date.now() * 1000);
  const bodyParams = new URLSearchParams({
    nonce,
    ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])),
  });
  const body = bodyParams.toString();
  const signature = signKrakenRequest(path, nonce, body, creds.apiSecret);

  const res = await fetch(`${KRAKEN_BASE}${path}`, {
    method: 'POST',
    headers: {
      'API-Key': creds.apiKey,
      'API-Sign': signature,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kraken API error ${res.status}: ${text}`);
  }

  const data = (await res.json()) as KrakenApiResponse<T>;
  if (data.error.length > 0) {
    throw new Error(`Kraken API error: ${data.error.join(', ')}`);
  }
  return data.result as T;
}

/** Verify API key by fetching account balance */
export async function krakenVerifyKey(creds: KrakenCreds): Promise<{ ok: boolean }> {
  await krakenPrivate('/0/private/Balance', creds);
  return { ok: true };
}

interface KrakenLedgersResult {
  ledger: Record<string, KrakenLedgerEntry>;
  count: number;
}

/** Fetch Kraken ledger entries, paginated by offset */
export async function krakenFetchLedgers(
  creds: KrakenCreds,
  offset = 0,
  start?: number,
): Promise<{ entries: KrakenLedgerEntry[]; count: number }> {
  const params: Record<string, string | number> = { ofs: offset };
  if (start !== undefined) params.start = start;
  const result = await krakenPrivate<KrakenLedgersResult>('/0/private/Ledgers', creds, params);
  const entries = Object.values(result.ledger ?? {});
  return { entries, count: result.count };
}
