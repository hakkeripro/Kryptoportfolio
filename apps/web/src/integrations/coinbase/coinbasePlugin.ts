import type { ImportPlugin } from '../importPlugin';
import { clearCoinbaseIntegration, loadCoinbaseIntegration } from './coinbaseVault';
import { CoinbaseConnectForm } from '../../components/imports/CoinbaseConnectForm';
import { CoinbaseFetchPanel } from '../../components/imports/CoinbaseFetchPanel';

export const coinbasePlugin: ImportPlugin = {
  descriptor: {
    id: 'coinbase',
    name: 'Coinbase',
    authMethods: ['api-key'],
    category: 'exchange',
  },
  ConnectForm: CoinbaseConnectForm,
  FetchPanel: CoinbaseFetchPanel,
  isConnected: async (passphrase: string) => {
    const cfg = await loadCoinbaseIntegration(passphrase);
    return !!cfg.credentials;
  },
  disconnect: clearCoinbaseIntegration,
};
