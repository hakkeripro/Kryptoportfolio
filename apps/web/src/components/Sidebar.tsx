import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  PieChart,
  ArrowLeftRight,
  FileText,
  Settings,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { Logo } from './ui';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';

export default function Sidebar() {
  const { t } = useTranslation();
  const { passphrase, lockVault } = useVaultStore();
  const token = useAuthStore((s) => s.token);
  const syncNow = useSyncStore((s) => s.syncNow);

  const navItems = [
    { to: '/home', icon: Home, label: t('nav.home'), testId: 'nav-home' },
    { to: '/portfolio', icon: PieChart, label: t('nav.portfolio'), testId: 'nav-portfolio' },
    {
      to: '/transactions',
      icon: ArrowLeftRight,
      label: t('nav.transactions'),
      testId: 'nav-transactions',
    },
    { to: '/taxes', icon: FileText, label: t('nav.taxes'), testId: 'nav-taxes' },
    { to: '/settings', icon: Settings, label: t('nav.settings'), testId: 'nav-settings' },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-surface-raised/80 backdrop-blur-md border-r border-border">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-border/50 bg-gradient-brand-subtle">
        <Logo size="sm" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map(({ to, icon: Icon, label, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={({ isActive }) =>
              `relative flex items-center gap-3 px-3 py-2.5 rounded-button text-body font-medium
              transition-all duration-150 ease-expo ${
                isActive
                  ? 'bg-brand/8 text-brand shadow-sm shadow-brand/5 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-brand'
                  : 'text-content-secondary hover:text-content-primary hover:bg-surface-overlay/60'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Footer actions */}
      <div className="px-3 py-4 border-t border-border/50 space-y-2">
        {token && (
          <button
            data-testid="btn-sync-now"
            onClick={() => void syncNow()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-button text-caption
              text-content-secondary hover:text-content-primary hover:bg-surface-overlay/60
              transition-all duration-150 ease-expo"
          >
            <RefreshCw className="h-4 w-4" />
            {t('nav.sync')}
          </button>
        )}
        {passphrase ? (
          <button
            data-testid="btn-lock"
            onClick={() => lockVault()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-button text-caption
              text-content-secondary hover:text-content-primary hover:bg-surface-overlay/60
              transition-all duration-150 ease-expo"
          >
            <Lock className="h-4 w-4" />
            {t('nav.lockVault')}
          </button>
        ) : (
          <span
            data-testid="badge-locked"
            className="flex items-center gap-2 px-3 py-2 text-caption text-content-tertiary"
          >
            <Unlock className="h-4 w-4" />
            {t('nav.locked')}
          </span>
        )}
      </div>
    </aside>
  );
}
