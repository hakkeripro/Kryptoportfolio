import { isPasskeySupported, getStoredPasskeyWrap } from '../vault/passkey';

type PasskeyCardProps = {
  mode: 'setup' | 'unlock' | 'manage';
  onEnable?: () => void;
  onSkip?: () => void;
  onUnlock?: () => void;
  busy?: boolean;
};

export default function PasskeyCard({ mode, onEnable, onSkip, onUnlock, busy }: PasskeyCardProps) {
  const supported = isPasskeySupported();
  const hasPasskey = !!getStoredPasskeyWrap();

  if (mode === 'setup') {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="font-medium">Enable Passkey</div>
        <p className="text-sm text-content-secondary">
          {supported
            ? 'A passkey lets you unlock without typing your passphrase on this device.'
            : 'Your device does not support passkeys.'}
        </p>
        {supported && (
          <button
            data-testid="btn-enable-passkey"
            disabled={busy}
            onClick={onEnable}
            className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
          >
            {busy ? 'Enabling…' : 'Enable Passkey (recommended)'}
          </button>
        )}
        <button
          data-testid="btn-skip-passkey"
          onClick={onSkip}
          className="block text-sm text-content-tertiary hover:text-content-secondary underline"
        >
          Skip for now
        </button>
      </div>
    );
  }

  if (mode === 'unlock') {
    return (
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-3">
        <div className="font-medium">Unlock with Passkey</div>
        <p className="text-sm text-content-secondary">
          {supported && hasPasskey
            ? 'Unlock without typing your passphrase on this device.'
            : !supported
              ? 'Passkeys are not supported in this browser.'
              : 'No passkey configured on this device yet.'}
        </p>
        <button
          data-testid="btn-unlock-passkey"
          disabled={busy || !supported || !hasPasskey}
          onClick={onUnlock}
          className="rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 px-4 py-2 text-sm font-medium"
        >
          {busy ? 'Unlocking…' : 'Unlock with Passkey'}
        </button>
      </div>
    );
  }

  // mode === 'manage' — used on Account page (rendered inline there)
  return null;
}
