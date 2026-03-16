import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  ArrowLeftRight,
  FileText,
  Bell,
  Upload,
  Settings,
  Lock,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import { Logo } from './ui';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';

interface NavSection {
  label: string;
  items: { to: string; icon: typeof Home; label: string; testId: string }[];
}

function NavItem({ to, icon: Icon, label, testId }: NavSection['items'][number]) {
  return (
    <NavLink
      to={to}
      data-testid={testId}
      className={({ isActive }) =>
        `relative flex items-center gap-3 px-3 py-2 rounded-button text-body font-medium
        transition-all duration-150 ease-expo ${
          isActive
            ? 'bg-brand/10 text-brand shadow-sm shadow-brand/5 before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:rounded-full before:bg-brand'
            : 'text-content-secondary hover:text-content-primary hover:bg-surface-overlay/60'
        }`
      }
    >
      <Icon className="h-[18px] w-[18px]" />
      {label}
    </NavLink>
  );
}

export default function Sidebar() {
  const { t } = useTranslation();
  const { passphrase, lockVault } = useVaultStore();
  const token = useAuthStore((s) => s.token);
  const email = useAuthStore((s) => s.email);
  const syncNow = useSyncStore((s) => s.syncNow);

  const sections: NavSection[] = [
    {
      label: t('nav.section.portfolio', { defaultValue: 'PORTFOLIO' }),
      items: [
        { to: '/home', icon: Home, label: t('nav.dashboard', { defaultValue: 'Dashboard' }), testId: 'nav-home' },
        { to: '/transactions', icon: ArrowLeftRight, label: t('nav.transactions'), testId: 'nav-transactions' },
        { to: '/taxes', icon: FileText, label: t('nav.taxReports', { defaultValue: 'Tax Reports' }), testId: 'nav-taxes' },
      ],
    },
    {
      label: t('nav.section.tools', { defaultValue: 'TOOLS' }),
      items: [
        { to: '/settings/alerts', icon: Bell, label: t('nav.alerts', { defaultValue: 'Alerts' }), testId: 'nav-alerts' },
        { to: '/transactions/import', icon: Upload, label: t('nav.import', { defaultValue: 'Import' }), testId: 'nav-import' },
        { to: '/settings', icon: Settings, label: t('nav.settings'), testId: 'nav-settings' },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-[var(--color-sidebar)] border-r border-[var(--color-sidebar-border)]">
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        <Logo size="sm" />
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="px-3 mb-2 text-[0.625rem] font-semibold uppercase tracking-widest text-content-tertiary">
              {section.label}
            </div>
            <div className="space-y-0.5">
              {section.items.map((item) => (
                <NavItem key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-4 border-t border-white/10 space-y-2">
        {token && (
          <button
            data-testid="btn-sync-now"
            onClick={() => void syncNow()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-button text-caption
              text-content-secondary hover:text-content-primary hover:bg-white/5
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
              text-content-secondary hover:text-content-primary hover:bg-white/5
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
        {email && (
          <div className="px-3 pt-2">
            <div className="text-sm text-content-primary truncate">{email.split('@')[0]}</div>
            <div className="text-xs text-content-tertiary truncate">{email}</div>
          </div>
        )}
      </div>
    </aside>
  );
}
