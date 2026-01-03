import { buildCoinbaseJwt } from './coinbaseJwt.js';

export type CoinbaseCredentials = {
  keyName: string;
  privateKeyPem: string;
};

type CoinbasePagination = {
  ending_before: string | null;
  starting_after: string | null;
  previous_uri: string | null;
  next_uri: string | null;
  limit: number;
  order: 'asc' | 'desc';
};

export type CoinbaseListResponse<T> = {
  data: T[];
  pagination?: CoinbasePagination;
};

export type CoinbaseAccount = {
  id: string;
  name: string;
  primary: boolean;
  type: string;
  currency: {
    code: string;
    name: string;
    color?: string | null;
    sort_index?: number;
    exponent?: number;
    type?: string;
  };
  balance: { amount: string; currency: string };
  created_at?: string;
  updated_at?: string;
};

export type CoinbaseTransaction = {
  id: string;
  type: string;
  status: string;
  created_at: string;
  updated_at?: string;
  amount: { amount: string; currency: string };
  native_amount: { amount: string; currency: string };
  description?: string | null;
  details?: {
    title?: string;
    subtitle?: string;
    header?: string;
    health?: string;
  };
  network?: any;
  to?: any;
  from?: any;
  buy?: any;
  sell?: any;
  trade?: any;
};

export type CoinbaseExchangeRatesResponse = {
  data: {
    currency: string;
    rates: Record<string, string>;
  };
};

const COINBASE_ORIGIN = 'https://api.coinbase.com';

function parsePathAndQuery(pathOrUri: string): { path: string; signPath: string } {
  // API returns next_uri like "/v2/accounts?..." (no origin)
  const u = pathOrUri.startsWith('http') ? new URL(pathOrUri) : new URL(pathOrUri, COINBASE_ORIGIN);
  return { path: u.pathname + u.search, signPath: u.pathname };
}

function stringifyBodyForError(body: unknown): string {
  if (body == null) return '';
  if (typeof body === 'string') return body.trim();
  try {
    return JSON.stringify(body);
  } catch {
    return String(body);
  }
}

async function coinbaseGetJson<T>(cred: CoinbaseCredentials | null, pathOrUri: string): Promise<T> {
  const { path, signPath } = parsePathAndQuery(pathOrUri);

  const headers: Record<string, string> = {
    accept: 'application/json',
    'user-agent': 'kryptoportfolio-v3/coinbase-import'
  };

  if (cred) {
    // Coinbase expects the JWT "uri" claim to include method + host + *path*.
    // Many examples omit the query string; we sign the pathname only and send the query normally.
    const jwt = buildCoinbaseJwt({
      keyName: cred.keyName,
      privateKeyPem: cred.privateKeyPem,
      method: 'GET',
      requestPath: signPath
    });
    headers.authorization = `Bearer ${jwt}`;
  }

  const r = await fetch(`${COINBASE_ORIGIN}${path}`, { headers });

  // Coinbase sometimes returns plain text errors (e.g. "Unauthorized\n") even when Accept: application/json.
  const bodyText = await r.text();
  let body: unknown = {};
  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = bodyText;
    }
  }

  if (!r.ok) {
    const msg = stringifyBodyForError(body) || r.statusText;
    throw new Error(`coinbase_error ${r.status} ${msg}`);
  }

  if (typeof body === 'string') {
    // Successful responses should be JSON, but keep the failure actionable.
    throw new Error(`coinbase_error 502 coinbase_non_json_response: ${body.slice(0, 200)}`);
  }

  return (body as T) ?? ({} as T);
}

export async function coinbaseListAllAccounts(cred: CoinbaseCredentials): Promise<CoinbaseAccount[]> {
  // Keep the "connect" call as simple as possible; pagination uses next_uri.
  let next: string | null = '/v2/accounts';
  const out: CoinbaseAccount[] = [];
  while (next) {
    const resp: CoinbaseListResponse<CoinbaseAccount> = await coinbaseGetJson<CoinbaseListResponse<CoinbaseAccount>>(
      cred,
      next
    );
    out.push(...(resp.data ?? []));
    next = resp.pagination?.next_uri ?? null;
  }
  return out;
}

export async function coinbaseListTransactionsPage(
  cred: CoinbaseCredentials,
  accountId: string,
  nextUri?: string | null,
  limit = 100
): Promise<{ items: CoinbaseTransaction[]; nextUri: string | null }> {
  const path = nextUri ?? `/v2/accounts/${accountId}/transactions?limit=${limit}`;
  const resp: CoinbaseListResponse<CoinbaseTransaction> = await coinbaseGetJson<CoinbaseListResponse<CoinbaseTransaction>>(
    cred,
    path
  );
  return { items: resp.data ?? [], nextUri: resp.pagination?.next_uri ?? null };
}

export async function coinbaseShowTransaction(
  cred: CoinbaseCredentials,
  accountId: string,
  transactionId: string
): Promise<{ data: CoinbaseTransaction }> {
  return coinbaseGetJson<{ data: CoinbaseTransaction }>(
    cred,
    `/v2/accounts/${accountId}/transactions/${transactionId}`
  );
}

export async function coinbaseGetExchangeRates(currency?: string): Promise<CoinbaseExchangeRatesResponse> {
  const q = currency ? `?currency=${encodeURIComponent(currency)}` : '';
  return coinbaseGetJson<CoinbaseExchangeRatesResponse>(null, `/v2/exchange-rates${q}`);
}
