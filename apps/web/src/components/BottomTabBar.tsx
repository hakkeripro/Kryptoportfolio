import { NavLink } from 'react-router-dom';
import {
  Home,
  PieChart,
  ArrowLeftRight,
  FileText,
  Settings,
} from 'lucide-react';

const tabs = [
  { to: '/home', icon: Home, label: 'Home', testId: 'tab-home' },
  { to: '/portfolio', icon: PieChart, label: 'Portfolio', testId: 'tab-portfolio' },
  { to: '/transactions', icon: ArrowLeftRight, label: 'Txns', testId: 'tab-transactions' },
  { to: '/taxes', icon: FileText, label: 'Taxes', testId: 'tab-taxes' },
  { to: '/settings', icon: Settings, label: 'Settings', testId: 'tab-settings' },
] as const;

export default function BottomTabBar() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-surface-raised border-t border-border safe-area-bottom">
      <div className="flex items-center justify-around h-14">
        {tabs.map(({ to, icon: Icon, label, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-0.5 flex-1 h-full text-center transition-colors ${
                isActive
                  ? 'text-brand'
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
