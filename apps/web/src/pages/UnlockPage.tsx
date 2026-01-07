import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';
import { getStoredPasskeyWrap, isPasskeySupported, unwrapPassphraseWithPasskey } from '../vault/passkey';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

export default function UnlockPage() {
  const nav = useNavigate();
  const location = useLocation();
  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? '/dashboard';
  }, [location.search]);

  const unlockVault = useAppStore((s) => s.unlockVault);
  const [passphrase, setPassphrase] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasPasskey = useMemo(() => !!getStoredPasskeyWrap(), []);
  const passkeyOk = useMemo(() => isPasskeySupported() && hasPasskey, [hasPasskey]);

  const unlockWithPasskey = async () => {
    setError(null);
    setBusy(true);
    try {
      const p = await unwrapPassphraseWithPasskey();
      await unlockVault(p, { rememberSession: true });
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const unlockWithPassphrase = async () => {
    setError(null);
    setBusy(true);
    try {
      await unlockVault(passphrase, { rememberSession: true });
      nav(next, { replace: true });
    } catch (e) {
      setError(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-unlock">
      <h1 className="text-xl font-semibold">Unlock Vault</h1>

      <div className="text-sm text-slate-300">
        Same <span className="font-semibold">Vault Passphrase</span> works on all devices. A{' '}
        <span className="font-semibold">Passkey</span> is device-specific; enable it per device for quick unlock.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="font-medium">Use Passkey</div>
          <div className="text-sm text-slate-300">
            {isPasskeySupported()
              ? hasPasskey
                ? 'Unlock without typing your passphrase on this device.'
                : 'No passkey configured on this device yet.'
              : 'Passkeys are not supported in this browser.'}
          </div>
          <button
            data-testid="btn-unlock-passkey"
            disabled={busy || !passkeyOk}
            onClick={() => void unlockWithPasskey()}
            className="rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-3 py-2 text-sm font-medium"
          >
            {busy ? 'Unlocking…' : 'Unlock with Passkey'}
          </button>
          <div className="text-xs text-slate-400">
            Tip: enable a passkey in <span className="font-medium">Settings → Security</span> after unlocking.
          </div>
        </div>

        <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-3">
          <div className="font-medium">Use Vault Passphrase</div>
          <input
            data-testid="form-unlock-passphrase"
            type="password"
            placeholder="Vault passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="rounded-lg bg-slate-950 border border-slate-800 px-3 py-2 text-sm w-full"
          />
          <button
            data-testid="btn-unlock-passphrase"
            disabled={busy || passphrase.length < 1}
            onClick={() => void unlockWithPassphrase()}
            className="rounded-lg bg-slate-700 hover:bg-slate-600 disabled:opacity-60 px-3 py-2 text-sm font-medium"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>

      {error ? (
        <div data-testid="alert-unlock-error" className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200">
          {error}
        </div>
      ) : null}
    </div>
  );
}
