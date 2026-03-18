import { useState, useEffect } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
  Shield,
  Menu,
  Circle,
} from 'lucide-react';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from './ui/sheet';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { useSyncStore } from '../store/useSyncStore';
import { useAlertBadgeCount } from '../hooks/useAlertBadgeCount';

interface NavSection {
  label: string;
  items: { to: string; icon: typeof Home; label: string; testId: string; badge?: number }[];
}

function NavItem({
  to,
  icon: Icon,
  label,
  testId,
  badge,
}: NavSection['items'][number]) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <NavLink to={to} data-testid={testId}>
      <motion.div
        whileHover={{ scale: 1.02 }}
        transition={{ duration: 0.15 }}
        className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium
          transition-colors duration-150 ${
            isActive
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:bg-white/5 hover:text-white/80'
          }`}
      >
        <Icon className={`h-[18px] w-[18px] ${isActive ? 'text-[#FF8400]' : ''}`} />
        {label}
        {badge != null && badge > 0 && (
          <span
            data-testid="badge-alert-count"
            className="ml-auto flex items-center justify-center h-4 min-w-4 px-1 rounded-full
              bg-[#FF8400] text-black text-[9px] font-bold font-mono tabular-nums"
          >
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </motion.div>
    </NavLink>
  );
}

function formatRelativeTime(isoString: string): string {
  const now = Date.now();
  const ts = new Date(isoString).getTime();
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 60) return 'just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} min ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  return new Date(isoString).toLocaleDateString();
}

function SyncStatus() {
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const lastSyncAtISO = useSyncStore((s) => s.lastSyncAtISO);
  const lastSyncError = useSyncStore((s) => s.lastSyncError);
  const syncNow = useSyncStore((s) => s.syncNow);
  // Force re-render every 30s so relative time stays fresh
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!token) return null;

  if (lastSyncError) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-xs text-red-400">
        <Circle className="h-2.5 w-2.5 fill-red-500 text-red-500 shrink-0" />
        <span className="flex-1 truncate">
          {t('nav.syncFailed', { defaultValue: 'Sync failed' })}
        </span>
        <button
          data-testid="btn-sync-retry"
          onClick={() => void syncNow()}
          className="shrink-0 text-white/50 hover:text-white transition-colors"
          title="Retry sync"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div
      data-testid="sync-status"
      className="flex items-center gap-2 px-3 py-2 text-xs text-white/30"
    >
      <Circle className="h-2 w-2 fill-white/20 text-white/20 shrink-0" />
      <span className="truncate">
        {lastSyncAtISO
          ? `Vault backed up · ${formatRelativeTime(lastSyncAtISO)}`
          : t('nav.syncNeverSynced', { defaultValue: 'Not synced yet' })}
      </span>
    </div>
  );
}

function SidebarContent() {
  const { t } = useTranslation();
  const { passphrase, lockVault } = useVaultStore();
  const email = useAuthStore((s) => s.email);
  const alertBadge = useAlertBadgeCount();

  const sections: NavSection[] = [
    {
      label: t('nav.section.portfolio', { defaultValue: 'PORTFOLIO' }),
      items: [
        {
          to: '/home',
          icon: Home,
          label: t('nav.dashboard', { defaultValue: 'Dashboard' }),
          testId: 'nav-home',
        },
        {
          to: '/transactions',
          icon: ArrowLeftRight,
          label: t('nav.transactions'),
          testId: 'nav-transactions',
        },
        {
          to: '/taxes',
          icon: FileText,
          label: t('nav.taxReports', { defaultValue: 'Tax Reports' }),
          testId: 'nav-taxes',
        },
      ],
    },
    {
      label: t('nav.section.tools', { defaultValue: 'TOOLS' }),
      items: [
        {
          to: '/settings/alerts',
          icon: Bell,
          label: t('nav.alerts', { defaultValue: 'Alerts' }),
          testId: 'nav-alerts',
          badge: alertBadge,
        },
        {
          to: '/transactions/import',
          icon: Upload,
          label: t('nav.import', { defaultValue: 'Import' }),
          testId: 'nav-import',
        },
        { to: '/settings', icon: Settings, label: t('nav.settings'), testId: 'nav-settings' },
      ],
    },
  ];

  return (
    <>
      {/* Brand */}
      <div className="px-5 py-4 border-b border-white/10">
        <span className="inline-flex items-center gap-2">
          <Shield className="h-6 w-6 text-[#FF8400]" />
          <span className="font-semibold tracking-tight text-white text-sm">VaultFolio</span>
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
        {sections.map((section) => (
          <div key={section.label}>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-4 pt-4 pb-1">
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
      <div className="px-0 py-4 border-t border-white/10 space-y-0.5">
        <SyncStatus />
        {passphrase ? (
          <button
            data-testid="btn-lock"
            onClick={() => lockVault()}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-md text-xs
              text-white/60 hover:text-white hover:bg-white/5
              transition-colors duration-150"
          >
            <Lock className="h-4 w-4" />
            {t('nav.lockVault')}
          </button>
        ) : (
          <span
            data-testid="badge-locked"
            className="flex items-center gap-2 px-3 py-2 text-xs text-white/40"
          >
            <Unlock className="h-4 w-4" />
            {t('nav.locked')}
          </span>
        )}
        {email && (
          <div className="px-3 pt-2">
            <div className="text-sm text-white truncate">{email.split('@')[0]}</div>
            <div className="text-xs text-white/40 truncate">{email}</div>
          </div>
        )}
      </div>
    </>
  );
}

export default function Sidebar() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 h-screen fixed left-0 top-0 bg-[#18181b] border-r border-white/10">
        <SidebarContent />
      </aside>

      {/* Mobile hamburger + Sheet */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-20 flex items-center h-14 px-4 bg-[#18181b] border-b border-white/10">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              data-testid="btn-mobile-menu"
              className="p-2 rounded-md text-white/60 hover:text-white hover:bg-white/5 transition-colors"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="w-60 p-0 bg-[#18181b] border-r border-white/10">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="flex flex-col h-full" onClick={() => setOpen(false)}>
              <SidebarContent />
            </div>
          </SheetContent>
        </Sheet>
        <span className="ml-3 inline-flex items-center gap-2">
          <Shield className="h-5 w-5 text-[#FF8400]" />
          <span className="font-semibold text-white text-sm tracking-tight">VaultFolio</span>
        </span>
      </div>
    </>
  );
}
