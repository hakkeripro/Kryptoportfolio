/** Generates a cryptographically random vault key (base64-encoded, 256-bit). */
export function generateVaultKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  let s = '';
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] ?? 0);
  return btoa(s);
}
