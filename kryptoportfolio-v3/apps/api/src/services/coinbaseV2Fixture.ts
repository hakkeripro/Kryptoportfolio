/**
 * Test fixture for Coinbase v2 import.
 *
 * Enabled when TEST_MODE=1 and credentials contain the marker "FIXTURE:basic".
 *
 * The returned shapes intentionally match Coinbase v2 JSON enough for mapping logic.
 */

export const COINBASE_V2_FIXTURE_MARKER = 'FIXTURE:basic';

export type FixtureAccount = {
  id: string;
  name: string;
  type: string;
  primary?: boolean;
  currency: { code: string; name: string };
  balance: { amount: string; currency: string };
};

export type FixtureTx = any;

export function isCoinbaseV2FixtureCreds(input: { keyName?: string; privateKeyPem?: string }): boolean {
  const k = String(input.keyName ?? '');
  const p = String(input.privateKeyPem ?? '');
  return k.startsWith(COINBASE_V2_FIXTURE_MARKER) || p.startsWith(COINBASE_V2_FIXTURE_MARKER);
}

export function fixtureAccounts(): FixtureAccount[] {
  return [
    {
      id: 'acc_btc',
      name: 'BTC Wallet',
      type: 'wallet',
      primary: true,
      currency: { code: 'BTC', name: 'Bitcoin' },
      balance: { amount: '0.05', currency: 'BTC' }
    },
    {
      id: 'acc_eth',
      name: 'ETH Wallet',
      type: 'wallet',
      primary: false,
      currency: { code: 'ETH', name: 'Ethereum' },
      balance: { amount: '0.51', currency: 'ETH' }
    }
  ];
}

function txBase(id: string, type: string, createdAt: string, amount: { amount: string; currency: string }) {
  return {
    id,
    type,
    status: 'completed',
    created_at: createdAt,
    amount,
    details: { title: type.toUpperCase(), subtitle: `fixture:${id}` }
  };
}

export function fixtureTransactionsByAccount(accountId: string): FixtureTx[] {
  // Use EUR as "native" for deterministic base currency.
  if (accountId === 'acc_btc') {
    return [
      {
        ...txBase('tx_buy_btc_1', 'buy', '2025-01-02T12:00:00Z', { amount: '0.10', currency: 'BTC' }),
        native_amount: { amount: '2997.00', currency: 'EUR' },
        buy: {
          subtotal: { amount: '2997.00', currency: 'EUR' },
          fee: { amount: '0.00010', currency: 'BTC' },
          total: { amount: '2997.00', currency: 'EUR' }
        }
      },
      {
        ...txBase('tx_sell_btc_1', 'sell', '2025-02-01T12:00:00Z', { amount: '-0.02', currency: 'BTC' }),
        native_amount: { amount: '600.00', currency: 'EUR' },
        sell: {
          subtotal: { amount: '600.00', currency: 'EUR' },
          fee: { amount: '0.00005', currency: 'BTC' },
          total: { amount: '600.00', currency: 'EUR' }
        }
      },
      {
        ...txBase('tx_trade_btc_out', 'trade', '2025-03-01T12:00:00Z', { amount: '-0.03', currency: 'BTC' }),
        native_amount: { amount: '900.00', currency: 'EUR' },
        fee: { amount: '0.00001', currency: 'BTC' },
        trade: { id: 't1' }
      }
    ];
  }

  if (accountId === 'acc_eth') {
    return [
      {
        ...txBase('tx_trade_eth_in', 'trade', '2025-03-01T12:00:00Z', { amount: '0.50', currency: 'ETH' }),
        native_amount: { amount: '900.00', currency: 'EUR' },
        trade: { id: 't1' }
      },
      {
        ...txBase('tx_staking_reward_eth', 'staking_reward', '2025-04-01T12:00:00Z', { amount: '0.01', currency: 'ETH' }),
        native_amount: { amount: '15.00', currency: 'EUR' }
      }
    ];
  }

  return [];
}

export function fixtureFindTransaction(accountId: string, txId: string): FixtureTx | null {
  return fixtureTransactionsByAccount(accountId).find((t) => t.id === txId) ?? null;
}
