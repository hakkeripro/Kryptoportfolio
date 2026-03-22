/**
 * Feature 47 — WebAuthn / Passkey helper library
 *
 * Handles:
 *   - Passkey registration (navigator.credentials.create with PRF extension)
 *   - Passkey authentication (navigator.credentials.get with PRF extension)
 *   - PRF-to-vault-key derivation via HKDF
 */

import { hkdfDeriveRaw } from '@kp/platform-web';

// ---------------------------------------------------------------------------
// Base64url helpers
// ---------------------------------------------------------------------------

export function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

export function b64urlDecode(s: string): Uint8Array {
  const padded = s.replace(/-/g, '+').replace(/_/g, '/').padEnd(s.length + ((4 - (s.length % 4)) % 4), '=');
  const bin = atob(padded);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PasskeyRegistrationResult {
  credentialId: string;           // base64url
  clientDataJSON: string;         // base64url
  attestationObject: string;      // base64url
  prfOutput: ArrayBuffer | null;  // 32 bytes from PRF extension (null if not supported)
  prfSupported: boolean;
}

export interface PasskeyAuthResult {
  credentialId: string;           // base64url
  authenticatorData: string;      // base64url
  clientDataJSON: string;         // base64url
  signature: string;              // base64url
  userHandle: string | null;      // base64url
  prfOutput: ArrayBuffer | null;  // 32 bytes from PRF extension
}

export class PasskeyPrfNotSupportedError extends Error {
  constructor() {
    super('passkey_prf_not_supported');
    this.name = 'PasskeyPrfNotSupportedError';
  }
}

export class PasskeyCancelledError extends Error {
  constructor() {
    super('passkey_cancelled');
    this.name = 'PasskeyCancelledError';
  }
}

// ---------------------------------------------------------------------------
// Support detection
// ---------------------------------------------------------------------------

export function isPasskeyAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof navigator.credentials !== 'undefined'
  );
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

/**
 * Create a new passkey. Requires PRF extension support.
 * Throws PasskeyPrfNotSupportedError if the device/browser doesn't support PRF.
 */
export async function registerPasskey(
  options: PublicKeyCredentialCreationOptions,
  prfSalt: ArrayBuffer,
): Promise<PasskeyRegistrationResult> {
  const optionsWithPrf: PublicKeyCredentialCreationOptions = {
    ...options,
    extensions: {
      ...(options.extensions ?? {}),
      prf: { evalByCredential: {} },
    } as any,
  };

  const cred = (await navigator.credentials.create({ publicKey: optionsWithPrf })) as PublicKeyCredential | null;
  if (!cred) throw new PasskeyCancelledError();

  const response = cred.response as AuthenticatorAttestationResponse;
  const ext = cred.getClientExtensionResults() as { prf?: { enabled?: boolean } };
  const prfSupported = ext.prf?.enabled === true;

  // If PRF is supported, immediately get PRF output with the provided salt
  let prfOutput: ArrayBuffer | null = null;
  if (prfSupported) {
    const authResult = await authenticateWithPasskey({
      challenge: options.challenge,
      rpId: (options.rp as { id?: string }).id,
      allowCredentials: [{ type: 'public-key', id: cred.rawId }],
      userVerification: 'required',
      extensions: { prf: { eval: { first: prfSalt } } } as any,
    });
    prfOutput = authResult.prfOutput;
  }

  return {
    credentialId: b64urlEncode(cred.rawId),
    clientDataJSON: b64urlEncode(response.clientDataJSON),
    attestationObject: b64urlEncode(response.attestationObject),
    prfOutput,
    prfSupported,
  };
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

/**
 * Authenticate with an existing passkey (credential get).
 */
export async function authenticateWithPasskey(
  options: PublicKeyCredentialRequestOptions,
): Promise<PasskeyAuthResult> {
  const assertion = (await navigator.credentials.get({ publicKey: options })) as PublicKeyCredential | null;
  if (!assertion) throw new PasskeyCancelledError();

  const response = assertion.response as AuthenticatorAssertionResponse;
  const ext = assertion.getClientExtensionResults() as { prf?: { results?: { first?: ArrayBuffer } } };
  const prfOutput = ext.prf?.results?.first ?? null;

  return {
    credentialId: b64urlEncode(assertion.rawId),
    authenticatorData: b64urlEncode(response.authenticatorData),
    clientDataJSON: b64urlEncode(response.clientDataJSON),
    signature: b64urlEncode(response.signature),
    userHandle: response.userHandle ? b64urlEncode(response.userHandle) : null,
    prfOutput,
  };
}

/**
 * Initiate a discoverable-credential (passkey autofill) flow.
 * Returns null if cancelled or not supported.
 */
export async function initiateConditionalPasskey(): Promise<PasskeyAuthResult | null> {
  if (!isPasskeyAvailable()) return null;
  if (typeof (PublicKeyCredential as any).isConditionalMediationAvailable === 'function') {
    const supported = await (PublicKeyCredential as any).isConditionalMediationAvailable();
    if (!supported) return null;
  }
  try {
    return await authenticateWithPasskey({
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      userVerification: 'required',
      mediation: 'conditional' as any,
    } as any);
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// HKDF vault-key derivation from PRF output
// ---------------------------------------------------------------------------

export const PRF_VAULT_INFO = 'vaultfolio-vault-key-v1';

/**
 * Derive a 32-byte vault key from WebAuthn PRF output using HKDF-SHA256.
 * The result is encoded as a hex string to match the vault passphrase format.
 */
export async function deriveVaultPassphraseFromPrf(prfOutput: ArrayBuffer): Promise<string> {
  const raw = await hkdfDeriveRaw(prfOutput, PRF_VAULT_INFO, 32);
  return Array.from(new Uint8Array(raw))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
