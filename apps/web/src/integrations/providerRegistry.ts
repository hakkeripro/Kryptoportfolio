import type { ImportPlugin } from './importPlugin';
import { coinbasePlugin } from './coinbase/coinbasePlugin';
import type { ProviderDescriptor } from '@kp/core';

export const PROVIDER_REGISTRY: ImportPlugin[] = [
  coinbasePlugin,
  // Phase 2:
  // binancePlugin,
  // mexcPlugin,
];

export const COMING_SOON_PROVIDERS: ProviderDescriptor[] = [
  { id: 'binance', name: 'Binance', authMethods: ['api-key'], category: 'exchange' },
  { id: 'mexc', name: 'MEXC', authMethods: ['api-key'], category: 'exchange' },
  { id: 'bitvavo', name: 'Bitvavo', authMethods: ['api-key'], category: 'exchange' },
  { id: 'ledger', name: 'Ledger Live', authMethods: ['csv'], category: 'wallet' },
  { id: 'metamask', name: 'MetaMask', authMethods: ['address'], category: 'wallet' },
];
