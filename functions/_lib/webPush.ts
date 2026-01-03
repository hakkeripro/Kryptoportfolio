// Web Push (aes128gcm) + VAPID (ES256) implementation for Cloudflare Workers.
//
// Why this exists:
// - Pages Functions bundles to a classic Worker script.
// - Several popular web-push libs rely on Node APIs or ESM-only patterns that can
//   break ("Unexpected reserved word") in that environment.
//
// References:
// - RFC 8188 (Encrypted Content-Encoding for HTTP)
// - RFC 8291 (Web Push message encryption)
// - RFC 8292 (VAPID auth scheme)

const te = new TextEncoder();

export type WebPushSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export type VapidKeys = {
  subject: string; // e.g. "mailto:you@example.com" or https URL
  publicKey: string; // base64url (uncompressed P-256 point, 65 bytes)
  privateKey: string; // base64url (32 bytes)
};

export type WebPushPayload = {
  // JSON string payload (recommended) or plain text.
  data: string;
  ttl?: number;
};

function b64urlToBytes(s: string): Uint8Array {
  // pad to 4
  const padLen = (4 - (s.length % 4)) % 4;
  const padded = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat(padLen);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function bytesToB64url(b: ArrayBuffer | Uint8Array): string {
  const u = b instanceof Uint8Array ? b : new Uint8Array(b);
  let bin = '';
  for (let i = 0; i < u.length; i++) bin += String.fromCharCode(u[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function concatBytes(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let off = 0;
  for (const p of parts) {
    out.set(p, off);
    off += p.length;
  }
  return out;
}

async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt,
      info,
    },
    key,
    len * 8,
  );
  return new Uint8Array(bits);
}

async function importP256dhPublicKey(rawUncompressedPoint: Uint8Array): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', rawUncompressedPoint, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
}

async function generateServerEcdh(): Promise<{ publicKeyRaw: Uint8Array; privateKey: CryptoKey }> {
  const kp = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicKeyRaw = new Uint8Array(await crypto.subtle.exportKey('raw', kp.publicKey));
  return { publicKeyRaw, privateKey: kp.privateKey };
}

async function deriveEcdhSecret(serverPrivateKey: CryptoKey, uaPublicKey: CryptoKey): Promise<Uint8Array> {
  const bits = await crypto.subtle.deriveBits({ name: 'ECDH', public: uaPublicKey }, serverPrivateKey, 256);
  return new Uint8Array(bits);
}

async function makeVapidJwk(vapid: VapidKeys): Promise<JsonWebKey> {
  const pub = b64urlToBytes(vapid.publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) throw new Error('VAPID public key must be 65 bytes (uncompressed point)');
  const x = pub.slice(1, 33);
  const y = pub.slice(33, 65);
  const d = b64urlToBytes(vapid.privateKey);
  if (d.length !== 32) throw new Error('VAPID private key must be 32 bytes');
  return {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(x),
    y: bytesToB64url(y),
    d: bytesToB64url(d),
    key_ops: ['sign'],
    ext: true,
  };
}

async function signJwtEs256(vapid: VapidKeys, audienceOrigin: string, nowSec: number): Promise<string> {
  // RFC 8292 recommends exp no more than 24 hours.
  const header = { typ: 'JWT', alg: 'ES256' };
  const payload = {
    aud: audienceOrigin,
    exp: nowSec + 12 * 60 * 60,
    sub: vapid.subject,
  };

  const encodedHeader = bytesToB64url(te.encode(JSON.stringify(header)));
  const encodedPayload = bytesToB64url(te.encode(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  const jwk = await makeVapidJwk(vapid);
  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, te.encode(signingInput));
  const encodedSig = bytesToB64url(new Uint8Array(sig));
  return `${signingInput}.${encodedSig}`;
}

export async function buildWebPushRequest(
  sub: WebPushSubscription,
  vapid: VapidKeys,
  payload: WebPushPayload,
): Promise<{ url: string; init: RequestInit }> {
  const uaPublicRaw = b64urlToBytes(sub.keys.p256dh);
  const authSecret = b64urlToBytes(sub.keys.auth);
  const uaPublicKey = await importP256dhPublicKey(uaPublicRaw);

  const { publicKeyRaw: asPublicRaw, privateKey: asPrivateKey } = await generateServerEcdh();
  const ecdhSecret = await deriveEcdhSecret(asPrivateKey, uaPublicKey);

  // RFC 8291: key_info = "WebPush: info" || 0x00 || ua_public || as_public
  const keyInfo = concatBytes(te.encode('WebPush: info'), new Uint8Array([0x00]), uaPublicRaw, asPublicRaw);
  const ikm = await hkdf(ecdhSecret, authSecret, keyInfo, 32);

  // RFC 8188/8291: random 16-byte salt, derive CEK + NONCE
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: aes128gcm'), new Uint8Array([0x00])), 16);
  const nonce = await hkdf(ikm, salt, concatBytes(te.encode('Content-Encoding: nonce'), new Uint8Array([0x00])), 12);

  // RFC 8188 plaintext framing: data || 0x02 (last record delimiter)
  const dataBytes = te.encode(payload.data);
  const plaintext = concatBytes(dataBytes, new Uint8Array([0x02]));

  const aesKey = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: nonce,
      },
      aesKey,
      plaintext,
    ),
  );

  // RFC 8188 header block in the body:
  // salt(16) || rs(4) || idlen(1) || keyid(idlen)
  // For Web Push, we keep keyid empty and communicate as_public via Crypto-Key: dh=...
  const rs = 4096;
  const rsBytes = new Uint8Array([0, 0, (rs >> 8) & 0xff, rs & 0xff]);
  const headerBlock = concatBytes(salt, rsBytes, new Uint8Array([0x00]));
  const body = concatBytes(headerBlock, ciphertext);

  const endpoint = new URL(sub.endpoint);
  const aud = endpoint.origin;
  const nowSec = Math.floor(Date.now() / 1000);
  const jwt = await signJwtEs256(vapid, aud, nowSec);

  const ttl = payload.ttl ?? 60;

  const headers: Record<string, string> = {
    TTL: String(ttl),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    // RFC 8292 auth scheme: Authorization: vapid t=<jwt>, k=<publicKey>
    Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
    // Provide sender ECDH public key for the message
    'Crypto-Key': `dh=${bytesToB64url(asPublicRaw)}`,
  };

  return {
    url: sub.endpoint,
    init: {
      method: 'POST',
      headers,
      body,
    },
  };
}
