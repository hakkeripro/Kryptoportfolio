import { SignJWT } from 'jose';

/**
 * Coinbase App API Key Authentication (CDP Secret API Keys) requires ES256 (ECDSA P-256).
 *
 * This worker implementation accepts both:
 *  - PKCS8 PEM (-----BEGIN PRIVATE KEY-----)
 *  - OpenSSL EC PEM (SEC1) (-----BEGIN EC PRIVATE KEY-----)
 *
 * For SEC1 keys we wrap the DER in a PKCS8 PrivateKeyInfo.
 */

export class CoinbaseKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoinbaseKeyError';
  }
}

export type CoinbaseJwtInput = {
  keyName: string;
  privateKeyPem: string;
  method: string;
  requestPath: string;
};

type KeyFileLike = {
  name?: unknown;
  keyName?: unknown;
  privateKey?: unknown;
  private_key?: unknown;
  key_secret?: unknown;
  api_secret?: unknown;
};

function stripSurroundingQuotes(s: string): string {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function maybeExtractFromJson(input: string): { extractedKeyName?: string; extractedPem?: string } {
  const t = input.trim();
  if (!(t.startsWith('{') && t.endsWith('}'))) return {};
  try {
    const obj = JSON.parse(t) as KeyFileLike;
    const extractedKeyName =
      typeof obj.name === 'string' ? obj.name : typeof obj.keyName === 'string' ? obj.keyName : undefined;
    const extractedPem =
      typeof obj.privateKey === 'string'
        ? obj.privateKey
        : typeof obj.private_key === 'string'
          ? obj.private_key
          : typeof obj.key_secret === 'string'
            ? obj.key_secret
            : typeof obj.api_secret === 'string'
              ? obj.api_secret
              : undefined;
    return { extractedKeyName, extractedPem };
  } catch {
    return {};
  }
}

function normalizePem(pemInput: string): string {
  let pem = stripSurroundingQuotes(pemInput);
  pem = pem.replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n');
  pem = pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  pem = pem
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (/^BEGIN\s+[A-Z0-9 ]+PRIVATE KEY$/.test(t) && !t.startsWith('-----BEGIN')) return `-----${t}-----`;
      if (/^END\s+[A-Z0-9 ]+PRIVATE KEY$/.test(t) && !t.startsWith('-----END')) return `-----${t}-----`;
      return line;
    })
    .join('\n')
    .trim();

  if (/BEGIN ENCRYPTED PRIVATE KEY/.test(pem) || /Proc-Type: 4,ENCRYPTED/.test(pem)) {
    throw new CoinbaseKeyError('coinbase_key_encrypted_not_supported');
  }
  if (!pem.includes('BEGIN') || !pem.includes('PRIVATE KEY')) {
    throw new CoinbaseKeyError('coinbase_key_invalid_pem');
  }
  return pem;
}

function pemToDer(pem: string): Uint8Array {
  const lines = pem
    .trim()
    .split('\n')
    .filter((l) => !l.startsWith('-----'));
  const b64 = lines.join('');
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function derConcat(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function derLen(n: number): Uint8Array {
  if (n < 128) return new Uint8Array([n]);
  const bytes: number[] = [];
  let x = n;
  while (x > 0) {
    bytes.unshift(x & 0xff);
    x >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function derTag(tag: number, content: Uint8Array): Uint8Array {
  return derConcat(new Uint8Array([tag]), derLen(content.length), content);
}

function derSeq(content: Uint8Array): Uint8Array {
  return derTag(0x30, content);
}

function derOctetString(content: Uint8Array): Uint8Array {
  return derTag(0x04, content);
}

function derInteger(n: number): Uint8Array {
  return derTag(0x02, new Uint8Array([n]));
}

// OID bytes helpers: only what we need.
function oidBytes(parts: number[]): Uint8Array {
  // first byte = 40*first + second
  const out: number[] = [parts[0] * 40 + parts[1]];
  for (const p of parts.slice(2)) {
    // base128
    const stack: number[] = [];
    let v = p;
    stack.unshift(v & 0x7f);
    v >>= 7;
    while (v > 0) {
      stack.unshift(0x80 | (v & 0x7f));
      v >>= 7;
    }
    out.push(...stack);
  }
  return new Uint8Array(out);
}

function derOID(parts: number[]): Uint8Array {
  return derTag(0x06, oidBytes(parts));
}

// Wrap SEC1 EC PRIVATE KEY into PKCS8 PrivateKeyInfo (RFC 5208).
function wrapSec1ToPkcs8(sec1Der: Uint8Array): Uint8Array {
  const idEcPublicKey = derOID([1, 2, 840, 10045, 2, 1]);
  const prime256v1 = derOID([1, 2, 840, 10045, 3, 1, 7]);
  const algId = derSeq(derConcat(idEcPublicKey, prime256v1));
  const version = derInteger(0);
  const privateKey = derOctetString(sec1Der);
  return derSeq(derConcat(version, algId, privateKey));
}

async function importP256PrivateKey(pem: string): Promise<CryptoKey> {
  const isSec1 = /BEGIN EC PRIVATE KEY/.test(pem);
  const isPkcs8 = /BEGIN PRIVATE KEY/.test(pem) && !isSec1;
  const der = pemToDer(pem);
  const pkcs8 = isSec1 ? wrapSec1ToPkcs8(der) : der;
  if (!isSec1 && !isPkcs8) {
    // We only support these two for now.
    throw new CoinbaseKeyError('coinbase_key_invalid_pem');
  }
  try {
    return await crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'ECDSA', namedCurve: 'P-256' },
      false,
      ['sign']
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new CoinbaseKeyError(`coinbase_key_decode_failed: ${msg}`);
  }
}

export async function normalizeCoinbaseCredentials(input: {
  keyName?: string;
  privateKeyPem: string;
}): Promise<{ keyName: string; privateKeyPem: string; cryptoKey: CryptoKey }> {
  const { extractedKeyName, extractedPem } = maybeExtractFromJson(input.privateKeyPem);
  const keyName = (input.keyName && input.keyName.trim()) || extractedKeyName;
  if (!keyName || typeof keyName !== 'string' || keyName.trim().length === 0) {
    throw new CoinbaseKeyError('coinbase_keyName_required');
  }
  const pem = normalizePem(extractedPem ?? input.privateKeyPem);
  const cryptoKey = await importP256PrivateKey(pem);
  return { keyName: keyName.trim(), privateKeyPem: pem, cryptoKey };
}

function randomHex(nBytes: number): string {
  const b = crypto.getRandomValues(new Uint8Array(nBytes));
  return [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
}

export async function buildCoinbaseJwt({ keyName, privateKeyPem, method, requestPath }: CoinbaseJwtInput): Promise<string> {
  if (!requestPath.startsWith('/')) throw new Error('coinbase_requestPath_must_start_with_slash');

  const now = Math.floor(Date.now() / 1000);
  const nonce = randomHex(16);

  const { cryptoKey } = await normalizeCoinbaseCredentials({ keyName, privateKeyPem });

  return new SignJWT({
    iss: 'cdp',
    uri: `${method.toUpperCase()} api.coinbase.com${requestPath}`,
    nbf: now,
    exp: now + 120
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: keyName, nonce })
    .setSubject(keyName)
    .sign(cryptoKey);
}
