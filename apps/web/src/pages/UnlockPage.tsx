import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVaultStore } from '../store/useVaultStore';
import { Logo } from '../components/ui';
import {
  getStoredPasskeyWrap,
  isPasskeySupported,
  unwrapPassphraseWithPasskey,
} from '../vault/passkey';

function errToMsg(e: unknown, t: (k: string) => string): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Decryption') || msg.includes('decrypt')) return t('unlock.error.wrongPassphrase');
  if (msg.includes('passkey_cancelled')) return t('unlock.error.passkeyCancelled');
  if (msg.includes('hmac_secret_not_supported') || msg.includes('prf_not_supported'))
    return t('unlock.error.passkeyNotSupported');
  return msg;
}

export default function UnlockPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? '/home';
  }, [location.search]);

  const unlockVault = useVaultStore((s) => s.unlockVault);
  const [passphrase, setPassphrase] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPasskey = useMemo(() => !!getStoredPasskeyWrap(), []);
  const passkeyOk = useMemo(() => isPasskeySupported() && hasPasskey, [hasPasskey]);

  const unlockWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const p = await unwrapPassphraseWithPasskey();
      await unlockVault(p, { rememberSession: remember });
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  const unlockWithPassphrase = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await unlockVault(passphrase, { rememberSession: remember });
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e, t));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-unlock"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        {/* Title */}
        <div className="text-center">
          <h1 className="text-heading-1 font-heading text-content-primary">{t('unlock.title')}</h1>
          <p className="text-caption text-content-secondary mt-1">{t('unlock.description')}</p>
        </div>

        {/* Passphrase form */}
        <form onSubmit={unlockWithPassphrase} className="space-y-4">
          <div>
            <label className="block text-body font-medium text-content-primary mb-1.5">
              {t('unlock.passphrase.title')}
            </label>
            <input
              data-testid="form-unlock-passphrase"
              type="password"
              placeholder={t('unlock.passphrase.placeholder')}
              value={passphrase}
              onChange={(e) => setPassphrase(e.target.value)}
              className="w-full rounded-input bg-surface-base border border-border px-3 py-2.5 text-body
                focus:outline-none focus:border-brand/50 transition-colors"
            />
          </div>

          <label className="flex items-center gap-2 text-caption text-content-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="rounded border-border accent-brand"
            />
            {t('unlock.remember', { defaultValue: 'Remember me (24 hours)' })}
          </label>

          <button
            data-testid="btn-unlock-passphrase"
            type="submit"
            disabled={busy || passphrase.length < 1}
            className="w-full rounded-button bg-brand hover:bg-brand-dark disabled:opacity-60
              px-4 py-2.5 text-body font-medium transition-colors shadow-glow-brand"
          >
            {busy ? t('unlock.btn.unlocking') : t('unlock.btn.unlock')}
          </button>

          {error && (
            <div
              data-testid="alert-unlock-error"
              className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error"
            >
              {error}
            </div>
          )}
        </form>

        {/* Passkey option */}
        {passkeyOk && (
          <div className="text-center space-y-2 pt-2 border-t border-border-subtle">
            <button
              data-testid="btn-unlock-passkey"
              disabled={busy}
              onClick={() => void unlockWithPasskey()}
              className="text-body text-content-secondary hover:text-content-primary underline transition-colors"
            >
              {t('unlock.btn.unlockPasskey')}
            </button>
          </div>
        )}

        {/* Biometric hint */}
        {!passkeyOk && isPasskeySupported() && (
          <p className="text-center text-[0.625rem] text-content-tertiary border-t border-border-subtle pt-3">
            {t('unlock.passkey.tip')}
          </p>
        )}
      </div>
    </div>
  );
}
