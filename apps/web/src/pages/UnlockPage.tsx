import { useMemo, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from '../components/ui';

function errToMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Decryption') || msg.includes('decrypt') || msg.includes('Wrong password'))
    return 'Incorrect password. Please try again.';
  if (msg.includes('vault_not_found'))
    return "We couldn't restore your vault. Please sign out and sign in again.";
  if (msg.includes('not_authenticated')) return 'Session expired. Please sign in again.';
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

  const unlockWithPassword = useAuthStore((s) => s.unlockWithPassword);
  const logout = useAuthStore((s) => s.logout);

  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || busy) return;
    setError(null);
    setBusy(true);
    try {
      await unlockWithPassword(password);
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = () => {
    logout();
    nav('/welcome', { replace: true });
  };

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
            {t('unlock.description', { defaultValue: 'Enter your password to continue.' })}
          </p>
        </div>

        {/* Password form */}
        <form onSubmit={handleSubmit} className="space-y-4">
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

          <button
            data-testid="btn-unlock-passphrase"
            type="submit"
            disabled={busy || password.length < 1}
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
