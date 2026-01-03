type ApiError = { error: string };

async function apiFetch<T>(base: string, path: string, init?: RequestInit): Promise<T> {
  const url = base.replace(/\/$/, '') + path;
  const res = await fetch(url, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {})
    }
  });
  const txt = await res.text();
  const json = txt ? JSON.parse(txt) : null;
  if (!res.ok) {
    const msg = (json as ApiError | null)?.error || res.statusText;
    throw new Error(msg);
  }
  return json as T;
}

export type CoingeckoSearchCoin = {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number | null;
  thumb?: string;
  large?: string;
};

export async function coingeckoSearch(apiBase: string, query: string): Promise<CoingeckoSearchCoin[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  const r = await apiFetch<{ coins: CoingeckoSearchCoin[] }>(apiBase, `/v1/catalog/coingecko/search?query=${q}`);
  return r.coins ?? [];
}

export async function coingeckoSimplePrice(
  apiBase: string,
  ids: string[],
  vsCurrency: string
): Promise<Record<string, number>> {
  const cleaned = ids.filter(Boolean).slice(0, 250);
  if (!cleaned.length) return {};
  const idsParam = encodeURIComponent(cleaned.join(','));
  const vs = encodeURIComponent(vsCurrency.toLowerCase());
  const r = await apiFetch<{ prices: Record<string, number> }>(
    apiBase,
    `/v1/prices/coingecko/simple?ids=${idsParam}&vs=${vs}`
  );
  return r.prices ?? {};
}
