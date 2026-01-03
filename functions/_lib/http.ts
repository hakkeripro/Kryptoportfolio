export function json<T>(data: T, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('content-type')) headers.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(data), { ...init, headers });
}

export async function readJson(req: Request): Promise<any> {
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/json')) {
    // Allow empty body for GET/OPTIONS etc.
    const text = await req.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  }
  return req.json();
}
