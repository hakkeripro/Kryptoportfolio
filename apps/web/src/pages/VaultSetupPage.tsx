import { useState, useMemo } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TaxCountry } from '@kp/core';
import { ensureWebDbOpen, getWebDb } from '@kp/platform-web';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import PassphraseGenerator from '../components/PassphraseGenerator';
import { Logo } from '../components/ui';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

// passkey step removed from normal flow (deferred to dashboard banner)
type Step = 'country' | 'passphrase' | 'done';

const COUNTRY_OPTIONS: { value: TaxCountry; label: string; flag: string; comingSoon?: boolean }[] = [
  { value: 'FI', label: 'Finland', flag: '🇫🇮' },
  { value: 'SE', label: 'Sweden', flag: '🇸🇪', comingSoon: true },
  { value: 'DE', label: 'Germany', flag: '🇩🇪', comingSoon: true },
  { value: 'OTHER', label: 'Other', flag: '🌍' },
];

const STEP_NUMBERS: Record<Step, number> = {
  country: 1,
  passphrase: 2,
  done: 3,
};
const TOTAL_STEPS = 3;

async function saveCountryToSettings(taxCountry: TaxCountry) {
  try {
    await ensureWebDbOpen();
    const db = getWebDb();
    const existing = await db.settings.get('settings_1');
    if (!existing) return;
    const now = new Date().toISOString();
    await db.settings.put({ ...existing, taxCountry, updatedAtISO: now } as typeof existing);
  } catch {
    // Non-critical — settings may not exist yet
  }
}

