import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Home, PieChart, ArrowLeftRight, FileText, Settings } from 'lucide-react';

export default function BottomTabBar() {
  const { t } = useTranslation();
  const location = useLocation();

  const tabs = [
    { to: '/home', icon: Home, label: t('nav.home'), testId: 'tab-home' },
    { to: '/portfolio', icon: PieChart, label: t('nav.portfolio'), testId: 'tab-portfolio' },
    { to: '/transactions', icon: ArrowLeftRight, label: t('nav.txns'), testId: 'tab-transactions' },
    { to: '/taxes', icon: FileText, label: t('nav.taxes'), testId: 'tab-taxes' },
    { to: '/settings', icon: Settings, label: t('nav.settings'), testId: 'tab-settings' },
  ];

  const activeIndex = tabs.findIndex((tab) => location.pathname.startsWith(tab.to));

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-[#18181b] border-t border-white/10 safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ to, icon: Icon, label, testId }, index) => {
          const isActive = index === activeIndex;
          return (
            <NavLink
              key={to}
              to={to}
              data-testid={testId}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-center transition-colors duration-150"
            >
              {isActive && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-[#FF8400]"
                  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                />
              )}
              <Icon
                className={`h-5 w-5 transition-colors duration-150 ${
                  isActive ? 'text-[#FF8400]' : 'text-white/40'
                }`}
              />
              <span
                className={`text-[0.625rem] font-medium transition-colors duration-150 ${
                  isActive ? 'text-white' : 'text-white/40'
                }`}
              >
                {label}
              </span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}
