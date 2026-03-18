import { useState } from 'react';
import { Button } from '../ui';
import { krakenVerify } from '../../integrations/kraken/krakenApi';
import {
  loadKrakenIntegration,
  saveKrakenIntegration,
} from '../../integrations/kraken/krakenVault';
import type { ConnectFormProps } from '../../integrations/importPlugin';

const inputCls =
  'w-full rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary focus:outline-none focus:border-brand/50 transition-colors';

export function KrakenConnectForm({ ctx, onConnected }: ConnectFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function connect() {
    if (!ctx.passphrase) {
      setErr('Vault is locked — unlock first');
      return;
    }
    if (!ctx.token) {
      setErr('Not authenticated');
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      await krakenVerify(ctx.apiBase, ctx.token, {
        apiKey: apiKey.trim(),
        apiSecret: apiSecret.trim(),
      });
      const cfg = await loadKrakenIntegration(ctx.passphrase);
      await saveKrakenIntegration(ctx.passphrase, {
        ...cfg,
        credentials: { apiKey: apiKey.trim(), apiSecret: apiSecret.trim() },
      });
      onConnected();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-4 space-y-3">
      {err && (
        <div
          className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error"
          data-testid="alert-import-error"
        >
          {err}
        </div>
      )}
      <label className="block">
        <div className="text-caption text-content-secondary mb-1">API Key</div>
        <input
          className={inputCls}
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Your Kraken API key"
          disabled={loading}
          data-testid="form-kraken-apikey"
        />
      </label>
      <label className="block">
        <div className="text-caption text-content-secondary mb-1">API Secret (Private Key)</div>
        <input
          className={inputCls}
          type="password"
          value={apiSecret}
          onChange={(e) => setApiSecret(e.target.value)}
          placeholder="Your Kraken API private key"
          disabled={loading}
          data-testid="form-kraken-apisecret"
        />
      </label>
      <div className="text-caption text-content-tertiary">
        Read-only API key required. Enable "Query Ledger Entries" permission only. Do not enable
        trading or withdrawal permissions.
      </div>
      <Button
        variant="default"
        size="sm"
        onClick={() => void connect()}
        disabled={loading || !ctx.passphrase || !ctx.token || !apiKey.trim() || !apiSecret.trim()}
        data-testid="btn-kraken-connect"
      >
        {loading ? 'Connecting…' : 'Connect Kraken'}
      </Button>
    </div>
  );
}