export default function VaultSetupPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const isOffline = new URLSearchParams(location.search).get('offline') === '1';
  const setupVault = useVaultStore((s) => s.setupVault);
  const email = useAuthStore((s) => s.email);
  const token = useAuthStore((s) => s.token);

  // Guard: vault setup requires auth unless in offline mode
  if (!token && !isOffline) {
    return <Navigate to="/welcome" replace />;
  }

  const isOnDevice = new URLSearchParams(location.search).get('ondevice') === '1';
  const nextPath = new URLSearchParams(location.search).get('next') ?? '/home';

  const [step, setStep] = useState<Step>(isOnDevice ? 'passphrase' : 'country');
  const [selectedCountry, setSelectedCountry] = useState<TaxCountry | null>(null);
  const [passphrase, setPassphrase] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const mismatch = confirm.length > 0 && passphrase !== confirm;
  const canSetup = isOnDevice
    ? passphrase.length >= 6 && !busy
    : passphrase.length >= 6 && passphrase === confirm && saved && !busy;

  const stepNumber = useMemo(() => {
    if (isOnDevice) {
      // ondevice skips country step, renumber: passphrase=1, done=2
      if (step === 'passphrase') return 1;
      return 2;
    }
    return STEP_NUMBERS[step];
  }, [step, isOnDevice]);

  const totalSteps = isOnDevice ? 2 : TOTAL_STEPS;

  const handlePassphraseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSetup) return;
    setError(null);
    setBusy(true);
    try {
      await setupVault(passphrase);
      // Save country if selected
      if (selectedCountry) {
        await saveCountryToSettings(selectedCountry);
      }
      if (isOnDevice) {
        nav(nextPath, { replace: true });
      } else {
        setStep('done');
      }
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
          {Array.from({ length: totalSteps }, (_, i) => i + 1).map((n) => (
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

        {/* Step 0: Country */}
        {step === 'country' && (
          <div className="space-y-4">
            <div className="text-center">
              <h1 className="text-heading-1 font-heading text-content-primary">
                Where do you pay crypto taxes?
              </h1>
              <p className="text-caption text-content-secondary mt-1">
                We'll set up your tax profile automatically.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3" data-testid="country-selector">
              {COUNTRY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  data-testid={`btn-country-${opt.value.toLowerCase()}`}
                  type="button"
                  disabled={opt.comingSoon}
                  onClick={() => !opt.comingSoon && setSelectedCountry(opt.value)}
                  className={`relative flex items-center gap-3 rounded-xl px-4 py-3 border transition-colors text-body ${
                    opt.comingSoon
                      ? 'border-white/[0.04] bg-surface-raised/50 text-content-tertiary cursor-not-allowed opacity-50'
                      : selectedCountry === opt.value
                        ? 'border-[#FF8400] bg-[#FF8400]/[0.08] text-content-primary'
                        : 'border-white/[0.08] bg-surface-raised text-content-secondary hover:border-white/20'
                  }`}
                >
                  <span className="text-2xl">{opt.flag}</span>
                  <span className="flex-1 text-left">{opt.label}</span>
                  {opt.comingSoon && (
                    <span className="text-[9px] font-mono uppercase tracking-wider text-white/30">
                      Soon
                    </span>
                  )}
                </button>
              ))}
            </div>

            <button
              data-testid="btn-country-continue"
              disabled={!selectedCountry}
              onClick={() => setStep('passphrase')}
              className="w-full rounded-button bg-brand hover:bg-brand-dark disabled:opacity-60
                px-4 py-2.5 text-body font-medium transition-colors shadow-glow-brand"
            >
              Continue
            </button>

            <button
              data-testid="btn-country-skip"
              onClick={() => setStep('passphrase')}
              className="w-full text-body text-content-tertiary hover:text-content-secondary py-2 underline transition-colors"
            >
              Skip for now →
            </button>
          </div>
        )}

        {/* Step 1: Passphrase */}
        {step === 'passphrase' && (
          <form onSubmit={handlePassphraseSubmit} className="space-y-4">
            <div className="text-center">
              <h1 className="text-heading-1 font-heading text-content-primary">
                {isOnDevice ? t('vaultSetup.ondevice.title') : t('vaultSetup.step1.title')}
              </h1>
              <p className="text-caption text-content-secondary mt-1">
                {isOnDevice
                  ? t('vaultSetup.ondevice.description')
                  : t('vaultSetup.step1.description')}
              </p>
            </div>

            {!isOnDevice && <PassphraseGenerator onAccept={handleAcceptGenerated} />}

            <div>
              <label className="block text-body font-medium text-content-primary mb-1.5">
                {t('vaultSetup.passphraseLabel')}
              </label>
              <input
                data-testid="form-vault-passphrase"
                type="password"
                autoComplete="current-password"
                value={passphrase}
                onChange={(e) => setPassphrase(e.target.value)}
                className="w-full rounded-input bg-surface-base border border-border px-3 py-2.5 text-body
                  focus:outline-none focus:border-brand/50 transition-colors"
                placeholder={t('vaultSetup.passphrasePlaceholder')}
              />
            </div>

            {!isOnDevice && (
              <>
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
                    <p className="text-xs text-semantic-error mt-1">
                      {t('vaultSetup.error.mismatch')}
                    </p>
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
              </>
            )}

            <button
              data-testid="btn-create-vault"
              type="submit"
              disabled={!canSetup}
              className="w-full rounded-button bg-brand hover:bg-brand-dark disabled:opacity-60
                px-4 py-2.5 text-body font-medium transition-colors shadow-glow-brand"
            >
              {busy
                ? t('vaultSetup.btn.creating')
                : isOnDevice
                  ? t('vaultSetup.ondevice.btn')
                  : t('vaultSetup.btn.continue')}
            </button>

            {error && (
              <div className="rounded-button border border-semantic-error/30 bg-semantic-error/5 p-3 text-caption text-semantic-error">
                {error}
              </div>
            )}
          </form>
        )}

        {/* Step 2: Done */}
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
              {selectedCountry && (
                <div className="flex justify-between">
                  <span className="text-content-secondary">Tax country</span>
                  <span className="text-content-primary">
                    {COUNTRY_OPTIONS.find((o) => o.value === selectedCountry)?.label}
                  </span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-content-secondary">{t('vaultSetup.summary.vault')}</span>
                <span className="text-semantic-success">{t('vaultSetup.summary.encrypted')}</span>
              </div>
            </div>

            <button
              data-testid="btn-go-dashboard"
              onClick={() => nav('/home', { replace: true })}
              className="w-full rounded-button bg-brand hover:bg-brand-dark
                px-4 py-3 text-body font-medium transition-colors shadow-glow-brand"
            >
              {t('vaultSetup.btn.goDashboard')}
            </button>
          </div>
        )}

        {/* Already have account link — hidden in ondevice mode */}
        {!isOnDevice && (
          <p className="text-center text-[0.625rem] text-content-tertiary">
            {t('signup.signinPrompt')}{' '}
            <a href="/auth/signin" className="text-brand hover:text-brand-light underline">
              {t('signup.signinLink')}
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
