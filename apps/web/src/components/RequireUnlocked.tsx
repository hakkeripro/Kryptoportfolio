import { Navigate, useLocation } from 'react-router-dom';
import { useVaultStore } from '../store/useVaultStore';

/**
 * Guards routes that require an unlocked vault.
 *
 * - If no vault exists yet → welcome
 * - If vault exists but is locked → unlock
 */
export default function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const vaultReady = useVaultStore((s) => s.vaultReady);
  const vaultSetup = useVaultStore((s) => s.vaultSetup);
  const passphrase = useVaultStore((s) => s.passphrase);
  const location = useLocation();

  if (!vaultReady) return null;

  const next = `${location.pathname}${location.search}${location.hash}`;

  if (!vaultSetup) return <Navigate to={`/welcome?next=${encodeURIComponent(next)}`} replace />;
  if (!passphrase) return <Navigate to={`/vault/unlock?next=${encodeURIComponent(next)}`} replace />;

  return <>{children}</>;
}
