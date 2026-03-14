/**
 * Shared API fetch utility with proper error handling.
 */
export async function apiFetch<T>(base: string, path: string, init: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, { cache: 'no-store', ...init });
  const txt = await r.text();
  let json: unknown = {};
  try {
    json = txt ? JSON.parse(txt) : {};
  } catch {
    if (!r.ok) throw new Error(`${r.status} (non-JSON response)`);
    throw new Error(`Invalid JSON response from ${path}`);
  }
  if (!r.ok) throw new Error(`${r.status} ${JSON.stringify(json)}`);
  return json as T;
}
