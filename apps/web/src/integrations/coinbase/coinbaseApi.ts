import { z } from 'zod';

export const CoinbaseAccountSchema = z
  .object({
    id: z.string(),
    name: z.string().optional().default(''),
    type: z.string().optional(),
    primary: z.boolean().optional(),
    currency: z.object({ code: z.string(), name: z.string().optional() }).passthrough().optional(),
    balance: z.object({ amount: z.string(), currency: z.string() }).passthrough().optional()
  })
  .passthrough();

export const CoinbaseTransactionSchema = z
  .object({
    id: z.string(),
    type: z.string(),
    status: z.string().optional().default(''),
    created_at: z.string(),
    amount: z.object({ amount: z.string(), currency: z.string() }),
    native_amount: z.object({ amount: z.string(), currency: z.string() }).optional(),
    details: z.any().optional()
  })
  .passthrough();

export type CoinbaseAccount = z.infer<typeof CoinbaseAccountSchema>;
export type CoinbaseTransaction = z.infer<typeof CoinbaseTransactionSchema>;

type ApiErrorBody = {
  error?: string;
  message?: string;
  hint?: string;
};

function tryJsonParse(txt: string): unknown {
  const t = txt.trim();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return t;
  }
}

function formatApiError(status: number, body: unknown): string {
  if (body && typeof body === 'object' && !Array.isArray(body)) {
    const b = body as ApiErrorBody;
    const head = [b.error, b.message].filter(Boolean).join(': ');
    const hint = b.hint ? `\n${b.hint}` : '';
    return `${status} ${head || 'error'}${hint}`.trim();
  }
  return `${status} ${String(body).trim()}`.trim();
}

async function apiFetch<T>(base: string, path: string, token: string | null, init: RequestInit): Promise<T> {
  const r = await fetch(`${base}${path}`, {
    cache: 'no-store',
    ...init,
    headers: {
      ...(init.headers ?? {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    }
  });

  const txt = await r.text();
  const body = tryJsonParse(txt);

  if (!r.ok) throw new Error(formatApiError(r.status, body));
  if (typeof body === 'string') throw new Error(`Unexpected non-JSON response: ${body.slice(0, 200)}`);
  return body as T;
}

export async function coinbaseListAccounts(
  apiBase: string,
  token: string,
  creds: { keyName: string; privateKeyPem: string }
): Promise<CoinbaseAccount[]> {
  const r = await apiFetch<any>(apiBase, '/v1/import/coinbase/v2/accounts', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(creds)
  });
  return z.object({ accounts: z.array(CoinbaseAccountSchema) }).parse(r).accounts;
}

export async function coinbaseTransactionsPage(
  apiBase: string,
  token: string,
  input: { keyName: string; privateKeyPem: string; accountId: string; nextUri?: string | null; limit?: number }
): Promise<{ items: CoinbaseTransaction[]; nextUri: string | null }> {
  const r = await apiFetch<any>(apiBase, '/v1/import/coinbase/v2/transactions/page', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
  const parsed = z.object({ items: z.array(CoinbaseTransactionSchema), nextUri: z.string().nullable() }).parse(r);
  return parsed;
}

export async function coinbaseShowTransactionRaw(
  apiBase: string,
  token: string,
  input: { keyName: string; privateKeyPem: string; accountId: string; transactionId: string }
): Promise<any> {
  return apiFetch<any>(apiBase, '/v1/import/coinbase/v2/transactions/show', token, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input)
  });
}

export async function coinbaseExchangeRates(apiBase: string, currency?: string): Promise<Record<string, string>> {
  const q = currency ? `?currency=${encodeURIComponent(currency)}` : '';
  const r = await fetch(`${apiBase}/v1/import/coinbase/v2/exchange-rates${q}`);
  const txt = await r.text();
  const body = tryJsonParse(txt);
  if (!r.ok) throw new Error(formatApiError(r.status, body));
  if (typeof body === 'string') throw new Error(`Unexpected non-JSON response: ${body.slice(0, 200)}`);

  const parsed = z
    .object({ data: z.object({ currency: z.string(), rates: z.record(z.string(), z.string()) }) })
    .parse(body);
  return parsed.data.rates;
}
