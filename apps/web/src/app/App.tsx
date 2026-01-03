import { Route, Routes, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import Shell from '../components/Shell';
import RequireUnlocked from '../components/RequireUnlocked';
import { useAppStore } from '../store/useAppStore';
import OnboardingPage from '../pages/OnboardingPage';
import DashboardPage from '../pages/DashboardPage';
import PortfolioPage from '../pages/PortfolioPage';
import TransactionsPage from '../pages/TransactionsPage';
import AlertsPage from '../pages/AlertsPage';
import StrategyPage from '../pages/StrategyPage';
import SettingsPage from '../pages/SettingsPage';
import AssetsPage from '../pages/AssetsPage';
import AccountsPage from '../pages/AccountsPage';
import ImportsPage from '../pages/ImportsPage';
import TaxPage from '../pages/TaxPage';
import IntegrationAutoSync from '../components/IntegrationAutoSync';
import DerivedBootstrap from '../components/DerivedBootstrap';
import ErrorBoundary from '../components/ErrorBoundary';

export default function App() {
  const loadVaultStatus = useAppStore((s) => s.loadVaultStatus);
  useEffect(() => {
    void loadVaultStatus();
  }, [loadVaultStatus]);

  return (
    <Shell>
      <IntegrationAutoSync />
      <DerivedBootstrap />
      <ErrorBoundary>
        <Routes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/onboarding" element={<OnboardingPage />} />
        <Route path="/dashboard" element={<RequireUnlocked><DashboardPage /></RequireUnlocked>} />
        <Route path="/portfolio" element={<RequireUnlocked><PortfolioPage /></RequireUnlocked>} />
        <Route path="/transactions" element={<RequireUnlocked><TransactionsPage /></RequireUnlocked>} />
        <Route path="/strategy" element={<RequireUnlocked><StrategyPage /></RequireUnlocked>} />
        <Route path="/alerts" element={<RequireUnlocked><AlertsPage /></RequireUnlocked>} />
        <Route path="/assets" element={<RequireUnlocked><AssetsPage /></RequireUnlocked>} />
        <Route path="/accounts" element={<RequireUnlocked><AccountsPage /></RequireUnlocked>} />
        <Route path="/imports" element={<RequireUnlocked><ImportsPage /></RequireUnlocked>} />
        <Route path="/tax" element={<RequireUnlocked><TaxPage /></RequireUnlocked>} />
        <Route path="/settings" element={<RequireUnlocked><SettingsPage /></RequireUnlocked>} />
        </Routes>
      </ErrorBoundary>
    </Shell>
  );
}
