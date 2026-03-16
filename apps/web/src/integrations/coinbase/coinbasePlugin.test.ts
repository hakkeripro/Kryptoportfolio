import { describe, it, expect, vi, beforeEach } from 'vitest';
import { coinbasePlugin } from './coinbasePlugin';

// Mock vault functions
vi.mock('./coinbaseVault', () => ({
  loadCoinbaseIntegration: vi.fn(),
  clearCoinbaseIntegration: vi.fn(),
}));

// Mock UI components so we don't need a full React setup
vi.mock('../../components/imports/CoinbaseConnectForm', () => ({
  CoinbaseConnectForm: () => null,
}));
vi.mock('../../components/imports/CoinbaseFetchPanel', () => ({
  CoinbaseFetchPanel: () => null,
}));

import { loadCoinbaseIntegration, clearCoinbaseIntegration } from './coinbaseVault';

describe('coinbasePlugin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has correct descriptor', () => {
    expect(coinbasePlugin.descriptor.id).toBe('coinbase');
    expect(coinbasePlugin.descriptor.name).toBe('Coinbase');
    expect(coinbasePlugin.descriptor.authMethods).toContain('api-key');
    expect(coinbasePlugin.descriptor.category).toBe('exchange');
  });

  it('isConnected returns false when vault is empty', async () => {
    vi.mocked(loadCoinbaseIntegration).mockResolvedValue({
      schemaVersion: 1,
      credentials: undefined,
      settings: { autoSync: true, autoCommit: true, intervalMinutes: 10, lastSeenTxIdByAccount: {} },
    });
    const result = await coinbasePlugin.isConnected('test-passphrase');
    expect(result).toBe(false);
  });

  it('isConnected returns true when credentials exist', async () => {
    vi.mocked(loadCoinbaseIntegration).mockResolvedValue({
      schemaVersion: 1,
      credentials: { keyName: 'key', privateKeyPem: '---PEM---' },
      settings: { autoSync: true, autoCommit: true, intervalMinutes: 10, lastSeenTxIdByAccount: {} },
    });
    const result = await coinbasePlugin.isConnected('test-passphrase');
    expect(result).toBe(true);
  });

  it('disconnect calls clearCoinbaseIntegration', async () => {
    vi.mocked(clearCoinbaseIntegration).mockResolvedValue(undefined);
    await coinbasePlugin.disconnect();
    expect(clearCoinbaseIntegration).toHaveBeenCalledOnce();
  });
});
