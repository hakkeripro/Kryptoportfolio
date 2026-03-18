/**
 * Binance proxy API calls (client → our server → Binance).
 * Credentials are sent to our proxy, which signs and forwards requests.
 */
import type { BinanceCredentials } from './binanceVault';

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

export async function binanceVerify(
  apiBase: string,
  token: string,
  creds: BinanceCredentials,
): Promise<{ canTrade: boolean }> {
  return post(apiBase, token, '/v1/import/binance/verify', creds);
}

export async function binanceFetchTrades(
  apiBase: string,
  token: string,
  creds: BinanceCredentials,
  symbol: string,
  startTime?: number,
): Promise<{ trades: unknown[] }> {
  return post(apiBase, token, '/v1/import/binance/trades', { ...creds, symbol, startTime });
}

export async function binanceFetchDeposits(
  apiBase: string,
  token: string,
  creds: BinanceCredentials,
  startTime?: number,
): Promise<{ deposits: unknown[] }> {
  return post(apiBase, token, '/v1/import/binance/deposits', { ...creds, startTime });
}

export async function binanceFetchWithdrawals(
  apiBase: string,
  token: string,
  creds: BinanceCredentials,
  startTime?: number,
): Promise<{ withdrawals: unknown[] }> {
  return post(apiBase, token, '/v1/import/binance/withdrawals', { ...creds, startTime });
}
