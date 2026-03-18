/**
 * Binance HMAC-SHA256 request signing.
 * Signs querystring + body with the API secret.
 */
import { createHmac } from 'crypto';

export function signBinanceRequest(queryString: string, apiSecret: string): string {
  return createHmac('sha256', apiSecret).update(queryString).digest('hex');
}

export function buildBinanceQueryString(params: Record<string, string | number | boolean>): string {
  return Object.entries(params)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}
