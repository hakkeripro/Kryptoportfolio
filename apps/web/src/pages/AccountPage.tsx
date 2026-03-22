import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { UpgradeModal } from '../components/billing/UpgradeModal';
import { isPasskeyAvailable } from '../lib/webauthn';

function errToMsg(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (msg.includes('passkey_prf_not_supported'))
    return "Your device or browser doesn't support passkeys with PRF.";
  if (msg.includes('passkey_cancelled')) return 'Passkey setup was cancelled.';
  if (msg.includes('cannot_remove_last_auth_method'))
    return 'Cannot remove the last authentication method. Add a password or another passkey first.';
  return msg;
}

function PasskeysSection() {
  const token = useAuthStore((s) => s.token);
  const passkeys = useAuthStore((s) => s.passkeys);
  const fetchPasskeys = useAuthStore((s) => s.fetchPasskeys);
  const registerPasskey = useAuthStore((s) => s.registerPasskey);
  const deletePasskey = useAuthStore((s) => s.deletePasskey);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deviceName, setDeviceName] = useState('');

  const supported = isPasskeyAvailable();

  useEffect(() => {
    if (token) void fetchPasskeys();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const handleAdd = async () => {
    setError(null);
    setBusy(true);
    try {
      await registerPasskey(deviceName.trim() || 'My Device');
      setDeviceName('');
    } catch (e) {
      setError(errToMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async (credentialId: string) => {
    setError(null);
    try {
      await deletePasskey(credentialId);
    } catch (e) {
      setError(errToMsg(e));
    }
  };

  if (!token) return null;

  return (
    <div className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 space-y-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
        // SECURITY
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium text-white/70">Passkeys</div>

        {!supported && (
          <p className="text-sm text-content-secondary">Your device does not support passkeys.</p>
        )}

        {passkeys.length === 0 ? (
          <p className="text-sm text-content-secondary">No passkeys registered.</p>
        ) : (
          <ul className="space-y-2">
            {passkeys.map((p) => (
              <li key={p.id} className="flex items-center justify-between text-sm">
                <span className="text-content-secondary font-mono">
                  {p.deviceName ?? 'Passkey'}{' '}
                  <span className="text-white/30">&middot; {new Date(p.createdAtISO).toLocaleDateString()}</span>
                </span>
                <button
                  data-testid={`btn-remove-passkey-${p.id}`}
                  onClick={() => handleRemove(p.id)}
                  className="text-xs text-rose-400 hover:text-semantic-error transition-colors"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {supported && (
          <div className="flex gap-2 pt-1">
            <input
              data-testid="input-passkey-device-name"
              type="text"
              placeholder="Device name (optional)"
              value={deviceName}
              onChange={(e) => setDeviceName(e.target.value)}
              className="flex-1 rounded-lg bg-surface-base border border-border px-3 py-1.5 text-sm
                focus:outline-none focus:border-brand/50 transition-colors"
            />
            <button
              data-testid="btn-add-passkey"
              disabled={busy}
              onClick={handleAdd}
              className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-3 py-1.5 text-sm font-medium transition-colors"
            >
              {busy ? 'Adding…' : '+ Add passkey'}
            </button>
          </div>
        )}

        {error && <div className="text-sm text-semantic-error">{error}</div>}
      </div>
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
        className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-3 py-2 text-sm font-medium"
      >
        {busy ? 'Changing…' : 'Change password'}
      </button>
      {error && <div className="text-sm text-semantic-error">{error}</div>}
      {success && <div className="text-sm text-semantic-success">Password changed.</div>}
    </form>
  );
}


function BillingSection() {
  const plan = useAuthStore((s) => s.plan);
  const planExpiresAt = useAuthStore((s) => s.planExpiresAt);
  const token = useAuthStore((s) => s.token);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  if (!token) return null;

  return (
    <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30">
        // BILLING
      </div>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-content-tertiary">Plan</span>
          <span
            data-testid="billing-plan"
            className={`text-sm font-medium ${plan === 'tax' ? 'text-[#FF8400]' : 'text-content-primary'}`}
          >
            {plan === 'tax' ? 'Tax' : 'Free'}
          </span>
        </div>
        {planExpiresAt && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-content-tertiary">Expires</span>
            <span className="text-sm text-content-secondary">
              {new Date(planExpiresAt).toLocaleDateString()}
            </span>
          </div>
        )}
        {plan === 'free' && (
          <button
            data-testid="btn-upgrade-plan"
            onClick={() => setUpgradeOpen(true)}
            className="mt-2 w-full rounded-xl bg-[#FF8400]/10 hover:bg-[#FF8400]/20 border border-[#FF8400]/20
              text-[#FF8400] text-sm font-medium py-2 transition-colors"
          >
            Upgrade to Tax plan
          </button>
        )}
      </div>
      <UpgradeModal open={upgradeOpen} onClose={() => setUpgradeOpen(false)} />
    </div>
  );
}

export default function AccountPage() {
  const { t } = useTranslation();
  const email = useAuthStore((s) => s.email);

  return (
    <div data-testid="page-account" className="space-y-6">
      <h1 className="text-xl font-semibold">{t('account.title')}</h1>
      {email && <p className="text-sm text-content-secondary">{email}</p>}

      <BillingSection />

      <PasskeysSection />

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-6">
        <div className="text-lg font-medium">Security</div>
        <ChangePasswordSection />
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
