import { Navigate, useLocation } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/useAppStore';

export default function RequireUnlocked({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const { vaultReady, vaultSetup, passphrase, syncNow } = useAppStore();
  const did = useRef(false);

  useEffect(() => {
    // Best-effort: pull latest remote state once after unlock.
    // If user is not logged in, syncNow is a no-op.
    if (!did.current && vaultReady && vaultSetup && passphrase) {
      did.current = true;
      syncNow().catch(() => {
        // ignore; user can trigger manual sync from UI
      });
    }
  }, [vaultReady, vaultSetup, passphrase, syncNow]);

  if (!vaultReady) {
    return (
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 text-sm text-slate-200">
        Loading…
      </div>
    );
  }

  if (!vaultSetup || !passphrase) {
    return <Navigate to="/onboarding" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}
