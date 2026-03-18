/**
 * Binance API trades mapper.
 *
 * Maps GET /api/v3/myTrades response rows to BinanceRawEvent[].
 * Each trade is a symbol (e.g. "BTCUSDT") buy or sell with qty, price, commission.
 */

import Decimal from 'decimal.js';
import type { BinanceRawEvent } from './binanceStatement.js';

export interface BinanceApiTrade {
  symbol: string; // e.g. "BTCUSDT"
  id: number;
  orderId: number;
  price: string;
  qty: string;
  quoteQty: string;
  commission: string;
  commissionAsset: string;
  time: number; // unix ms
  isBuyer: boolean;
}

export interface BinanceApiDeposit {
  coin: string;
  amount: string;
  insertTime: number; // unix ms
  txId?: string;
  status: number; // 1 = success
}

export interface BinanceApiWithdrawal {
  coin: string;
  amount: string;
  applyTime: string; // "2024-01-15 10:30:00"
  txId?: string;
  id: string;
  status: number; // 6 = completed
}

/** Split a Binance symbol into [base, quote] coins.
 *  Works for common pairs: BTCUSDT, ETHBTC, BNBETH, etc.
 *  Returns undefined for unknown symbols.
 */
export function splitBinanceSymbol(symbol: string): { base: string; quote: string } | undefined {
  const QUOTES = ['USDT', 'BUSD', 'USDC', 'BTC', 'ETH', 'BNB', 'FDUSD', 'EUR', 'TRY', 'GBP', 'AUD'];
  const upper = symbol.toUpperCase();
  for (const q of QUOTES) {
    if (upper.endsWith(q)) {
      const base = upper.slice(0, upper.length - q.length);
      if (base.length > 0) return { base, quote: q };
    }
  }
  return undefined;
}

/** Map Binance API trades to raw events */
export function mapBinanceTradesToEvents(trades: BinanceApiTrade[]): BinanceRawEvent[] {
  const events: BinanceRawEvent[] = [];
  for (const trade of trades) {
    const pair = splitBinanceSymbol(trade.symbol);
    if (!pair) continue;

    const ts = new Date(trade.time).toISOString();
    const baseAmount = new Decimal(trade.qty).toFixed();
    const quoteAmount = new Decimal(trade.quoteQty).toFixed();
    const feeAmount = trade.commission ? new Decimal(trade.commission).toFixed() : undefined;

    events.push({
      timestampISO: ts,
      operation: trade.isBuyer ? 'BUY' : 'SELL',
      coin: pair.base,
      amount: baseAmount,
      side: trade.isBuyer ? 'in' : 'out',
      pairedCoin: pair.quote,
      pairedAmount: quoteAmount,
      feeCoin: trade.commissionAsset || undefined,
      feeAmount: feeAmount !== '0' ? feeAmount : undefined,
      externalRef: `binance:api:${trade.symbol}:${trade.id}`,
    });
  }
  return events;
}

/** Map Binance API deposit history to raw events */
export function mapBinanceDepositsToEvents(deposits: BinanceApiDeposit[]): BinanceRawEvent[] {
  return deposits
    .filter((d) => d.status === 1)
    .map((d) => ({
      timestampISO: new Date(d.insertTime).toISOString(),
      operation: 'DEPOSIT',
      coin: d.coin,
      amount: new Decimal(d.amount).toFixed(),
      side: 'in' as const,
      externalRef: `binance:api:deposit:${d.txId ?? d.insertTime}`,
    }));
}

/** Map Binance API withdrawal history to raw events */
export function mapBinanceWithdrawalsToEvents(
  withdrawals: BinanceApiWithdrawal[],
): BinanceRawEvent[] {
  return withdrawals
    .filter((w) => w.status === 6)
    .map((w) => ({
      timestampISO: new Date(w.applyTime.replace(' ', 'T') + 'Z').toISOString(),
      operation: 'WITHDRAW',
      coin: w.coin,
      amount: new Decimal(w.amount).toFixed(),
      side: 'out' as const,
      externalRef: `binance:api:withdrawal:${w.id}`,
    }));
}
