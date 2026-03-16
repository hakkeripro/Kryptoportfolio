import { NavLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Home, PieChart, ArrowLeftRight, FileText, Settings } from 'lucide-react';

export default function BottomTabBar() {
  const { t } = useTranslation();

  const tabs = [
    { to: '/home', icon: Home, label: t('nav.home'), testId: 'tab-home' },
    { to: '/portfolio', icon: PieChart, label: t('nav.portfolio'), testId: 'tab-portfolio' },
    { to: '/transactions', icon: ArrowLeftRight, label: t('nav.txns'), testId: 'tab-transactions' },
    { to: '/taxes', icon: FileText, label: t('nav.taxes'), testId: 'tab-taxes' },
    { to: '/settings', icon: Settings, label: t('nav.settings'), testId: 'tab-settings' },
  ];

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-surface-raised/80 backdrop-blur-md border-t border-border/50 safe-area-bottom
      before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-border before:to-transparent"
    >
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ to, icon: Icon, label, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={({ isActive }) =>
              `relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-center
              transition-all duration-150 ease-expo ${
                isActive
                  ? 'text-brand scale-105 after:absolute after:bottom-1 after:left-1/2 after:-translate-x-1/2 after:w-1 after:h-1 after:rounded-full after:bg-brand'
                  : 'text-content-tertiary'
              }`
            }
          >
            <Icon className="h-5 w-5" />
            <span className="text-[0.625rem] font-medium">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
