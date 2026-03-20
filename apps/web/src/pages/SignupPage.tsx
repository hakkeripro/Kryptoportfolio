import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TaxCountry } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from '../components/ui';
import { initiateGoogleOAuth } from '../lib/googleOAuth';

const COUNTRY_OPTIONS: { value: TaxCountry; label: string; flag: string }[] = [
  { value: 'FI', label: 'Finland', flag: '🇫🇮' },
  { value: 'SE', label: 'Sweden', flag: '🇸🇪' },
  { value: 'DE', label: 'Germany', flag: '🇩🇪' },
  { value: 'OTHER', label: 'Other', flag: '🌍' },
];

async function saveCountryToSettings(taxCountry: TaxCountry) {
  try {
    await ensureWebDbOpen();
    const db = getWebDb();
    const existing = await db.settings.get('settings_1');
    if (!existing) return;
    await db.settings.put({
      ...existing,
      taxCountry,
      updatedAtISO: new Date().toISOString(),
    } as typeof existing);
  } catch {
    // Non-critical
  }
}

export default function SignupPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);

  function errToMsg(e: unknown): string {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('email_taken')) return t('signup.error.emailTaken');
    if (msg.includes('vault_not_found') || msg.includes('vault'))
      return 'Could not set up your vault. Please check your connection and try again.';
    if (msg.includes('fetch')) return t('signup.error.serverUnreachable');
    return msg;
  }

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<TaxCountry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const handleGoogleSignUp = async () => {
    setGoogleBusy(true);
    try {
      await initiateGoogleOAuth();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Google sign up failed');
      setGoogleBusy(false);
    }
  };

  const pwTooShort = password.length > 0 && password.length < 8;
  const pwMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = email.length > 0 && password.length >= 8 && password === confirm && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await register(email, password);
      if (selectedCountry) {
        await saveCountryToSettings(selectedCountry);
      }
      nav('/home', { replace: true });
    } catch (err) {
      setError(errToMsg(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-signup"
      className="min-h-screen flex flex-col items-center justify-center px-4 py-8"
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        <h1 className="text-2xl font-bold text-center text-white">{t('signup.title')}</h1>

        {/* Google OAuth */}
        <button
          data-testid="btn-google-signup"
          type="button"
          onClick={handleGoogleSignUp}
          disabled={googleBusy || busy}
          className="w-full flex items-center justify-center gap-3 rounded-lg bg-white text-gray-800
            border border-white/20 px-4 py-2.5 text-sm font-medium hover:bg-gray-50
            disabled:opacity-60 transition-colors"
        >
          {googleBusy ? (
            <span className="h-4 w-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {googleBusy ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-white/[0.08]" />
          <span className="text-xs text-content-tertiary">or</span>
          <div className="flex-1 h-px bg-white/[0.08]" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* ── YOUR ACCOUNT ── */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              // YOUR ACCOUNT
            </div>

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
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
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
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
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
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
              />
              {pwMismatch && (
                <p className="text-xs text-rose-400 mt-1">{t('signup.error.passwordMismatch')}</p>
              )}
            </div>
          </div>

          {/* ── TAX COUNTRY ── */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              // TAX COUNTRY
            </div>
            <div className="grid grid-cols-2 gap-2" data-testid="country-selector">
              {COUNTRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  data-testid={`btn-country-${opt.value.toLowerCase()}`}
                  type="button"
                  onClick={() => setSelectedCountry(opt.value)}
                  className={`flex items-center gap-2 rounded-xl px-3 py-2.5 border transition-colors text-sm ${
                    selectedCountry === opt.value
                      ? 'border-[#FF8400] bg-[#FF8400]/[0.08] text-white'
                      : 'border-white/[0.08] bg-surface-raised text-content-secondary hover:border-white/20'
                  }`}
                >
                  <span className="text-lg">{opt.flag}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <button
            data-testid="btn-signup"
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-3
              text-sm font-semibold transition-colors shadow-glow-brand"
          >
            {busy ? t('signup.btn.creating') : t('signup.btn.submit')}
          </button>

          {error && (
            <div data-testid="signup-error" className="text-sm text-semantic-error text-center">
              {error}
            </div>
          )}
        </form>

        <div className="space-y-2 text-center">
          <p className="text-sm text-content-tertiary">
            {t('signup.signinPrompt')}{' '}
            <Link to="/auth/signin" className="text-brand hover:underline">
              {t('signup.signinLink')}
            </Link>
          </p>
          <p>
            <Link
              to="/vault/setup?offline=1"
              className="text-xs text-white/30 hover:text-white/50 transition-colors"
            >
              Use without account →
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
