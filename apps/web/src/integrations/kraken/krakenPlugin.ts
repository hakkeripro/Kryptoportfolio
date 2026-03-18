import type { ImportPlugin } from '../importPlugin';
import { clearKrakenIntegration, loadKrakenIntegration } from './krakenVault';
import { KrakenConnectForm } from '../../components/imports/KrakenConnectForm';
import { KrakenFetchPanel } from '../../components/imports/KrakenFetchPanel';

export const krakenPlugin: ImportPlugin = {
  descriptor: {
    id: 'kraken',
    name: 'Kraken',
    authMethods: ['api-key'],
    category: 'exchange',
  },
  api: {
    ConnectForm: KrakenConnectForm,
    FetchPanel: KrakenFetchPanel,
    isConnected: async (passphrase: string) => {
      const cfg = await loadKrakenIntegration(passphrase);
      return !!cfg.credentials;
    },
    disconnect: clearKrakenIntegration,
  },
};
