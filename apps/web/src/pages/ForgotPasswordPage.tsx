import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/useAuthStore';
import { Logo } from '../components/ui';

export default function ForgotPasswordPage() {
  const requestPasswordReset = useAuthStore((s) => s.requestPasswordReset);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = email.length > 0 && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setBusy(true);
    try {
      await requestPasswordReset(email);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      data-testid="page-forgot-password"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        <div className="space-y-3">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 text-center">
            // RESET PASSWORD
          </div>
          <h1 className="text-2xl font-bold text-center text-white">Forgot your password?</h1>
        </div>

        {sent ? (
          <div data-testid="reset-email-sent" className="space-y-4 text-center">
            <div className="text-4xl">📨</div>
            <p className="text-sm text-content-secondary">
              If an account with that email exists, we've sent a reset link. Check your inbox.
            </p>
            <p className="text-xs text-white/30">The link expires in 1 hour.</p>
            <Link
              to="/auth/signin"
              className="block text-sm text-brand hover:underline transition-colors"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Vault data warning */}
            <div
              data-testid="vault-loss-warning"
              className="rounded-lg border border-[#FF8400]/30 bg-[#FF8400]/[0.06] p-4 flex gap-3"
            >
              <span className="text-[#FF8400] text-lg leading-none mt-0.5">⚠</span>
              <p className="text-sm text-[#FF8400]/90 leading-relaxed">
                Resetting your password will <strong>permanently delete</strong> all your encrypted
                portfolio data. This cannot be undone.
              </p>
            </div>

            <div className="space-y-3">
              <p className="text-sm text-content-secondary">
                Enter your email address. We'll send you a link to reset your password.
              </p>

              <div>
                <label className="block text-sm text-content-secondary mb-1">Email</label>
                <input
                  data-testid="form-reset-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm
                    focus:outline-none focus:border-brand/50 transition-colors"
                />
              </div>
            </div>

            <button
              data-testid="btn-send-reset-link"
              type="submit"
              disabled={!canSubmit}
              className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-3
                text-sm font-semibold transition-colors shadow-glow-brand"
            >
              {busy ? 'Sending…' : 'Send reset link →'}
            </button>

            {error && (
              <div data-testid="reset-error" className="text-sm text-semantic-error text-center">
                {error}
              </div>
            )}

            <Link
              to="/auth/signin"
              className="block text-center text-sm text-content-tertiary hover:text-content-secondary transition-colors"
            >
              ← Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
