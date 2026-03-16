import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { createOrReplacePasskeyWrap, isPasskeySupported } from '../vault/passkey';
import PassphraseGenerator from '../components/PassphraseGenerator';
import { Logo } from '../components/ui';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

type Step = 'passphrase' | 'passkey' | 'done';

export default function VaultSetupPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const isOffline = new URLSearchParams(location.search).get('offline') === '1';
  const setupVault = useVaultStore((s) => s.setupVault);
  const email = useAuthStore((s) => s.email);

  const [step, setStep] = useState<Step>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [passkeyEnabled, setPasskeyEnabled] = useState(false);

  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const canSetup = passphrase.length >= 6 && passphrase === confirm && saved && !busy;

  const stepNumber = useMemo(() => {
    if (step === 'passphrase') return 1;
    if (step === 'passkey') return 2;
    return 3;
  }, [step]);

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSetup) return;
    setError(null);
    setBusy(true);
    try {
      await setupVault(passphrase);
      setStep('passkey');
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleEnablePasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      await createOrReplacePasskeyWrap(passphrase);
      setPasskeyEnabled(true);
      setStep('done');
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleAcceptGenerated = (pp: string) => {
    setPassphrase(pp);
    setConfirm(pp);
  };

  return (
    <div
      data-testid="page-vault-setup"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 text-caption text-content-secondary">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                n === stepNumber
                  ? 'bg-brand text-white'
                  : n < stepNumber
                    ? 'bg-brand/20 text-semantic-success'
                    : 'bg-surface-raised text-content-tertiary'
              }`}
            >
              {n}
            </div>
          ))}
        </div>

        {/* Step 1: Passphrase */}
        {step === 'passphrase' && (
          <form onSubmit={handlePassphraseSubmit} className="space-y-4">
            <div className="text-center">
              <h1 className="text-heading-1 font-heading text-content-primary">
                {t('vaultSetup.step1.title')}
              </h1>
              <p className="text-caption text-content-secondary mt-1">
                {t('vaultSetup.step1.description')}
              </p>
            </div>

            <PassphraseGenerator onAccept={handleAcceptGenerated} />

            <div>
              <label className="block text-body font-medium text-content-primary mb-1.5">
                {t('vaultSetup.passphraseLabel')}
              </label>
              <input
                data-testid="form-vault-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-input bg-surface-base border border-border px-3 py-2.5 text-body
                  focus:outline-none focus:border-brand/50 transition-colors"
                placeholder={t('vaultSetup.passphrasePlaceholder')}
              />
            </div>

            <div>
              <label className="block text-body font-medium text-content-primary mb-1.5">
                {t('vaultSetup.confirmLabel')}
              </label>
              <input
                data-testid="form-vault-passphrase-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-input bg-surface-base border border-border px-3 py-2.5 text-body
                  focus:outline-none focus:border-brand/50 transition-colors"
                placeholder={t('vaultSetup.confirmPlaceholder')}
              />
              {mismatch && (
                <p className="text-xs text-semantic-error mt-1">{t('vaultSetup.error.mismatch')}</p>
              )}
            </div>

            <label className="flex items-center gap-2 text-caption text-content-secondary cursor-pointer">
              <input
                data-testid="form-saved-checkbox"
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="rounded border-border accent-brand"
              />
              {t('vaultSetup.savedCheckbox')}
            </label>

            <button
              data-testid="btn-create-vault"
              type="submit"
              disabled={!canSetup}
              className="w-full rounded-button bg-brand hover:bg-brand-dark disabled:opacity-60
                px-4 py-2.5 text-body font-medium transition-colors shadow-glow-brand"
            >
              {busy ? t('vaultSetup.btn.creating') : t('vaultSetup.btn.continue')}
            </button>

            {error && (
              <div className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error">
                {error}
              </div>
            )}
          </form>
        )}

        {/* Step 2: Passkey */}
        {step === 'passkey' && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-heading-1 font-heading text-content-primary">
                {t('vaultSetup.step2.title')}
              </h1>
              <p className="text-caption text-content-secondary mt-1">
                {t('vaultSetup.step2.description')}
              </p>
            </div>

            {isPasskeySupported() ? (
              <button
                data-testid="btn-enable-passkey"
                disabled={busy}
                onClick={handleEnablePasskey}
                className="w-full rounded-button bg-brand hover:bg-brand-dark disabled:opacity-60
                  px-4 py-2.5 text-body font-medium transition-colors shadow-glow-brand"
              >
                {busy ? t('vaultSetup.btn.enablingPasskey') : t('vaultSetup.btn.enablePasskey')}
              </button>
            ) : (
              <div className="text-caption text-content-secondary text-center rounded-button border border-border bg-surface-raised p-3">
                {t('vaultSetup.passkeyNotSupported')}
              </div>
            )}

            <button
              data-testid="btn-skip-passkey"
              onClick={() => setStep('done')}
              className="w-full text-body text-content-tertiary hover:text-content-secondary py-2 underline transition-colors"
            >
              {t('vaultSetup.btn.skipPasskey')}
            </button>

            {error && (
              <div className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error">
                {error}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="space-y-4 text-center">
            <h1 className="text-heading-1 font-heading text-content-primary">
              {t('vaultSetup.step3.title')}
            </h1>

            <div className="rounded-xl border border-border bg-surface-raised p-4 text-left space-y-2 text-body">
              {!isOffline && email && (
                <div className="flex justify-between">
                  <span className="text-content-secondary">{t('vaultSetup.summary.account')}</span>
                  <span className="text-content-primary">{email}</span>
                </div>
              )}
              {isOffline && (
                <div className="flex justify-between">
                  <span className="text-content-secondary">{t('vaultSetup.summary.mode')}</span>
                  <span className="text-content-primary">
                    {t('vaultSetup.summary.offlineMode')}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-content-secondary">{t('vaultSetup.summary.vault')}</span>
                <span className="text-semantic-success">{t('vaultSetup.summary.encrypted')}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">{t('vaultSetup.summary.passkey')}</span>
                <span className="text-content-primary">
                  {passkeyEnabled
                    ? t('vaultSetup.summary.passkeyEnabled')
                    : t('vaultSetup.summary.passkeyNotSet')}
                </span>
              </div>
            </div>

            <button
              data-testid="btn-go-dashboard"
              onClick={() => nav('/dashboard', { replace: true })}
              className="w-full rounded-button bg-brand hover:bg-brand-dark
                px-4 py-3 text-body font-medium transition-colors shadow-glow-brand"
            >
              {t('vaultSetup.btn.goDashboard')}
            </button>
          </div>
        )}

        {/* Already have account link */}
        <p className="text-center text-[0.625rem] text-content-tertiary">
          {t('signup.signinPrompt')}{' '}
          <a href="/auth/signin" className="text-brand hover:text-brand-light underline">
            {t('signup.signinLink')}
          </a>
        </p>
      </div>
    </div>
  );
}
