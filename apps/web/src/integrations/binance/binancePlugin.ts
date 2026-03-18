import type { ImportPlugin } from '../importPlugin';
import { clearBinanceIntegration, loadBinanceIntegration } from './binanceVault';
import { BinanceConnectForm } from '../../components/imports/BinanceConnectForm';
import { BinanceFetchPanel } from '../../components/imports/BinanceFetchPanel';
import { BinanceCsvUploadForm } from '../../components/imports/BinanceCsvUploadForm';

export const binancePlugin: ImportPlugin = {
  descriptor: {
    id: 'binance',
    name: 'Binance',
    authMethods: ['api-key', 'csv'],
    category: 'exchange',
  },
  api: {
    ConnectForm: BinanceConnectForm,
    FetchPanel: BinanceFetchPanel,
    isConnected: async (passphrase: string) => {
      const cfg = await loadBinanceIntegration(passphrase);
      return !!cfg.credentials;
    },
    disconnect: clearBinanceIntegration,
  },
  csv: {
    UploadForm: BinanceCsvUploadForm,
  },
};
