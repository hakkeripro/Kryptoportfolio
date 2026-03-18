/**
 * Kraken HMAC-SHA512 signing for Cloudflare Workers (Web Crypto API).
 */

export async function signKrakenRequest(
  uriPath: string,
  nonce: string,
  body: string,
  apiSecret: string,
): Promise<string> {
  const encoder = new TextEncoder();

  // SHA256(nonce + body)
  const nonceBody = encoder.encode(nonce + body);
  const sha256 = await crypto.subtle.digest('SHA-256', nonceBody);

  // message = uriPath + sha256
  const pathBytes = encoder.encode(uriPath);
  const message = new Uint8Array(pathBytes.byteLength + sha256.byteLength);
  message.set(pathBytes, 0);
  message.set(new Uint8Array(sha256), pathBytes.byteLength);

  // HMAC-SHA512 with base64-decoded secret
  const secretBytes = Uint8Array.from(atob(apiSecret), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, message);
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}
