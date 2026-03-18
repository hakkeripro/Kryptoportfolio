/**
 * Binance REST API client.
 * All requests are signed server-side; the API secret never leaves the server.
 */
import { signBinanceRequest, buildBinanceQueryString } from './binanceHmac.js';

const BINANCE_BASE = 'https://api.binance.com';
const BINANCE_SAPI = 'https://api.binance.com';

interface BinanceCreds {
  apiKey: string;
  apiSecret: string;
}

async function binanceFetch<T>(
  url: string,
  creds: BinanceCreds,
  params: Record<string, string | number | boolean> = {},
): Promise<T> {
  const ts = Date.now();
  const allParams = { ...params, timestamp: ts };
  const qs = buildBinanceQueryString(allParams);
  const sig = signBinanceRequest(qs, creds.apiSecret);
  const fullUrl = `${url}?${qs}&signature=${sig}`;

  const res = await fetch(fullUrl, {
    headers: {
      'X-MBX-APIKEY': creds.apiKey,
      'Content-Type': 'application/json',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Binance API error ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** Verify API key by calling GET /api/v3/account */
export async function binanceVerifyKey(creds: BinanceCreds): Promise<{ canTrade: boolean }> {
  const data = await binanceFetch<{ canTrade: boolean }>(`${BINANCE_BASE}/api/v3/account`, creds);
  return { canTrade: data.canTrade };
}

/** Fetch trades for a symbol. Returns up to 1000 per call. */
export async function binanceFetchTrades(
  creds: BinanceCreds,
  symbol: string,
  startTime?: number,
  limit = 1000,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean> = { symbol, limit };
  if (startTime) params.startTime = startTime;
  return binanceFetch<unknown[]>(`${BINANCE_BASE}/api/v3/myTrades`, creds, params);
}

/** Fetch deposit history */
export async function binanceFetchDeposits(
  creds: BinanceCreds,
  startTime?: number,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean> = {};
  if (startTime) params.startTime = startTime;
  return binanceFetch<unknown[]>(`${BINANCE_SAPI}/sapi/v1/capital/deposit/hisrec`, creds, params);
}

/** Fetch withdrawal history */
export async function binanceFetchWithdrawals(
  creds: BinanceCreds,
  startTime?: number,
): Promise<unknown[]> {
  const params: Record<string, string | number | boolean> = {};
  if (startTime) params.startTime = startTime;
  return binanceFetch<unknown[]>(`${BINANCE_SAPI}/sapi/v1/capital/withdraw/history`, creds, params);
}

/** Fetch dust conversion history */
export async function binanceFetchDust(creds: BinanceCreds): Promise<unknown> {
  return binanceFetch<unknown>(`${BINANCE_SAPI}/sapi/v1/asset/dribblet`, creds);
}
