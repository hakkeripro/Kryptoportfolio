import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { createOrReplacePasskeyWrap, isPasskeySupported } from '../vault/passkey';
import PassphraseGenerator from '../components/PassphraseGenerator';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

type Step = 'passphrase' | 'passkey' | 'done';

export default function VaultSetupPage() {
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
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 text-sm text-content-secondary">
          {[1, 2, 3].map((n) => (
            <div
              key={n}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                n === stepNumber
                  ? 'bg-brand text-white'
                  : n < stepNumber
                    ? 'bg-brand-dark/20 text-semantic-success'
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
            <h1 className="text-2xl font-bold text-center">Set up your Vault</h1>
            <p className="text-sm text-content-secondary text-center">
              Your Vault Passphrase encrypts all data. Save it somewhere safe — it cannot be
              recovered.
            </p>

            <PassphraseGenerator onAccept={handleAcceptGenerated} />

            <div>
              <label className="block text-sm text-content-secondary mb-1">Vault Passphrase</label>
              <input
                data-testid="form-vault-passphrase"
                type="password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
                placeholder="Enter passphrase (min 6 characters)"
              />
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1">
                Confirm Passphrase
              </label>
              <input
                data-testid="form-vault-passphrase-confirm"
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
                placeholder="Confirm passphrase"
              />
              {mismatch && <p className="text-xs text-rose-400 mt-1">Passphrases do not match</p>}
            </div>

            <label className="flex items-center gap-2 text-sm text-content-secondary">
              <input
                data-testid="form-saved-checkbox"
                type="checkbox"
                checked={saved}
                onChange={(e) => setSaved(e.target.checked)}
                className="rounded border-border"
              />
              I saved my passphrase somewhere safe
            </label>

            <button
              data-testid="btn-create-vault"
              type="submit"
              disabled={!canSetup}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
            >
              {busy ? 'Creating vault…' : 'Continue'}
            </button>

            {error && <div className="text-sm text-semantic-error">{error}</div>}
          </form>
        )}

        {/* Step 2: Passkey */}
        {step === 'passkey' && (
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-center">Enable Passkey</h1>
            <p className="text-sm text-content-secondary text-center">
              A passkey lets you unlock without typing your passphrase on this device. It is
              device-specific.
            </p>

            {isPasskeySupported() ? (
              <button
                data-testid="btn-enable-passkey"
                disabled={busy}
                onClick={handleEnablePasskey}
                className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
              >
                {busy ? 'Enabling…' : 'Enable Passkey (recommended)'}
              </button>
            ) : (
              <div className="text-sm text-content-secondary text-center rounded-lg border border-border bg-surface-raised p-3">
                Your device does not support passkeys. You can always add one later from Account
                settings.
              </div>
            )}

            <button
              data-testid="btn-skip-passkey"
              onClick={() => setStep('done')}
              className="w-full text-sm text-content-tertiary hover:text-content-secondary py-2 underline"
            >
              Skip for now
            </button>

            {error && <div className="text-sm text-semantic-error">{error}</div>}
          </div>
        )}

        {/* Step 3: Done */}
        {step === 'done' && (
          <div className="space-y-4 text-center">
            <h1 className="text-2xl font-bold">You&apos;re all set!</h1>

            <div className="rounded-xl border border-border bg-surface-raised p-4 text-left space-y-2 text-sm">
              {!isOffline && email && (
                <div className="flex justify-between">
                  <span className="text-content-secondary">Account</span>
                  <span>{email}</span>
                </div>
              )}
              {isOffline && (
                <div className="flex justify-between">
                  <span className="text-content-secondary">Mode</span>
                  <span>Offline (no sync)</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-content-secondary">Vault</span>
                <span className="text-semantic-success">Encrypted</span>
              </div>
              <div className="flex justify-between">
                <span className="text-content-secondary">Passkey</span>
                <span>{passkeyEnabled ? 'Enabled' : 'Not set'}</span>
              </div>
            </div>

            <button
              data-testid="btn-go-dashboard"
              onClick={() => nav('/dashboard', { replace: true })}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark px-4 py-3 text-sm font-medium"
            >
              Go to Dashboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
