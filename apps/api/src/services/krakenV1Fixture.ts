/**
 * Kraken TEST_MODE fixture data for E2E tests.
 */
import type { KrakenLedgerEntry } from '@kp/core';

export const KRAKEN_TEST_API_KEY = 'TEST_KRAKEN_API_KEY';
export const KRAKEN_TEST_SECRET = 'TEST_KRAKEN_SECRET';

export function isKrakenTestCreds(apiKey: string, _apiSecret: string): boolean {
  return apiKey === KRAKEN_TEST_API_KEY;
}

export function fixtureVerify(): { ok: boolean } {
  return { ok: true };
}

export function fixtureLedgers(offset: number): { entries: KrakenLedgerEntry[]; count: number } {
  if (offset > 0) return { entries: [], count: 2 };
  const entries: KrakenLedgerEntry[] = [
    {
      refid: 'ABCDEF-001',
      time: 1705312200,
      type: 'trade',
      asset: 'XXBT',
      amount: '0.001',
      fee: '0.0000026',
    },
    {
      refid: 'ABCDEF-001',
      time: 1705312200,
      type: 'trade',
      asset: 'ZUSD',
      amount: '-42.00',
      fee: '0',
    },
    {
      refid: 'DEP-001',
      time: 1704000000,
      type: 'deposit',
      asset: 'XXBT',
      amount: '0.01',
      fee: '0',
    },
  ];
  return { entries, count: 3 };
}
