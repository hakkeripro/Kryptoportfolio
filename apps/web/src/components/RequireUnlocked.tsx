import { Navigate, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

/**
 * Guards routes that require an unlocked vault.
 *
 * - If no vault exists yet → onboarding
 * - If vault exists but is locked → unlock
 */
export default function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const vaultReady = useAppStore((s) => s.vaultReady);
  const vaultSetup = useAppStore((s) => s.vaultSetup);
  const passphrase = useAppStore((s) => s.passphrase);
  const location = useLocation();

  if (!vaultReady) return null;

  const next = `${location.pathname}${location.search}${location.hash}`;

  if (!vaultSetup) return <Navigate to={`/onboarding?next=${encodeURIComponent(next)}`} replace />;
  if (!passphrase) return <Navigate to={`/unlock?next=${encodeURIComponent(next)}`} replace />;

  return <>{children}</>;
}
