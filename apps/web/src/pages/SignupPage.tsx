import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';

export default function SignupPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);

  function errToMsg(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('email_taken')) return t('signup.error.emailTaken');
    if (msg.includes('fetch')) return t('signup.error.serverUnreachable');
    return msg;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pwTooShort = password.length > 0 && password.length < 8;
  const pwMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = email && password.length >= 8 && password === confirm && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await register(email, password);
      nav('/vault/setup', { replace: true });
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-signup"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-6">
        <h1 className="text-2xl font-bold text-center">{t('signup.title')}</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('signup.email.label')}
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
              {t('signup.password.label')}
            </label>
            <input
              data-testid="form-password"
              type="password"
              required
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            />
            {pwTooShort && (
              <p className="text-xs text-rose-400 mt-1">{t('signup.error.passwordTooShort')}</p>
            )}
          </div>

          <div>
            <label className="block text-sm text-content-secondary mb-1">
              {t('signup.confirmPassword.label')}
            </label>
            <input
              data-testid="form-password-confirm"
              type="password"
              required
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
            />
            {pwMismatch && (
              <p className="text-xs text-rose-400 mt-1">{t('signup.error.passwordMismatch')}</p>
            )}
          </div>

          <button
            data-testid="btn-signup"
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
          >
            {busy ? t('signup.btn.creating') : t('signup.btn.submit')}
          </button>

          {error && (
            <div data-testid="signup-error" className="text-sm text-semantic-error">
              {error}
            </div>
          )}
        </form>

        <p className="text-center text-sm text-content-tertiary">
          {t('signup.signinPrompt')}{' '}
          <Link to="/auth/signin" className="text-indigo-400 hover:underline">
            {t('signup.signinLink')}
          </Link>
        </p>
      </div>
    </div>
  );
}
