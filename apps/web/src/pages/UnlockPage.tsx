import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useVaultStore } from '../store/useVaultStore';
import {
  getStoredPasskeyWrap,
  isPasskeySupported,
  unwrapPassphraseWithPasskey,
} from '../vault/passkey';

function errToMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('Decryption') || msg.includes('decrypt')) return 'Wrong passphrase. Try again.';
  if (msg.includes('passkey_cancelled')) return 'Passkey authentication was cancelled.';
  if (msg.includes('hmac_secret_not_supported') || msg.includes('prf_not_supported'))
    return 'Passkeys are not supported on this device.';
  return msg;
}

export default function UnlockPage() {
  const nav = useNavigate();
  const location = useLocation();
  const next = useMemo(() => {
    const q = new URLSearchParams(location.search).get('next');
    return q ?? '/dashboard';
  }, [location.search]);

  const unlockVault = useVaultStore((s) => s.unlockVault);
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

      <div className="text-sm text-content-secondary">
        Same <span className="font-semibold">Vault Passphrase</span> works on all devices. A{' '}
        <span className="font-semibold">Passkey</span> is device-specific; enable it per device for
        quick unlock.
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <div className="font-medium">Use Passkey</div>
          <div className="text-sm text-content-secondary">
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
            className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-3 py-2 text-sm font-medium"
          >
            {busy ? 'Unlocking…' : 'Unlock with Passkey'}
          </button>
          <div className="text-xs text-content-secondary">
            Tip: enable a passkey in <span className="font-medium">Account → Passkeys</span> after
            unlocking.
          </div>
        </div>

        <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
          <div className="font-medium">Use Vault Passphrase</div>
          <input
            data-testid="form-unlock-passphrase"
            type="password"
            placeholder="Vault passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
            className="rounded-lg bg-surface-base border border-border px-3 py-2 text-sm w-full"
          />
          <button
            data-testid="btn-unlock-passphrase"
            disabled={busy || passphrase.length < 1}
            onClick={() => void unlockWithPassphrase()}
            className="rounded-lg bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm font-medium"
          >
            {busy ? 'Unlocking…' : 'Unlock'}
          </button>
        </div>
      </div>

      {error ? (
        <div
          data-testid="alert-unlock-error"
          className="rounded-lg border border-rose-800 bg-rose-950/30 p-3 text-sm text-rose-200"
        >
          {error}
        </div>
      ) : null}
    </div>
  );
}
