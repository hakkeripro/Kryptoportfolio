import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';

export default function SigninPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const signInAndUnlockVault = useAuthStore((s) => s.signInAndUnlockVault);
  const uploadVaultKeyBlob = useAuthStore((s) => s.uploadVaultKeyBlob);
  const setupVault = useVaultStore((s) => s.setupVault);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Fallback state: shown when no blob found on server (legacy user or first login on new device)
  const [needsFallback, setNeedsFallback] = useState(false);
  const [fallbackPassphrase, setFallbackPassphrase] = useState('');
  const [fallbackBusy, setFallbackBusy] = useState(false);

  function errToMsg(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('invalid_credentials')) return t('signin.error.invalidCredentials');
    if (msg.includes('fetch')) return t('signin.error.serverUnreachable');
    return msg;
  }

  const canSubmit = email && password && !busy;
  const canFallback = fallbackPassphrase.length >= 6 && !fallbackBusy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      const { autoUnlocked } = await signInAndUnlockVault(email, password);
      if (autoUnlocked) {
        nav('/home', { replace: true });
      } else {
        // No blob on server — show passphrase fallback
        setNeedsFallback(true);
      }
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  const handleFallbackSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canFallback) return;
    setError(null);
    setFallbackBusy(true);
    try {
      await setupVault(fallbackPassphrase);
      // Store blob on server so future logins are automatic
      await uploadVaultKeyBlob(fallbackPassphrase, password);
      nav('/home', { replace: true });
    } catch (err) {
      setError('Wrong passphrase or vault error. Please try again.');
    } finally {
      setFallbackBusy(false);
    }
  };

  return (
    <div
      data-testid="page-signin"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('signin.title')}</h1>

        {!needsFallback ? (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-content-secondary mb-1">
                {t('signin.email.label')}
              </label>
              <input
                data-testid="form-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1">
                {t('signin.password.label')}
              </label>
              <input
                data-testid="form-password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
              />
            </div>

            <button
              data-testid="btn-signin"
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
            >
              {busy ? t('signin.btn.loading') : t('signin.btn.submit')}
            </button>

            {error && (
              <div data-testid="signin-error" className="text-sm text-semantic-error">
                {error}
              </div>
            )}
          </form>
        ) : (
          <form onSubmit={handleFallbackSubmit} className="space-y-4" data-testid="fallback-form">
            <div className="rounded-xl border border-border bg-surface-raised p-4 text-sm text-content-secondary">
              Enter your vault passphrase to continue. Once entered, future logins on this device
              will unlock automatically.
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1">Vault passphrase</label>
              <input
                data-testid="form-vault-passphrase-fallback"
                type="password"
                required
                autoComplete="current-password"
                value={fallbackPassphrase}
                onChange={(e) => setFallbackPassphrase(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
                placeholder="Your vault passphrase"
              />
            </div>

            <button
              data-testid="btn-fallback-continue"
              type="submit"
              disabled={!canFallback}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
            >
              {fallbackBusy ? 'Unlocking…' : 'Continue'}
            </button>

            {error && (
              <div data-testid="signin-error" className="text-sm text-semantic-error">
                {error}
              </div>
            )}
          </form>
        )}

        <p className="text-center text-sm text-content-tertiary">
          {t('signin.signupPrompt')}{' '}
          <Link to="/auth/signup" className="text-brand hover:underline">
            {t('signin.signupLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
