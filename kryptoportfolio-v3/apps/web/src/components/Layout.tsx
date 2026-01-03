import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAppStore } from '../store/useAppStore';

const NavItem = ({ to, label, testid }: { to: string; label: string; testid: string }) => (
  <NavLink
    to={to}
    data-testid={testid}
    className={({ isActive }) =>
      `px-3 py-2 rounded-md text-sm ${isActive ? 'bg-slate-800 text-white' : 'text-slate-300 hover:bg-slate-900'}`
    }
  >
    {label}
  </NavLink>
);

export default function Layout() {
  const { token, logout } = useAppStore();
  const loc = useLocation();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-slate-800">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">Kryptoportfolio v3</div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">{loc.pathname}</span>
            {token ? (
              <button
                onClick={logout}
                className="px-3 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-sm"
                data-testid="btn-logout"
              >
                Logout
              </button>
            ) : (
              <a className="text-sm" href="/onboarding" data-testid="nav-onboarding">
                Login
              </a>
            )}
          </div>
        </div>
        <nav className="mx-auto max-w-6xl px-4 pb-3 flex flex-wrap gap-2">
          <NavItem to="/dashboard" label="Dashboard" testid="nav-dashboard" />
          <NavItem to="/portfolio" label="Portfolio" testid="nav-portfolio" />
          <NavItem to="/transactions" label="Transactions" testid="nav-transactions" />
          <NavItem to="/strategy" label="Strategy" testid="nav-strategy" />
          <NavItem to="/alerts" label="Alerts" testid="nav-alerts" />
          <NavItem to="/assets" label="Assets" testid="nav-assets" />
          <NavItem to="/accounts" label="Accounts" testid="nav-accounts" />
          <NavItem to="/imports" label="Imports" testid="nav-imports" />
          <NavItem to="/tax" label="Tax" testid="nav-tax" />
          <NavItem to="/settings" label="Settings" testid="nav-settings" />
        </nav>
      </header>

      <main className="mx-auto max-w-6xl w-full px-4 py-6">
        <Outlet />
      </main>

      <footer className="border-t border-slate-800 py-4 text-center text-xs text-slate-500">
        Offline-first PWA. Background limitations apply on iOS.
      </footer>
    </div>
  );
}
