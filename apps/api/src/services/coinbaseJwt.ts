import crypto from 'node:crypto';

/**
 * Coinbase App API Key Authentication (CDP Secret API Keys) requires ES256 (ECDSA P-256).
 * The private key may be provided as:
 *  - a multi-line PEM
 *  - a single line PEM with escaped newlines ("\\n")
 *  - a downloaded JSON key file (containing `name` and `privateKey`).
 */

export class CoinbaseKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoinbaseKeyError';
  }
}

export type CoinbaseJwtInput = {
  /** CDP API key name (aka "key id"), e.g. organizations/.../apiKeys/... */
  keyName: string;
  /** PEM formatted EC private key for ES256 */
  privateKeyPem: string;
  /** HTTP method, e.g. GET */
  method: string;
  /** Request path without domain, MUST start with "/". Do not include a query string. */
  requestPath: string;
};

function base64url(input: Buffer): string {
  return input
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

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

  // Convert literal "\\n" sequences to actual newlines (common when pasting JSON/ENV).
  // Some UIs (including CDP download/paste) provide a single-line PEM with literal "\n".
  // Normalize both \r\n and \n variants.
  pem = pem.replace(/\\r\\n/g, '\n');
  pem = pem.replace(/\\n/g, '\n');
  pem = pem.replace(/\\r/g, '\n');

  // Also normalize actual CRLF to LF.
  pem = pem.replace(/\r\n/g, '\n');
  pem = pem.replace(/\r/g, '\n');

  // Some copy/paste flows drop the leading/trailing dashes from the BEGIN/END lines.
  // Fix up common variants:
  //   "BEGIN EC PRIVATE KEY"  -> "-----BEGIN EC PRIVATE KEY-----"
  //   "END EC PRIVATE KEY"    -> "-----END EC PRIVATE KEY-----"
  pem = pem
    .split('\n')
    .map((line) => {
      const t = line.trim();
      if (/^BEGIN\s+[A-Z0-9 ]+PRIVATE KEY$/.test(t) && !t.startsWith('-----BEGIN')) {
        return `-----${t.replace(/^BEGIN\s+/, 'BEGIN ')}-----`;
      }
      if (/^END\s+[A-Z0-9 ]+PRIVATE KEY$/.test(t) && !t.startsWith('-----END')) {
        return `-----${t.replace(/^END\s+/, 'END ')}-----`;
      }
      return line;
    })
    .join('\n');

  // Trim but keep interior newlines.
  pem = pem.trim();

  // Guard against encrypted keys (not supported in this app).
  if (/BEGIN ENCRYPTED PRIVATE KEY/.test(pem) || /Proc-Type: 4,ENCRYPTED/.test(pem)) {
    throw new CoinbaseKeyError('coinbase_key_encrypted_not_supported');
  }

  if (!pem.includes('BEGIN') || !pem.includes('PRIVATE KEY')) {
    throw new CoinbaseKeyError('coinbase_key_invalid_pem');
  }

  return pem;
}

const keyObjectCache = new Map<string, crypto.KeyObject>();

function getKeyObjectFromPem(privateKeyPem: string): crypto.KeyObject {
  const hash = crypto.createHash('sha256').update(privateKeyPem).digest('hex');
  const cached = keyObjectCache.get(hash);
  if (cached) return cached;

  let keyObj: crypto.KeyObject;
  try {
    // OpenSSL 3 in some Node builds can be picky about PEM auto-detection.
    // Provide a type hint when possible, and fall back to auto-detect.
    const typeHint: 'sec1' | 'pkcs8' | undefined =
      /BEGIN EC PRIVATE KEY/.test(privateKeyPem) ? 'sec1' : /BEGIN PRIVATE KEY/.test(privateKeyPem) ? 'pkcs8' : undefined;

    if (typeHint) {
      try {
        keyObj = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem', type: typeHint });
      } catch {
        // Fallback to auto-detect.
        keyObj = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem' });
      }
    } else {
      keyObj = crypto.createPrivateKey({ key: privateKeyPem, format: 'pem' });
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Surface a deterministic error code; keep original OpenSSL message for logs/UI.
    throw new CoinbaseKeyError(`coinbase_key_decode_failed: ${msg}`);
  }

  if (keyObj.asymmetricKeyType !== 'ec') {
    throw new CoinbaseKeyError(`coinbase_key_wrong_type: ${keyObj.asymmetricKeyType}`);
  }
  const curve = (keyObj.asymmetricKeyDetails as any)?.namedCurve;
  // Node reports P-256 as "prime256v1".
  if (curve && curve !== 'prime256v1') {
    throw new CoinbaseKeyError(`coinbase_key_wrong_curve: ${curve}`);
  }

  keyObjectCache.set(hash, keyObj);
  return keyObj;
}

export function normalizeCoinbaseCredentials(input: {
  keyName?: string;
  privateKeyPem: string;
}): { keyName: string; privateKeyPem: string } {
  const { extractedKeyName, extractedPem } = maybeExtractFromJson(input.privateKeyPem);
  const keyName = (input.keyName && input.keyName.trim()) || extractedKeyName;
  if (!keyName || typeof keyName !== 'string' || keyName.trim().length === 0) {
    throw new CoinbaseKeyError('coinbase_keyName_required');
  }

  const pem = normalizePem(extractedPem ?? input.privateKeyPem);
  // Validate now (and cache), so errors are cleanly reported.
  getKeyObjectFromPem(pem);

  return { keyName: keyName.trim(), privateKeyPem: pem };
}

/**
 * Coinbase App (v2) API Key Authentication uses JWT (ES256).
 * Docs: "Coinbase App API Key Authentication".
 */
export function buildCoinbaseJwt({ keyName, privateKeyPem, method, requestPath }: CoinbaseJwtInput): string {
  if (!requestPath.startsWith('/')) throw new Error('coinbase_requestPath_must_start_with_slash');

  // Coinbase App API key auth (CDP): iss must be "cdp" and uri must include host.
  // Tokens expire after ~2 minutes.
  const now = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(16).toString('hex');

  const header = { alg: 'ES256', typ: 'JWT', kid: keyName, nonce };
  const payload = {
    sub: keyName,
    iss: 'cdp',
    // small negative skew helps if clocks drift slightly
    nbf: now,
    exp: now + 120,
    uri: `${method.toUpperCase()} api.coinbase.com${requestPath}`
  };

  const encodedHeader = base64url(Buffer.from(JSON.stringify(header)));
  const encodedPayload = base64url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${encodedHeader}.${encodedPayload}`;

  // NOTE: For ECDSA (ES256) keys, Node's createSign('sha256') is appropriate.
  const signer = crypto.createSign('sha256');
  signer.update(signingInput);
  signer.end();

  const keyObj = getKeyObjectFromPem(privateKeyPem);
  const sig = signer.sign({ key: keyObj, dsaEncoding: 'ieee-p1363' });
  const encodedSig = base64url(sig);
  return `${signingInput}.${encodedSig}`;
}
