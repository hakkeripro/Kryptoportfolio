import { Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import Shell from '../components/Shell';
import RequireUnlocked from '../components/RequireUnlocked';
import { useVaultStore } from '../store/useVaultStore';
import IntegrationAutoSync from '../components/IntegrationAutoSync';
import DerivedBootstrap from '../components/DerivedBootstrap';
import PriceAutoRefresh from '../components/PriceAutoRefresh';
import ErrorBoundary from '../components/ErrorBoundary';

const WelcomePage = lazy(() => import('../pages/WelcomePage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const SigninPage = lazy(() => import('../pages/SigninPage'));
const VaultSetupPage = lazy(() => import('../pages/VaultSetupPage'));
const AccountPage = lazy(() => import('../pages/AccountPage'));
const UnlockPage = lazy(() => import('../pages/UnlockPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const PortfolioPage = lazy(() => import('../pages/PortfolioPage'));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const StrategyPage = lazy(() => import('../pages/StrategyPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AssetsPage = lazy(() => import('../pages/AssetsPage'));
const AccountsPage = lazy(() => import('../pages/AccountsPage'));
const ImportsPage = lazy(() => import('../pages/ImportsPage'));
const TaxPage = lazy(() => import('../pages/TaxPage'));

function PageFallback() {
  return <div className="p-4 text-sm text-slate-400">Loading…</div>;
}

export default function App() {
  const loadVaultStatus = useVaultStore((s) => s.loadVaultStatus);
  useEffect(() => {
    void loadVaultStatus();
  }, [loadVaultStatus]);

  return (
    <Shell>
      <IntegrationAutoSync />
      <DerivedBootstrap />
      <PriceAutoRefresh />
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/auth/signin" element={<SigninPage />} />
            <Route path="/vault/setup" element={<VaultSetupPage />} />
            <Route path="/vault/unlock" element={<UnlockPage />} />
            {/* Backward compat: old routes redirect to new */}
            <Route path="/onboarding" element={<Navigate to="/welcome" replace />} />
            <Route path="/unlock" element={<Navigate to="/vault/unlock" replace />} />
            <Route
              path="/account"
              element={
                <RequireUnlocked>
                  <AccountPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/dashboard"
              element={
                <RequireUnlocked>
                  <DashboardPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/portfolio"
              element={
                <RequireUnlocked>
                  <PortfolioPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/transactions"
              element={
                <RequireUnlocked>
                  <TransactionsPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/strategy"
              element={
                <RequireUnlocked>
                  <StrategyPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/alerts"
              element={
                <RequireUnlocked>
                  <AlertsPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/assets"
              element={
                <RequireUnlocked>
                  <AssetsPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/accounts"
              element={
                <RequireUnlocked>
                  <AccountsPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/imports"
              element={
                <RequireUnlocked>
                  <ImportsPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/tax"
              element={
                <RequireUnlocked>
                  <TaxPage />
                </RequireUnlocked>
              }
            />
            <Route
              path="/settings"
              element={
                <RequireUnlocked>
                  <SettingsPage />
                </RequireUnlocked>
              }
            />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Shell>
  );
}
