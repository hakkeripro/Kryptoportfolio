import { Route, Routes, Navigate } from 'react-router-dom';
import { lazy, Suspense, useEffect } from 'react';
import AppShell from '../components/AppShell';
import RequireUnlocked from '../components/RequireUnlocked';
import { useVaultStore } from '../store/useVaultStore';
import IntegrationAutoSync from '../components/IntegrationAutoSync';
import DerivedBootstrap from '../components/DerivedBootstrap';
import PriceAutoRefresh from '../components/PriceAutoRefresh';
import ErrorBoundary from '../components/ErrorBoundary';
import { Spinner } from '../components/ui';

const WelcomePage = lazy(() => import('../pages/WelcomePage'));
const SignupPage = lazy(() => import('../pages/SignupPage'));
const SigninPage = lazy(() => import('../pages/SigninPage'));
const VaultSetupPage = lazy(() => import('../pages/VaultSetupPage'));
const UnlockPage = lazy(() => import('../pages/UnlockPage'));
const DashboardPage = lazy(() => import('../pages/DashboardPage'));
const PortfolioPage = lazy(() => import('../pages/PortfolioPage'));
const TransactionsPage = lazy(() => import('../pages/TransactionsPage'));
const AlertsPage = lazy(() => import('../pages/AlertsPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const AssetsPage = lazy(() => import('../pages/AssetsPage'));
const AccountsPage = lazy(() => import('../pages/AccountsPage'));
const AccountPage = lazy(() => import('../pages/AccountPage'));
const ImportsPage = lazy(() => import('../pages/ImportsPage'));
const TaxPage = lazy(() => import('../pages/TaxPage'));

function PageFallback() {
  return (
    <div className="flex items-center justify-center py-16">
      <Spinner size="lg" />
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  return <RequireUnlocked>{children}</RequireUnlocked>;
}

export default function App() {
  const loadVaultStatus = useVaultStore((s) => s.loadVaultStatus);
  useEffect(() => {
    void loadVaultStatus();
  }, [loadVaultStatus]);

  return (
    <AppShell>
      <IntegrationAutoSync />
      <DerivedBootstrap />
      <PriceAutoRefresh />
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/home" replace />} />

            {/* Auth routes (no shell needed but AppShell hides sidebar for unauthenticated) */}
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/auth/signin" element={<SigninPage />} />
            <Route path="/vault/setup" element={<VaultSetupPage />} />
            <Route path="/vault/unlock" element={<UnlockPage />} />

            {/* 5 main views */}
            <Route
              path="/home"
              element={
                <ProtectedRoute>
                  <DashboardPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/portfolio"
              element={
                <ProtectedRoute>
                  <PortfolioPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions"
              element={
                <ProtectedRoute>
                  <TransactionsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/transactions/import"
              element={
                <ProtectedRoute>
                  <ImportsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/taxes"
              element={
                <ProtectedRoute>
                  <TaxPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings"
              element={
                <ProtectedRoute>
                  <SettingsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/alerts"
              element={
                <ProtectedRoute>
                  <AlertsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/assets"
              element={
                <ProtectedRoute>
                  <AssetsPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/settings/account"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

            {/* Backward compat redirects */}
            <Route path="/dashboard" element={<Navigate to="/home" replace />} />
            <Route path="/imports" element={<Navigate to="/transactions/import" replace />} />
            <Route path="/alerts" element={<Navigate to="/settings/alerts" replace />} />
            <Route path="/assets" element={<Navigate to="/settings/assets" replace />} />
            <Route path="/account" element={<Navigate to="/settings/account" replace />} />
            <Route path="/accounts" element={<Navigate to="/settings" replace />} />
            <Route path="/tax" element={<Navigate to="/taxes" replace />} />
            <Route path="/strategy" element={<Navigate to="/home" replace />} />
            <Route path="/onboarding" element={<Navigate to="/welcome" replace />} />
            <Route path="/unlock" element={<Navigate to="/vault/unlock" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </AppShell>
  );
}
