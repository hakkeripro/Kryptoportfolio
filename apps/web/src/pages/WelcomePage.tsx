import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';

export default function WelcomePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const vaultReady = useVaultStore((s) => s.vaultReady);
  const passphrase = useVaultStore((s) => s.passphrase);

  // Authenticated users should not see the welcome page
  if (token && vaultReady) {
    if (!passphrase) return <Navigate to="/vault/unlock" replace />;
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      data-testid="page-welcome"
      className="min-h-screen flex flex-col items-center justify-center px-page relative overflow-hidden noise-overlay"
    >
      {/* Ambient orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--color-brand) 0%, transparent 70%)' }}
      />

      <motion.div
        className="relative z-10 flex flex-col items-center gap-10 w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <Logo size="lg" showWordmark={false} />

        {/* CTAs */}
        <div className="w-full space-y-3">
          <Button
            data-testid="btn-signup"
            onClick={() => nav('/auth/signup')}
            size="lg"
            className="w-full"
          >
            {t('welcome.cta.signup')}
          </Button>
          <Button
            data-testid="btn-signin"
            onClick={() => nav('/auth/signin')}
            variant="secondary"
            size="lg"
            className="w-full"
          >
            {t('welcome.cta.signin')}
          </Button>
          <button
            data-testid="btn-offline"
            onClick={() => nav('/vault/setup?offline=1')}
            className="w-full text-caption text-content-tertiary hover:text-content-secondary py-2
              transition-all duration-200 ease-expo"
          >
            {t('welcome.cta.offline')}
          </button>
        </div>

        {/* Footer */}
        <p className="text-caption text-content-tertiary text-center">{t('welcome.footer')}</p>
      </motion.div>
    </div>
  );
}
