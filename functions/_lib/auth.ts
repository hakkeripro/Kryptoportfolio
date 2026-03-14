/**
 * Re-export shared auth from @kp/core.
 * Hono routes import from here to keep import paths stable.
 */
export {
  normalizeEmail,
  newId,
  hashPassword,
  verifyPassword,
  changePassword,
  signToken,
  requireAuth,
  type AuthPayload,
} from '@kp/core';

// b64url is used by coinbaseJwt — keep a local helper for compatibility.
export function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}
