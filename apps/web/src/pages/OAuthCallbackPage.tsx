import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Logo } from '../components/ui';
import { useAuthStore } from '../store/useAuthStore';
import { apiFetch } from '../store/apiFetch';
import { z } from 'zod';

type PageState = 'loading' | 'pin_setup' | 'pin_enter' | 'vault_reset_confirm' | 'error';

const VaultKeyResponseSchema = z.object({
  blob: z.unknown().nullable(),
  salt: z.string().nullable(),
});

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

export default function OAuthCallbackPage() {
  const nav = useNavigate();
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle);
  const setupOAuthVault = useAuthStore((s) => s.setupOAuthVault);
  const unlockWithPin = useAuthStore((s) => s.unlockWithPin);
  const resetVault = useAuthStore((s) => s.resetVault);
  const apiBase = useAuthStore((s) => s.apiBase);
  const token = useAuthStore((s) => s.token);

  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [pinError, setPinError] = useState('');

  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    void (async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const state = params.get('state');
      const errorParam = params.get('error');

      if (errorParam === 'access_denied') {
        setErrorMsg('Sign in was cancelled. Please try again.');
        setPageState('error');
        return;
      }

      if (!code || !state) {
        setErrorMsg('Invalid request. Please try again.');
        setPageState('error');
        return;
      }

      const savedState = sessionStorage.getItem('oauth_state');
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');

      if (!savedState || state !== savedState || !codeVerifier) {
        setErrorMsg('Invalid request (state mismatch). Please try again.');
        setPageState('error');
        return;
      }

      sessionStorage.removeItem('oauth_state');
      sessionStorage.removeItem('oauth_code_verifier');

      const redirectUri = `${window.location.origin}/auth/callback`;

      try {
        await loginWithGoogle(code, codeVerifier, redirectUri);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes('email_taken_password')) {
          setErrorMsg(
            'This email is already registered with a password. Sign in with your email and password instead.',
          );
        } else {
          setErrorMsg('Sign in failed. Please try again.');
        }
        setPageState('error');
        return;
      }

      // Check vault blob
      try {
        const t = useAuthStore.getState().token;
        const r = await apiFetch<unknown>(apiBase, '/v1/vault/key', {
          headers: { authorization: `Bearer ${t}` },
        });
        const { blob } = VaultKeyResponseSchema.parse(r);
        setPageState(blob ? 'pin_enter' : 'pin_setup');
      } catch {
        setPageState('pin_setup');
      }
    })();
  }, [loginWithGoogle, apiBase, token]);

  const handlePinSubmit = async () => {
    if (pin.length < 4 || busy) return;
    setPinError('');
    setBusy(true);
    try {
      if (pageState === 'pin_setup') {
        await setupOAuthVault(pin);
      } else {
        await unlockWithPin(pin);
      }
      nav('/home', { replace: true });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes('Decryption') || msg.includes('decrypt') || msg.includes('invalid_key')) {
        setPinError('Incorrect PIN. Please try again.');
      } else {
        setPinError('Something went wrong. Please try again.');
      }
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const handleVaultReset = async () => {
    setBusy(true);
    try {
      await resetVault();
      setPin('');
      setPageState('pin_setup');
    } catch {
      setPinError('Reset failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (pageState === 'loading') {
    return (
      <div
        data-testid="page-oauth-callback"
        className="min-h-screen flex flex-col items-center justify-center px-4"
      >
        <div className="space-y-4 text-center">
          <Logo size="sm" />
          <p className="text-sm text-content-secondary animate-pulse">Signing in…</p>
        </div>
      </div>
    );
  }

  if (pageState === 'error') {
    return (
      <div
        data-testid="page-oauth-callback"
        className="min-h-screen flex flex-col items-center justify-center px-4"
      >
        <div className="w-full max-w-sm space-y-6 text-center">
          <Logo size="sm" />
          <div
            data-testid="oauth-error"
            className="rounded-lg border border-semantic-error/30 bg-semantic-error/5 p-4 text-sm text-semantic-error"
          >
            {errorMsg}
          </div>
          <button
            onClick={() => nav('/auth/signin', { replace: true })}
            className="text-sm text-brand hover:underline"
          >
            ← Back to sign in
          </button>
        </div>
      </div>
    );
  }

  if (pageState === 'vault_reset_confirm') {
    return (
      <div
        data-testid="page-oauth-callback"
        className="min-h-screen flex flex-col items-center justify-center px-4"
      >
        <div className="w-full max-w-sm space-y-8">
          <div className="flex justify-center">
            <Logo size="sm" />
          </div>

          <div className="space-y-4">
            <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
              // RESET VAULT
            </div>
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 space-y-2">
              <p className="text-sm text-amber-400 font-semibold">
                This will permanently delete all your encrypted data.
              </p>
              <p className="text-sm text-content-secondary">
                Your account and subscription will remain active.
              </p>
              <p className="text-xs text-content-tertiary">This cannot be undone.</p>
            </div>

            {pinError && (
              <p data-testid="pin-error" className="text-sm text-semantic-error text-center">
                {pinError}
              </p>
            )}

            <div className="flex gap-3">
              <button
                data-testid="btn-cancel-reset"
                onClick={() => setPageState('pin_enter')}
                disabled={busy}
                className="flex-1 rounded-lg border border-white/[0.08] px-4 py-2.5 text-sm text-content-secondary
                  hover:border-white/20 transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                data-testid="btn-confirm-reset"
                onClick={handleVaultReset}
                disabled={busy}
                className="flex-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 px-4 py-2.5
                  text-sm font-semibold transition-colors"
              >
                {busy ? 'Deleting…' : 'Delete all data and reset →'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // pin_setup or pin_enter
  const isSetup = pageState === 'pin_setup';

  return (
    <div
      data-testid="page-oauth-callback"
      className="min-h-screen flex flex-col items-center justify-center px-4"
    >
      <div className="w-full max-w-sm space-y-8">
        <div className="flex justify-center">
          <Logo size="sm" />
        </div>

        <div className="text-center space-y-2">
          {!isSetup && <div className="text-3xl">🔒</div>}
          <h1 className="text-2xl font-bold text-white">
            {isSetup ? 'Protect your data' : 'Welcome back'}
          </h1>
          <p className="text-sm text-content-secondary">
            {isSetup
              ? "Enter a 4–6 digit PIN. You'll use this every time you sign in with Google."
              : 'Enter your PIN to access your encrypted data.'}
          </p>
        </div>

        <div className="space-y-6">
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 text-center">
            {isSetup ? '// SET UP YOUR PIN' : '// ENTER YOUR PIN'}
          </div>

          <PinInput value={pin} onChange={setPin} disabled={busy} />

          {isSetup && (
            <p className="text-xs text-amber-400/80 text-center">
              ⚠ If you forget your PIN, your encrypted data cannot be recovered.
            </p>
          )}

          {pinError && (
            <p data-testid="pin-error" className="text-sm text-semantic-error text-center">
              {pinError}
            </p>
          )}

          <button
            data-testid="btn-pin-submit"
            onClick={handlePinSubmit}
            disabled={pin.length < 4 || busy}
            className="w-full rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-3
              text-sm font-semibold transition-colors shadow-glow-brand"
          >
            {busy
              ? isSetup
                ? 'Setting up vault…'
                : 'Unlocking…'
              : isSetup
                ? 'Set up PIN →'
                : 'Continue →'}
          </button>

          {!isSetup && (
            <div className="text-center">
              <button
                data-testid="btn-forgot-pin"
                onClick={() => setPageState('vault_reset_confirm')}
                className="text-sm text-content-tertiary hover:text-content-secondary transition-colors underline"
              >
                Forgot PIN? Reset vault →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
