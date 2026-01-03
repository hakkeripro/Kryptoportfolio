import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const KP_VAULT_PASSPHRASE_SESSION = 'kp_vault_passphrase_session';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function UnlockPage() {
  const nav = useNavigate();
  const location = useLocation();

  const { vaultReady, vaultSetup, passphrase, unlockVault } = useAppStore();

  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? '/dashboard';
  }, [location.search]);

  const [p, setP] = useState('');
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!vaultReady) return;
    if (!vaultSetup) {
      nav(`/onboarding?next=${encodeURIComponent(next)}`, { replace: true });
      return;
    }
    if (passphrase) {
      nav(next, { replace: true });
    }
  }, [vaultReady, vaultSetup, passphrase, next, nav]);

  const handleUnlock = async () => {
    setErr(null);
    setBusy(true);
    try {
      await unlockVault(p);
      if (remember) {
        try {
          sessionStorage.setItem(KP_VAULT_PASSPHRASE_SESSION, p);
        } catch {
          /* ignore */
        }
      } else {
        try {
          sessionStorage.removeItem(KP_VAULT_PASSPHRASE_SESSION);
        } catch {
          /* ignore */
        }
      }
      nav(next, { replace: true });
    } catch (e) {
      setErr(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Unlock vault</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
        <p className="text-sm text-slate-300">
          Your vault is encrypted locally. Enter your passphrase to unlock it for this session.
        </p>

        <input
          data-testid="form-unlock-passphrase"
          type="password"
          className="w-full"
          value={p}
          onChange={(e) => setP(e.target.value)}
          placeholder="Passphrase"
        />

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input
            data-testid="toggle-remember-passphrase"
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          Remember for this tab
        </label>

        {err ? (
          <div data-testid="txt-unlock-error" className="text-sm text-rose-300">
            {err}
          </div>
        ) : null}

        <div className="flex gap-2">
          <button
            data-testid="btn-unlock-vault"
            onClick={() => void handleUnlock()}
            disabled={busy}
            className="rounded-lg bg-slate-800 hover:bg-slate-700 px-3 py-2 text-sm disabled:opacity-50"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
          <button
            data-testid="btn-unlock-go-onboarding"
            onClick={() => nav(`/onboarding?next=${encodeURIComponent(next)}`)}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 px-3 py-2 text-sm"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
