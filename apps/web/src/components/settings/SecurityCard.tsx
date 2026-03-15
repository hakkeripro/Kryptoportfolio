import { useState } from 'react';
import { useVaultStore } from '../../store/useVaultStore';
import {
  clearPasskeyWrap,
  createOrReplacePasskeyWrap,
  getStoredPasskeyWrap,
  isPasskeySupported,
} from '../../vault/passkey';

interface Props {
  busy: boolean;
  setBusy: (v: boolean) => void;
}

export default function SecurityCard({ busy, setBusy }: Props) {
  const [passkeyMsg, setPasskeyMsg] = useState('');
  const hasPasskey = !!getStoredPasskeyWrap();

  const enablePasskey = async () => {
    setPasskeyMsg('');
    const passphrase = useVaultStore.getState().passphrase;
    if (!passphrase) {
      setPasskeyMsg('Unlock the vault first.');
      return;
    }
    setBusy(true);
    try {
      await createOrReplacePasskeyWrap(passphrase);
      setPasskeyMsg('Passkey enabled for this device.');
    } catch (e) {
      setPasskeyMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const disablePasskey = async () => {
    setPasskeyMsg('');
    setBusy(true);
    try {
      clearPasskeyWrap();
      setPasskeyMsg('Passkey removed from this device.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-raised p-4 space-y-3"
      data-testid="card-security"
    >
      <div className="font-medium">Security</div>
      <div className="text-sm text-content-secondary">
        Enable a Passkey on this device to unlock without typing your Vault passphrase.
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-surface-base p-3">
        <div>
          <div className="text-sm font-medium">Passkey unlock (this device)</div>
          <div className="text-xs text-content-secondary">
            {isPasskeySupported()
              ? hasPasskey
                ? 'Enabled'
                : 'Not enabled'
              : 'Not supported in this browser'}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || !isPasskeySupported() || hasPasskey}
            onClick={() => void enablePasskey()}
            className="rounded-lg bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
            data-testid="btn-passkey-enable"
          >
            Enable
          </button>
          <button
            disabled={busy || !hasPasskey}
            onClick={() => void disablePasskey()}
            className="rounded-lg border border-border hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
            data-testid="btn-passkey-disable"
          >
            Remove
          </button>
        </div>
      </div>
      {passkeyMsg ? <div className="text-sm text-content-primary">{passkeyMsg}</div> : null}
    </div>
  );
}
