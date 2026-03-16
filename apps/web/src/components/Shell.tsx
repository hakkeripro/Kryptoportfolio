import { NavLink } from 'react-router-dom';
import React from 'react';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';

const NavItem = ({ to, testId, label }: { to: string; testId: string; label: string }) => (
  <NavLink
    to={to}
    data-testid={testId}
    className={({ isActive }) =>
      `px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-surface-raised' : 'hover:bg-surface-base'}`
    }
  >
    {label}
  </NavLink>
);

export default function Shell({ children }: { children: React.ReactNode }) {
  const { passphrase, lockVault } = useVaultStore();
  const token = useAuthStore((s) => s.token);
  const syncNow = useSyncStore((s) => s.syncNow);
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 bg-surface-base/90 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-2 flex-wrap">
          <div className="font-semibold">Kryptoportfolio v3</div>
          <div className="flex gap-2 ml-auto flex-wrap items-center">
            {passphrase ? (
              <button
                data-testid="btn-lock"
                onClick={() => lockVault()}
                className="text-xs rounded-lg bg-surface-raised hover:bg-surface-overlay px-2 py-1"
              >
                Lock
              </button>
            ) : (
              <span
                data-testid="badge-locked"
                className="text-xs rounded bg-surface-raised px-2 py-1"
              >
                Locked
              </span>
            )}
            {token ? (
              <button
                data-testid="btn-sync-now"
                onClick={() => void syncNow()}
                className="text-xs rounded-lg bg-surface-raised hover:bg-surface-overlay px-2 py-1"
              >
                Sync
              </button>
            ) : null}
            <NavItem to="/dashboard" testId="nav-dashboard" label="Dashboard" />
            <NavItem to="/portfolio" testId="nav-portfolio" label="Portfolio" />
            <NavItem to="/transactions" testId="nav-transactions" label="Transactions" />
            <NavItem to="/strategy" testId="nav-strategy" label="Strategy" />
            <NavItem to="/alerts" testId="nav-alerts" label="Alerts" />
            <NavItem to="/imports" testId="nav-imports" label="Imports" />
            <NavItem to="/tax" testId="nav-tax" label="Tax" />
            <NavItem to="/assets" testId="nav-assets" label="Assets" />
            <NavItem to="/accounts" testId="nav-accounts" label="Accounts" />
            <NavItem to="/account" testId="nav-account" label="Account" />
            <NavItem to="/settings" testId="nav-settings" label="Settings" />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
