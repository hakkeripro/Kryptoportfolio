import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TaxCountry } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import PassphraseGenerator from '../components/PassphraseGenerator';
import { Logo } from '../components/ui';

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

function errToMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('email_taken')) return 'This email is already registered.';
  if (msg.includes('fetch')) return 'Server unreachable. Check your connection.';
  return msg;
}

export default function SignupWithVaultPage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const register = useAuthStore((s) => s.register);
  const setupVault = useVaultStore((s) => s.setupVault);

  // Account fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  // Vault fields
  const [passphrase, setPassphrase] = useState('');
  const [passphraseConfirm, setPassphraseConfirm] = useState('');

  // Country
  const [selectedCountry, setSelectedCountry] = useState<TaxCountry | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pwTooShort = password.length > 0 && password.length < 8;
  const pwMismatch = confirm.length > 0 && password !== confirm;
  const ppMismatch = passphraseConfirm.length > 0 && passphrase !== passphraseConfirm;
  const ppTooShort = passphrase.length > 0 && passphrase.length < 6;

  const canSubmit =
    email.length > 0 &&
    password.length >= 8 &&
    password === confirm &&
    passphrase.length >= 6 &&
    passphrase === passphraseConfirm &&
    !busy;

  const handleAcceptGenerated = (pp: string) => {
    setPassphrase(pp);
    setPassphraseConfirm(pp);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await register(email, password);
      await setupVault(passphrase);
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

        <h1 className="text-2xl font-bold text-center text-white">Create your account</h1>

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

          {/* ── YOUR VAULT ── */}
          <div className="space-y-3">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              // YOUR VAULT
            </div>
            <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] font-mono text-white/40 leading-relaxed">
              Your vault passphrase encrypts your data on your device. Unlike your login password,
              we cannot reset it — by design.
            </div>

            <PassphraseGenerator onAccept={handleAcceptGenerated} />

            <div>
              <label className="block text-sm text-content-secondary mb-1">
                {t('vaultSetup.passphraseLabel')}
              </label>
              <input
                data-testid="form-vault-passphrase"
                type="password"
                autoComplete="new-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
                placeholder={t('vaultSetup.passphrasePlaceholder')}
              />
              {ppTooShort && (
                <p className="text-xs text-rose-400 mt-1">
                  Passphrase must be at least 6 characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1">
                {t('vaultSetup.confirmLabel')}
              </label>
              <input
                data-testid="form-vault-passphrase-confirm"
                type="password"
                autoComplete="new-password"
                value={passphraseConfirm}
                onChange={(e) => setPassphraseConfirm(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
                placeholder={t('vaultSetup.confirmPlaceholder')}
              />
              {ppMismatch && (
                <p className="text-xs text-rose-400 mt-1">{t('vaultSetup.error.mismatch')}</p>
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
            {busy ? 'Creating account & vault…' : 'Create account & vault →'}
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
