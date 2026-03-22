import { useMemo, useRef, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from '../components/ui';

function errToMsg(e: unknown, isPin: boolean): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Decryption') || msg.includes('decrypt') || msg.includes('Wrong password'))
    return isPin ? 'Incorrect PIN. Please try again.' : 'Incorrect password. Please try again.';
  if (msg.includes('vault_not_found'))
    return "We couldn't restore your vault. Please sign out and sign in again.";
  if (msg.includes('not_authenticated')) return 'Session expired. Please sign in again.';
  return msg;
}

function PinInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const inputs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6);

  const handleKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputs.current[i - 1]?.focus();
      onChange(value.slice(0, i - 1));
    }
  };

  const handleChange = (i: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const ch = e.target.value.replace(/\D/g, '').slice(-1);
    const next = (value + ch).slice(0, 6);
    const arr = next.split('').concat(Array(6).fill('')).slice(0, 6);
    const filled = arr.filter(Boolean).length;
    onChange(next);
    if (ch && filled < 6) {
      inputs.current[filled]?.focus();
    }
  };

  return (
    <div className="flex gap-3 justify-center" data-testid="pin-input-group">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            inputs.current[i] = el;
          }}
          type="password"
          inputMode="numeric"
          maxLength={1}
          value={d}
          disabled={disabled}
          autoFocus={i === 0}
          data-testid={`pin-digit-${i}`}
          onChange={(e) => handleChange(i, e)}
          onKeyDown={(e) => handleKey(i, e)}
          className="w-11 h-14 rounded-lg bg-surface-base border border-border text-center text-lg font-mono
            focus:outline-none focus:border-brand/70 transition-colors disabled:opacity-50"
        />
      ))}
    </div>
  );
}

export default function UnlockPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const location = useLocation();
  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? '/home';
  }, [location.search]);

  const authMethod = useAuthStore((s) => s.authMethod);
  const unlockWithPassword = useAuthStore((s) => s.unlockWithPassword);
  const unlockWithPin = useAuthStore((s) => s.unlockWithPin);
  const unlockWithPasskey = useAuthStore((s) => s.unlockWithPasskey);
  const logout = useAuthStore((s) => s.logout);

  const isOAuth = authMethod === 'oauth';
  const isPasskey = authMethod === 'passkey';

  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-trigger passkey authentication
  useEffect(() => {
    if (!isPasskey) return;
    setBusy(true);
    setError(null);
    unlockWithPasskey()
      .then(() => nav(next, { replace: true }))
      .catch((e: unknown) => {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('passkey_prf_not_supported')) {
          setError("Your device or browser doesn't support passkeys with PRF. Please sign out and use your password.");
        } else if (msg.includes('passkey_cancelled')) {
          setError('Authentication was cancelled. Tap the button below to try again.');
        } else {
          setError(errToMsg(e, false));
        }
        setBusy(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPasskey]);

  const handlePasskeyRetry = () => {
    setBusy(true);
    setError(null);
    unlockWithPasskey()
      .then(() => nav(next, { replace: true }))
      .catch((e: unknown) => {
        setError(errToMsg(e, false));
        setBusy(false);
      });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = isOAuth ? pin : password;
    if (!value || busy) return;
    setError(null);
    setBusy(true);
    try {
      if (isOAuth) {
        await unlockWithPin(pin);
      } else {
        await unlockWithPassword(password);
      }
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e, isOAuth));
      if (isOAuth) setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    logout();
    nav('/welcome', { replace: true });
  };

  // Passkey unlock branch
  if (isPasskey) {
    return (
      <div
        data-testid="page-unlock"
        className="min-h-screen flex flex-col items-center justify-center px-4"
      >
        <div className="w-full max-w-sm space-y-8 text-center">
          <div className="flex justify-center">
            <Logo size="sm" />
          </div>

          <div className="space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${busy ? 'animate-pulse bg-[#FF8400]/20' : 'bg-white/[0.04]'}`}>
              <svg className="w-8 h-8 text-[#FF8400]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 013 3m3 0a6 6 0 01-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1121.75 8.25z" />
              </svg>
            </div>

            <div>
              <h1 className="text-2xl font-bold text-white">
                {busy ? 'Authenticating…' : 'Unlock with passkey'}
              </h1>
              <p className="text-sm text-content-secondary mt-1">
                {busy ? 'Use Touch ID, Face ID, or your device PIN.' : 'Tap below to authenticate.'}
              </p>
            </div>
          </div>

          {error && (
            <div data-testid="alert-unlock-error" className="rounded-lg border border-semantic-error/30 bg-semantic-error/5 p-3 text-sm text-semantic-error text-left">
              {error}
            </div>
          )}

          {!busy && (
            <button
              data-testid="btn-passkey-unlock"
              onClick={handlePasskeyRetry}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark px-4 py-3 text-sm font-semibold transition-colors shadow-glow-brand"
            >
              Authenticate →
            </button>
          )}

          <button
            onClick={handleSignOut}
            className="text-sm text-content-tertiary hover:text-content-secondary underline transition-colors"
          >
            Sign out →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="page-unlock"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-8">
        {/* Logo */}
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        {/* Title */}
        <div className="text-center space-y-2">
          <div className="text-3xl">🔒</div>
          <h1 className="text-2xl font-bold text-white">
            {t('unlock.title', { defaultValue: 'Session expired' })}
          </h1>
          <p className="text-sm text-content-secondary">
            {isOAuth
              ? 'Enter your PIN to access your encrypted data.'
              : t('unlock.description', { defaultValue: 'Enter your password to continue.' })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isOAuth ? (
            <div className="space-y-4">
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 text-center">
                // ENTER YOUR PIN
              </div>
              <PinInput value={pin} onChange={setPin} disabled={busy} />
            </div>
          ) : (
            <div>
              <label className="block text-sm text-content-secondary mb-1">
                {t('unlock.passphrase.title', { defaultValue: 'Password' })}
              </label>
              <input
                data-testid="form-unlock-passphrase"
                type="password"
                autoComplete="current-password"
                placeholder={t('unlock.passphrase.placeholder', { defaultValue: 'Your password' })}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2.5 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
              />
            </div>
          )}

          <button
            data-testid="btn-unlock-passphrase"
            type="submit"
            disabled={busy || (isOAuth ? pin.length < 4 : password.length < 1)}
            className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60
              px-4 py-2.5 text-sm font-semibold transition-colors shadow-glow-brand"
          >
            {busy
              ? t('unlock.btn.unlocking', { defaultValue: 'Unlocking…' })
              : t('unlock.btn.unlock', { defaultValue: 'Continue →' })}
          </button>

          {error && (
            <motion.div
              data-testid="alert-unlock-error"
              className="rounded-lg border border-semantic-error/30 bg-semantic-error/5 p-3 text-sm text-semantic-error"
              animate={{ x: [0, -8, 8, -6, 6, -4, 4, 0] }}
              transition={{ duration: 0.5, ease: 'easeInOut' }}
            >
              {error}
            </motion.div>
          )}
        </form>

        <div className="text-center">
          <button
            onClick={handleSignOut}
            className="text-sm text-content-tertiary hover:text-content-secondary underline transition-colors"
          >
            Sign out →
          </button>
        </div>
      </div>
    </div>
  );
}
