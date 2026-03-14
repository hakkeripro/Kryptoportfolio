/**
 * Shared API error classification and response helpers.
 */

export interface ApiErrorResponse {
  status: number;
  body: { error: string; message?: string; hint?: string; issues?: unknown[] };
}

/**
 * Classify a Coinbase API error into a structured response.
 */
export function classifyCoinbaseError(e: unknown): ApiErrorResponse {
  const msg = e instanceof Error ? e.message : String(e);

  // Key/PEM issues are user input problems -> 400
  if (
    (e as any)?.name === 'CoinbaseKeyError' ||
    msg.startsWith('coinbase_key') ||
    msg.startsWith('coinbase_key_') ||
    msg.includes('DECODER routines')
  ) {
    return { status: 400, body: { error: 'coinbase_key_invalid', message: msg } };
  }

  // If Coinbase returned a status, surface it.
  const m = msg.match(/coinbase_error\s+(\d{3})/);
  if (m) {
    const status = Number(m[1]);
    const code = status === 401 ? 'coinbase_unauthorized' : 'coinbase_error';
    const hint =
      status === 401
        ? [
            'Coinbase returned 401 Unauthorized.',
            'Most common causes:',
            '• keyName must be the FULL "organizations/.../apiKeys/..." value (not the short Key ID).',
            '• signature algorithm must be ECDSA (ES256) and the private key must be the downloaded EC key (PEM).',
            '• permission must include View (read-only) for the selected portfolio.',
            '• machine clock must be correct (JWT nbf/exp are strict).',
            '• if you later enable IP allowlist, include the PUBLIC IP of your API server.',
          ].join('\n')
        : undefined;
    return { status, body: { error: code, message: msg, ...(hint ? { hint } : {}) } };
  }

  // Fallback: proxy error.
  return { status: 502, body: { error: 'coinbase_proxy_error', message: msg } };
}
