import type { CoinbaseAccount, CoinbaseTransaction } from './coinbaseApi';
import { coinbaseListAccounts, coinbaseTransactionsPage, coinbaseExchangeRates } from './coinbaseApi';
import Decimal from 'decimal.js';

export type CoinbaseCreds = { keyName: string; privateKeyPem: string };

export type FetchProgress = {
  phase: 'accounts' | 'transactions';
  accountId?: string;
  fetched: number;
};

export async function bestEffortFxToBase(apiBase: string, from: string, to: string): Promise<Decimal | null> {
  const f = from.toUpperCase();
  const t = to.toUpperCase();
  if (f === t) return new Decimal(1);
  try {
    const rates = await coinbaseExchangeRates(apiBase, f);
    const raw = rates[t];
    if (!raw) return null;
    return new Decimal(raw);
  } catch {
    return null;
  }
}

export async function fetchCoinbaseAccounts(apiBase: string, token: string, creds: CoinbaseCreds): Promise<CoinbaseAccount[]> {
  return coinbaseListAccounts(apiBase, token, creds);
}

export async function fetchAllTransactions(
  apiBase: string,
  token: string,
  creds: CoinbaseCreds,
  accounts: CoinbaseAccount[],
  onProgress?: (p: FetchProgress) => void
): Promise<{ accountId: string; tx: CoinbaseTransaction }[]> {
  const out: { accountId: string; tx: CoinbaseTransaction }[] = [];
  let fetched = 0;
  for (const acc of accounts) {
    let nextUri: string | null = null;
    do {
      const page = await coinbaseTransactionsPage(apiBase, token, {
        ...creds,
        accountId: acc.id,
        nextUri,
        limit: 100
      });
      for (const tx of page.items) out.push({ accountId: acc.id, tx });
      fetched += page.items.length;
      onProgress?.({ phase: 'transactions', accountId: acc.id, fetched });
      nextUri = page.nextUri;
    } while (nextUri);
  }
  return out;
}

export async function fetchNewestTransactionsSince(
  apiBase: string,
  token: string,
  creds: CoinbaseCreds,
  accounts: CoinbaseAccount[],
  lastSeenByAccount: Record<string, string>,
  onProgress?: (p: FetchProgress) => void
): Promise<{ accountId: string; tx: CoinbaseTransaction }[]> {
  const out: { accountId: string; tx: CoinbaseTransaction }[] = [];
  let fetched = 0;

  for (const acc of accounts) {
    const stopId = lastSeenByAccount[acc.id];
    let nextUri: string | null = null;
    let foundStop = false;
    let guardPages = 0;

    while (guardPages < 50) {
      guardPages += 1;
      const page = await coinbaseTransactionsPage(apiBase, token, {
        ...creds,
        accountId: acc.id,
        nextUri,
        limit: 100
      });

      for (const tx of page.items) {
        if (stopId && tx.id === stopId) {
          foundStop = true;
          break;
        }
        out.push({ accountId: acc.id, tx });
      }

      fetched += page.items.length;
      onProgress?.({ phase: 'transactions', accountId: acc.id, fetched });

      if (foundStop) break;
      nextUri = page.nextUri;
      if (!nextUri) break;
    }
  }

  return out;
}
