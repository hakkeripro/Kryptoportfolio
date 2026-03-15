import { useState } from 'react';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';
import {
  isPasskeySupported,
  listPasskeyWraps,
  removePasskeyWrap,
  createOrReplacePasskeyWrap,
} from '../vault/passkey';

function errToMsg(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

function PasskeysSection() {
  const passphrase = useVaultStore((s) => s.passphrase);
  const supported = isPasskeySupported();
  const [wraps, setWraps] = useState(() => listPasskeyWraps());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!passphrase) return;
    setError(null);
    setBusy(true);
    try {
      await createOrReplacePasskeyWrap(passphrase);
      setWraps(listPasskeyWraps());
    } catch (e) {
      setError(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = (credId: string) => {
    removePasskeyWrap(credId);
    setWraps(listPasskeyWraps());
  };

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <div className="font-medium">Passkeys</div>
      {!supported && (
        <p className="text-sm text-content-secondary">Your device does not support passkeys.</p>
      )}
      {wraps.length === 0 ? (
        <p className="text-sm text-content-secondary">No passkeys configured on this device.</p>
      ) : (
        <ul className="space-y-2">
          {wraps.map((w) => (
            <li key={w.credIdBase64} className="flex items-center justify-between text-sm">
              <span className="text-content-secondary">
                Passkey &middot; {new Date(w.createdAtISO).toLocaleDateString()}
              </span>
              <button
                onClick={() => handleRemove(w.credIdBase64)}
                className="text-xs text-rose-400 hover:text-semantic-error"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      {supported && (
        <button
          data-testid="btn-add-passkey"
          disabled={busy}
          onClick={handleAdd}
          className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-3 py-2 text-sm font-medium"
        >
          {busy ? 'Adding…' : 'Add Passkey'}
        </button>
      )}
      {error && <div className="text-sm text-semantic-error">{error}</div>}
    </div>
  );
}

function ChangePasswordSection() {
  const token = useAuthStore((s) => s.token);
  const changePassword = useAuthStore((s) => s.changePassword);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) return null;

  const canSubmit = current && next.length >= 8 && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await changePassword(current, next);
      setSuccess(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      const msg = errToMsg(err);
      setError(msg.includes('wrong_password') ? 'Wrong current password.' : msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="font-medium">Change password</div>
      <input
        data-testid="form-current-password"
        type="password"
        placeholder="Current password"
        autoComplete="current-password"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
      />
      <input
        data-testid="form-new-password"
        type="password"
        placeholder="New password (min 8 characters)"
        autoComplete="new-password"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
      />
      <button
        data-testid="btn-change-password"
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-2 text-sm font-medium"
      >
        {busy ? 'Changing…' : 'Change password'}
      </button>
      {error && <div className="text-sm text-semantic-error">{error}</div>}
      {success && <div className="text-sm text-emerald-400">Password changed.</div>}
    </form>
  );
}

function ChangePassphraseSection() {
  const changePassphrase = useVaultStore((s) => s.changePassphrase);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const canSubmit = current && next.length >= 6 && next === confirm && !busy;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setBusy(true);
    try {
      await changePassphrase(current, next);
      setSuccess(true);
      setCurrent('');
      setNext('');
      setConfirm('');
    } catch (err) {
      setError('Wrong current passphrase or decryption failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="font-medium">Change vault passphrase</div>
      <input
        data-testid="form-current-passphrase"
        type="password"
        placeholder="Current passphrase"
        value={current}
        onChange={(e) => setCurrent(e.target.value)}
        className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
      />
      <input
        data-testid="form-new-passphrase"
        type="password"
        placeholder="New passphrase (min 6 characters)"
        value={next}
        onChange={(e) => setNext(e.target.value)}
        className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
      />
      <input
        data-testid="form-confirm-passphrase"
        type="password"
        placeholder="Confirm new passphrase"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="w-full rounded-lg bg-surface-base border border-border px-3 py-2 text-sm"
      />
      {mismatch && <p className="text-xs text-rose-400">Passphrases do not match</p>}
      <button
        data-testid="btn-change-passphrase"
        type="submit"
        disabled={!canSubmit}
        className="rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 px-3 py-2 text-sm font-medium"
      >
        {busy ? 'Changing…' : 'Change passphrase'}
      </button>
      {error && <div className="text-sm text-semantic-error">{error}</div>}
      {success && <div className="text-sm text-emerald-400">Vault passphrase changed.</div>}
    </form>
  );
}

export default function AccountPage() {
  const email = useAuthStore((s) => s.email);

  return (
    <div data-testid="page-account" className="space-y-6">
      <h1 className="text-xl font-semibold">Account</h1>
      {email && <p className="text-sm text-content-secondary">{email}</p>}

      <PasskeysSection />

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-6">
        <div className="text-lg font-medium">Security</div>
        <ChangePasswordSection />
        <hr className="border-border" />
        <ChangePassphraseSection />
      </div>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="font-medium">Data</div>
        <button
          disabled
          className="rounded-lg bg-surface-raised px-3 py-2 text-sm font-medium opacity-50 cursor-not-allowed"
        >
          Export encrypted backup (coming soon)
        </button>
      </div>
    </div>
  );
}
