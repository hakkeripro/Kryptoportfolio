import { Navigate, useLocation } from 'react-router-dom';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';

/**
 * Guards routes that require an unlocked vault.
 *
 * - Authenticated + no local vault → vault/setup?ondevice=1 (set up on this device)
 * - No auth + no vault → welcome
 * - Vault locked → vault/unlock
 */
export default function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const vaultReady = useVaultStore((s) => s.vaultReady);
  const vaultSetup = useVaultStore((s) => s.vaultSetup);
  const passphrase = useVaultStore((s) => s.passphrase);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  if (!vaultReady) return null;

  const next = `${location.pathname}${location.search}${location.hash}`;

  if (!vaultSetup) {
    if (token) {
      return <Navigate to={`/vault/setup?ondevice=1&next=${encodeURIComponent(next)}`} replace />;
    }
    return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  }

  if (!passphrase)
    return <Navigate to={`/vault/unlock?next=${encodeURIComponent(next)}`} replace />;

  return <>{children}</>;
}
