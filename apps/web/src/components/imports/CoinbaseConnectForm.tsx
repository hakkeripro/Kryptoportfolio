import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../ui';
import { fetchCoinbaseAccounts, type CoinbaseCreds } from '../../integrations/coinbase/coinbaseSync';
import {
  loadCoinbaseIntegration,
  saveCoinbaseIntegration,
} from '../../integrations/coinbase/coinbaseVault';
import type { ConnectFormProps } from '../../integrations/importPlugin';

const inputCls =
  'w-full rounded-input bg-surface-base border border-border px-3 py-2 text-body text-content-primary focus:outline-none focus:border-brand/50 transition-colors';

function tryExtractJsonKey(input: string): { keyName?: string; privateKeyPem?: string } | null {
  const t = input.trim();
  if (!(t.startsWith('{') && t.endsWith('}'))) return null;
  try {
    const obj = JSON.parse(t) as Record<string, unknown>;
    const name =
      typeof obj.name === 'string'
        ? obj.name
        : typeof obj.keyName === 'string'
          ? obj.keyName
          : undefined;
    const pem =
      typeof obj.privateKey === 'string'
        ? obj.privateKey
        : typeof obj.private_key === 'string'
          ? obj.private_key
          : typeof obj.key_secret === 'string'
            ? obj.key_secret
            : typeof obj.api_secret === 'string'
              ? obj.api_secret
              : undefined;
    if (name || pem) return { keyName: name, privateKeyPem: pem };
    return null;
  } catch {
    return null;
  }
}

export function CoinbaseConnectForm({ ctx, onConnected }: ConnectFormProps) {
  const { t } = useTranslation();
  const [keyName, setKeyName] = useState('');
  const [privateKeyPem, setPrivateKeyPem] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function handlePrivateKeyChange(value: string) {
    const extracted = tryExtractJsonKey(value);
    if (extracted) {
      if (extracted.keyName) setKeyName(extracted.keyName);
      if (extracted.privateKeyPem) setPrivateKeyPem(extracted.privateKeyPem.replace(/\\n/g, '\n'));
    } else {
      setPrivateKeyPem(value);
    }
  }

  async function connect() {
    if (!ctx.passphrase) {
      setErr(t('imports.error.vaultLocked'));
      return;
    }
    if (!ctx.token) {
      setErr(t('imports.error.notAuthenticated'));
      return;
    }
    setErr(null);
    setLoading(true);
    try {
      const creds: CoinbaseCreds = { keyName: keyName.trim(), privateKeyPem: privateKeyPem.trim() };
      await fetchCoinbaseAccounts(ctx.apiBase, ctx.token, creds);
      const cfg = await loadCoinbaseIntegration(ctx.passphrase);
      await saveCoinbaseIntegration(ctx.passphrase, { ...cfg, credentials: creds });
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
        <div className="text-caption text-content-secondary mb-1">{t('imports.form.keyName')}</div>
        <input
          className={inputCls}
          value={keyName}
          onChange={(e) => setKeyName(e.target.value)}
          placeholder={t('imports.form.keyNamePlaceholder')}
          disabled={loading}
          data-testid="form-coinbase-keyname"
        />
      </label>
      <label className="block">
        <div className="text-caption text-content-secondary mb-1">
          {t('imports.form.privateKey')}
        </div>
        <textarea
          className={`${inputCls} h-24 font-mono text-caption`}
          value={privateKeyPem}
          onChange={(e) => handlePrivateKeyChange(e.target.value)}
          placeholder={t('imports.form.privateKeyPlaceholder')}
          disabled={loading}
          data-testid="form-coinbase-privatekey"
        />
      </label>
      <Button
        variant="default"
        size="sm"
        onClick={() => void connect()}
        disabled={loading || !ctx.passphrase || !ctx.token || !keyName.trim() || !privateKeyPem.trim()}
        data-testid="btn-coinbase-connect"
      >
        {loading ? 'Connecting…' : t('imports.btn.connect')}
      </Button>
    </div>
  );
}
