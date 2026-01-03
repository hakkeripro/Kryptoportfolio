import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function OnboardingPage() {
  const nav = useNavigate();
  const location = useLocation();
  const from = (location.state as any)?.from as string | undefined;

  const {
    apiBase,
    setApiBase,
    vaultReady,
    vaultSetup,
    passphrase,
    setupVault,
    unlockVault,
    token,
    email,
    register,
    login
  } = useAppStore();

  const [vaultPass, setVaultPass] = useState('');
  const [vaultPass2, setVaultPass2] = useState('');
  const [vaultError, setVaultError] = useState<string | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPass, setAuthPass] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [vaultBusy, setVaultBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const status = useMemo(() => {
    if (!vaultReady) return 'loading';
    if (!vaultSetup) return 'not_setup';
    if (!passphrase) return 'locked';
    return 'unlocked';
  }, [vaultReady, vaultSetup, passphrase]);

  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? from ?? '/dashboard';
  }, [location.search, from]);

  useEffect(() => {
    if (!vaultReady) return;
    // If a vault already exists, never send the user back to onboarding on reload.
    if (vaultSetup && !passphrase) {
      nav(`/unlock?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
  }, [vaultReady, vaultSetup, passphrase, next, nav]);

  const handleSetup = async () => {
    setVaultError(null);
    if (!vaultPass || vaultPass.length < 6) return setVaultError('Passphrase liian lyhyt (min 6)');
    if (vaultPass !== vaultPass2) return setVaultError('Passphrase ei täsmää');
    setVaultBusy(true);
    try {
      await setupVault(vaultPass);
      // Stay on onboarding so user can optionally configure API + auth before continuing.
    } catch (e) {
      setVaultError(errToMsg(e));
    } finally {
      setVaultBusy(false);
    }
  };

  const handleUnlock = async () => {
    setVaultError(null);
    setVaultBusy(true);
    try {
      await unlockVault(vaultPass);
      // Stay on onboarding; user can continue when ready.
    } catch (e) {
      setVaultError(errToMsg(e));
    } finally {
      setVaultBusy(false);
    }
  };

  const handleRegister = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await register(authEmail, authPass);
    } catch (e) {
      setAuthError(errToMsg(e));
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogin = async () => {
    setAuthError(null);
    setAuthBusy(true);
    try {
      await login(authEmail, authPass);
    } catch (e) {
      setAuthError(errToMsg(e));
    } finally {
      setAuthBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold">Onboarding</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-2">
          <div className="font-medium">Vault / App lock</div>
          {status === 'locked' && (
            <span data-testid="badge-locked" className="text-xs rounded bg-slate-800 px-2 py-1">
              Locked
            </span>
          )}
          {status === 'unlocked' && (
            <span data-testid="badge-unlocked" className="text-xs rounded bg-slate-800 px-2 py-1">
              Unlocked
            </span>
          )}
        </div>

        {status === 'loading' ? (
          <div className="text-sm text-slate-300">Loading…</div>
        ) : !vaultSetup ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">
              Luo passphrase. Huom: E2E-synkka on zero-knowledge — jos unohdat passphrasen, dataa ei voi palauttaa.
            </p>
            <div className="grid gap-2 max-w-md">
              <input
                data-testid="form-vault-passphrase"
                type="password"
                placeholder="Passphrase"
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2"
                value={vaultPass}
                onChange={(e) => setVaultPass(e.target.value)}
              />
              <input
                data-testid="form-vault-passphrase-confirm"
                type="password"
                placeholder="Confirm passphrase"
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2"
                value={vaultPass2}
                onChange={(e) => setVaultPass2(e.target.value)}
              />
              <button
                data-testid="btn-create-vault"
                disabled={vaultBusy}
                onClick={handleSetup}
                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-sm font-medium"
              >
                Create vault
              </button>
              {vaultError && <div className="text-sm text-rose-300">{vaultError}</div>}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-300">Syötä passphrase avataksesi sovelluksen.</p>
            <div className="grid gap-2 max-w-md">
              <input
                data-testid="form-vault-passphrase"
                type="password"
                placeholder="Passphrase"
                className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2"
                value={vaultPass}
                onChange={(e) => setVaultPass(e.target.value)}
              />
              <button
                data-testid="btn-unlock"
                disabled={vaultBusy}
                onClick={handleUnlock}
                className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-2 text-sm font-medium"
              >
                Unlock
              </button>
              {vaultError && <div className="text-sm text-rose-300">{vaultError}</div>}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="font-medium">API</div>
        <div className="grid gap-2 max-w-md">
          <input
            data-testid="form-api-base"
            value={apiBase}
            onChange={(e) => setApiBase(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
            placeholder="http://localhost:8788"
          />
        </div>
      </div>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <div className="flex items-center gap-3">
          <div className="font-medium">Login + Sync</div>
          {token ? (
            <span className="text-xs rounded bg-slate-800 px-2 py-1">Logged in: {email}</span>
          ) : (
            <span className="text-xs rounded bg-slate-800 px-2 py-1">Not logged in</span>
          )}
        </div>

        <div className="grid gap-2 max-w-md">
          <input
            data-testid="form-auth-email"
            value={authEmail}
            onChange={(e) => setAuthEmail(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
            placeholder="Email"
          />
          <input
            data-testid="form-auth-password"
            type="password"
            value={authPass}
            onChange={(e) => setAuthPass(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm"
            placeholder="Password"
          />
          <div className="flex gap-2">
            <button
              data-testid="btn-register"
              disabled={authBusy}
              onClick={handleRegister}
              className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-2 text-sm font-medium"
            >
              Register
            </button>
            <button
              data-testid="btn-login"
              disabled={authBusy}
              onClick={handleLogin}
              className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-2 text-sm font-medium"
            >
              Login
            </button>
          </div>
          {authError && <div className="text-sm text-rose-300">{authError}</div>}
        </div>

        <div className="pt-2">
          <button
            data-testid="btn-finish-onboarding"
            onClick={() => nav(from ?? '/dashboard')}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  );
}
