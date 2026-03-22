import { useState, useMemo } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from '../components/ui';

export default function ResetPasswordPage() {
  const nav = useNavigate();
  const location = useLocation();
  const token = useMemo(
    () => new URLSearchParams(location.search).get('token') ?? '',
    [location.search],
  );

  const confirmPasswordReset = useAuthStore((s) => s.confirmPasswordReset);

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pwTooShort = password.length > 0 && password.length < 8;
  const pwMismatch = confirm.length > 0 && password !== confirm;
  const canSubmit = token.length > 0 && password.length >= 8 && password === confirm && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await confirmPasswordReset(token, password);
      nav('/auth/signin?reset=1', { replace: true });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('invalid_or_used_token')) {
        setError('This reset link is invalid or has already been used. Please request a new one.');
      } else if (msg.includes('token_expired')) {
        setError('This reset link has expired. Please request a new one.');
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  };

  if (!token) {
    return (
      <div
        data-testid="page-reset-password"
        className="min-h-screen flex flex-col items-center justify-center px-4"
      >
        <div className="w-full max-w-sm space-y-6 text-center">
          <Logo size="sm" />
          <p className="text-sm text-semantic-error">
            Invalid reset link. Please request a new one.
          </p>
          <Link to="/auth/forgot-password" className="text-sm text-brand hover:underline">
            Request new link →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      data-testid="page-reset-password"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 text-center">
            // SET NEW PASSWORD
          </div>
          <h1 className="text-2xl font-bold text-center text-white">Reset your password</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Vault data warning */}
          <div
            data-testid="vault-loss-warning"
            className="rounded-lg border border-[#FF8400]/30 bg-[#FF8400]/[0.06] p-4 flex gap-3"
          >
            <span className="text-[#FF8400] text-lg leading-none mt-0.5">⚠</span>
            <div className="space-y-1">
              <p className="text-sm text-[#FF8400]/90 font-medium">
                This will permanently delete all your encrypted portfolio data.
              </p>
              <p className="text-xs text-[#FF8400]/70">
                Your account and any active subscription will remain. This cannot be undone.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm text-content-secondary mb-1">New password</label>
              <input
                data-testid="form-new-password"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
              />
              {pwTooShort && (
                <p className="text-xs text-rose-400 mt-1">
                  Password must be at least 8 characters.
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm text-content-secondary mb-1">Confirm password</label>
              <input
                data-testid="form-confirm-password"
                type="password"
                required
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                  focus:outline-none focus:border-brand/50 transition-colors"
              />
              {pwMismatch && <p className="text-xs text-rose-400 mt-1">Passwords do not match.</p>}
            </div>
          </div>

          <button
            data-testid="btn-confirm-reset"
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-lg bg-semantic-error/80 hover:bg-semantic-error disabled:opacity-60 px-4 py-3
              text-sm font-semibold transition-colors"
          >
            {busy ? 'Resetting…' : 'Reset password and delete data →'}
          </button>

          {error && (
            <div data-testid="reset-error" className="text-sm text-semantic-error text-center">
              {error}
              {(error.includes('expired') ||
                error.includes('invalid') ||
                error.includes('used')) && (
                <div className="mt-2">
                  <Link to="/auth/forgot-password" className="text-brand hover:underline">
                    Request a new link →
                  </Link>
                </div>
              )}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
