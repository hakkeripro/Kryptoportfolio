import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';

export default function SigninPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const login = useAuthStore((s) => s.login);
  const vaultSetup = useVaultStore((s) => s.vaultSetup);

  function errToMsg(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('invalid_credentials')) return t('signin.error.invalidCredentials');
    if (msg.includes('fetch')) return t('signin.error.serverUnreachable');
    return msg;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email && password && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      if (vaultSetup) {
        nav('/vault/unlock', { replace: true });
      } else {
        nav('/vault/setup', { replace: true });
      }
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-signin"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('signin.title')}</h1>

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

        <p className="text-center text-sm text-content-tertiary">
          {t('signin.signupPrompt')}{' '}
          <Link to="/auth/signup" className="text-indigo-400 hover:underline">
            {t('signin.signupLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
