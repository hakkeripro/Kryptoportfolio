/**
 * Binance incremental sync.
 * Fetches trades (all known symbols) + deposits + withdrawals.
 * Uses lastFetchedTs as cursor for incremental updates.
 */
import type { BinanceCredentials } from './binanceVault';
import { binanceFetchDeposits, binanceFetchTrades, binanceFetchWithdrawals } from './binanceApi';
import {
  mapBinanceTradesToEvents,
  mapBinanceDepositsToEvents,
  mapBinanceWithdrawalsToEvents,
  splitBinanceSymbol,
  type BinanceApiTrade,
  type BinanceApiDeposit,
  type BinanceApiWithdrawal,
  type BinanceRawEvent,
} from '@kp/core';

// Common symbols to fetch. In practice, we'd discover these from balance endpoint.
// For now, cover the most common pairs.
const DEFAULT_SYMBOLS = [
  'BTCUSDT',
  'ETHUSDT',
  'BNBUSDT',
  'SOLUSDT',
  'ADAUSDT',
  'XRPUSDT',
  'DOTUSDT',
  'MATICUSDT',
  'AVAXUSDT',
  'LINKUSDT',
  'ATOMUSDT',
  'UNIUSDT',
  'LTCUSDT',
  'ETCUSDT',
  'XLMUSDT',
  'BTCEUR',
  'ETHEUR',
  'BTCBUSD',
  'ETHBTC',
  'BNBBTC',
  'SOLBTC',
  'ADABTC',
];

export interface BinanceSyncResult {
  events: BinanceRawEvent[];
  symbolsFetched: number;
  issueCount: number;
}

export async function fetchBinanceNewest(
  apiBase: string,
  token: string,
  creds: BinanceCredentials,
  lastFetchedTs?: number,
): Promise<BinanceSyncResult> {
  const allEvents: BinanceRawEvent[] = [];
  let symbolsFetched = 0;

  // Fetch trades for each symbol
  for (const symbol of DEFAULT_SYMBOLS) {
    try {
      const { trades } = await binanceFetchTrades(apiBase, token, creds, symbol, lastFetchedTs);
      if (trades.length > 0) {
        const events = mapBinanceTradesToEvents(trades as BinanceApiTrade[]);
        allEvents.push(...events);
        symbolsFetched++;
      }
    } catch {
      // Symbol not traded — skip silently
    }
  }

  // Fetch deposits
  try {
    const { deposits } = await binanceFetchDeposits(apiBase, token, creds, lastFetchedTs);
    allEvents.push(...mapBinanceDepositsToEvents(deposits as BinanceApiDeposit[]));
  } catch {
    // ignore
  }

  // Fetch withdrawals
  try {
    const { withdrawals } = await binanceFetchWithdrawals(apiBase, token, creds, lastFetchedTs);
    allEvents.push(...mapBinanceWithdrawalsToEvents(withdrawals as BinanceApiWithdrawal[]));
  } catch {
    // ignore
  }

  return { events: allEvents, symbolsFetched, issueCount: 0 };
}

export { splitBinanceSymbol };
