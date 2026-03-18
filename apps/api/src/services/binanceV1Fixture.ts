/**
 * Binance TEST_MODE fixture data.
 * Used in E2E tests with TEST_API_KEY / TEST_SECRET credentials.
 */

export const BINANCE_TEST_API_KEY = 'TEST_BINANCE_API_KEY';
export const BINANCE_TEST_SECRET = 'TEST_BINANCE_SECRET';

export function isBinanceTestCreds(apiKey: string, _apiSecret: string): boolean {
  return apiKey === BINANCE_TEST_API_KEY;
}

export function fixtureVerify() {
  return { canTrade: true };
}

export function fixtureTrades(symbol: string) {
  if (symbol === 'BTCUSDT') {
    return [
      {
        symbol: 'BTCUSDT',
        id: 100001,
        orderId: 200001,
        price: '42000.00',
        qty: '0.001',
        quoteQty: '42.00',
        commission: '0.0000001',
        commissionAsset: 'BTC',
        time: 1705312200000,
        isBuyer: true,
      },
    ];
  }
  return [];
}

export function fixtureDeposits() {
  return [
    {
      coin: 'BTC',
      amount: '0.01',
      insertTime: 1704000000000,
      txId: 'fixture-txid-001',
      status: 1,
    },
  ];
}

export function fixtureWithdrawals() {
  return [
    {
      coin: 'ETH',
      amount: '0.5',
      applyTime: '2024-01-10 08:00:00',
      id: 'fixture-wid-001',
      status: 6,
    },
  ];
}
