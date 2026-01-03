export function uuid(): string {
  // Works in modern browsers and Node 20+
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  // Fallback: not cryptographically strong; should be avoided in production if crypto is missing.
  const rnd = () => Math.floor(Math.random() * 1e9).toString(16).padStart(8, '0');
  return `${rnd()}-${rnd().slice(0,4)}-${rnd().slice(0,4)}-${rnd().slice(0,4)}-${rnd()}${rnd()}`;
}
