import type { ImportPlugin } from './importPlugin';
import { coinbasePlugin } from './coinbase/coinbasePlugin';
import { binancePlugin } from './binance/binancePlugin';
import { krakenPlugin } from './kraken/krakenPlugin';
import type { ProviderDescriptor } from '@kp/core';

export const PROVIDER_REGISTRY: ImportPlugin[] = [coinbasePlugin, binancePlugin, krakenPlugin];

export const COMING_SOON_PROVIDERS: ProviderDescriptor[] = [
  // Finnish exchanges (priority)
  { id: 'northcrypto', name: 'Northcrypto', authMethods: ['csv'], category: 'exchange' },
  { id: 'coinmotion', name: 'Coinmotion', authMethods: ['csv'], category: 'exchange' },
  // EU exchanges
  { id: 'bybit', name: 'Bybit', authMethods: ['api-key', 'csv'], category: 'exchange' },
  { id: 'bitstamp', name: 'Bitstamp', authMethods: ['api-key'], category: 'exchange' },
  { id: 'bitvavo', name: 'Bitvavo', authMethods: ['api-key'], category: 'exchange' },
  { id: 'mexc', name: 'MEXC', authMethods: ['api-key', 'csv'], category: 'exchange' },
  // Wallets
  { id: 'metamask', name: 'MetaMask', authMethods: ['address'], category: 'wallet' },
  { id: 'ledger', name: 'Ledger Live', authMethods: ['csv'], category: 'wallet' },
  { id: 'trezor', name: 'Trezor Suite', authMethods: ['csv'], category: 'wallet' },
];
