import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation();
  const [passkeyMsg, setPasskeyMsg] = useState('');
  const hasPasskey = !!getStoredPasskeyWrap();

  const enablePasskey = async () => {
    setPasskeyMsg('');
    const passphrase = useVaultStore.getState().passphrase;
    if (!passphrase) {
      setPasskeyMsg(t('settings.security.error.vaultLocked'));
      return;
    }
    setBusy(true);
    try {
      await createOrReplacePasskeyWrap(passphrase);
      setPasskeyMsg(t('settings.security.msg.enabled'));
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
      setPasskeyMsg(t('settings.security.msg.removed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="rounded-xl border border-border bg-surface-raised p-4 space-y-3"
      data-testid="card-security"
    >
      <div className="font-medium">{t('settings.security.title')}</div>
      <div className="text-sm text-content-secondary">
        {t('settings.security.description')}
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap rounded-lg border border-border bg-surface-base p-3">
        <div>
          <div className="text-sm font-medium">{t('settings.security.passkeyLabel')}</div>
          <div className="text-xs text-content-secondary">
            {isPasskeySupported()
              ? hasPasskey
                ? t('settings.security.passkeyEnabled')
                : t('settings.security.passkeyNotEnabled')
              : t('settings.security.passkeyNotSupported')}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            disabled={busy || !isPasskeySupported() || hasPasskey}
            onClick={() => void enablePasskey()}
            className="rounded-lg bg-surface-raised hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
            data-testid="btn-passkey-enable"
          >
            {t('settings.security.btn.enable')}
          </button>
          <button
            disabled={busy || !hasPasskey}
            onClick={() => void disablePasskey()}
            className="rounded-lg border border-border hover:bg-surface-overlay disabled:opacity-60 px-3 py-2 text-sm"
            data-testid="btn-passkey-disable"
          >
            {t('settings.security.btn.remove')}
          </button>
        </div>
      </div>
      {passkeyMsg ? <div className="text-sm text-content-primary">{passkeyMsg}</div> : null}
    </div>
  );
}
