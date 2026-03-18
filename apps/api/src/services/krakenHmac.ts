/**
 * Kraken HMAC-SHA512 request signing.
 * Kraken signature: HMAC-SHA512 of (URI_path + SHA256(nonce + body)), signed with base64-decoded API secret.
 */
import { createHash, createHmac } from 'crypto';

export function signKrakenRequest(
  uriPath: string,
  nonce: string,
  body: string,
  apiSecret: string,
): string {
  const hash = createHash('sha256').update(nonce + body).digest();
  const message = Buffer.concat([Buffer.from(uriPath), hash]);
  const secretBuf = Buffer.from(apiSecret, 'base64');
  return createHmac('sha512', secretBuf).update(message).digest('base64');
}
