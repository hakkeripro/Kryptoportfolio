import { useNavigate, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeftRight, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { staggerContainer, fadeInUp } from '../lib/animations';
import { useAuthStore } from '../store/useAuthStore';
import { useVaultStore } from '../store/useVaultStore';

const uspKeys = [
  { icon: Shield, key: 'encryption' },
  { icon: ArrowLeftRight, key: 'import' },
  { icon: FileText, key: 'tax' },
] as const;

export default function WelcomePage() {
  const nav = useNavigate();
  const { t } = useTranslation();
  const token = useAuthStore((s) => s.token);
  const vaultReady = useVaultStore((s) => s.vaultReady);
  const vaultSetup = useVaultStore((s) => s.vaultSetup);
  const passphrase = useVaultStore((s) => s.passphrase);

  // Authenticated users should not see the welcome/marketing page
  if (vaultReady && token) {
    if (!vaultSetup) return <Navigate to="/vault/setup?ondevice=1" replace />;
    if (!passphrase) return <Navigate to="/vault/unlock" replace />;
    return <Navigate to="/home" replace />;
  }

  return (
    <div
      data-testid="page-welcome"
      className="min-h-screen flex flex-col items-center justify-center px-page relative overflow-hidden noise-overlay"
    >
      {/* Primary gradient orb */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[500px] rounded-full opacity-25 blur-3xl pointer-events-none animate-float"
        style={{
          background: 'radial-gradient(circle, var(--color-brand) 0%, transparent 70%)',
          animationDuration: '10s',
        }}
      />
      {/* Secondary orb */}
      <div
        className="absolute bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-[0.06] blur-3xl pointer-events-none animate-float"
        style={{
          background: 'radial-gradient(circle, #3b82f6 0%, transparent 70%)',
          animationDelay: '-4s',
          animationDuration: '12s',
        }}
      />

      {/* Logo + Hero */}
      <motion.div
        className="relative z-10 text-center mb-12"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex justify-center mb-6">
          <Logo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-heading-1 font-heading text-content-primary mb-2 text-3xl md:text-4xl font-bold">
          {t('welcome.title')}
        </h1>
        <p className="text-lg text-content-secondary max-w-md mx-auto">{t('welcome.tagline')}</p>
      </motion.div>

      {/* USP Cards */}
      <motion.div
        className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-10"
        variants={staggerContainer}
        initial="hidden"
        animate="show"
      >
        {uspKeys.map(({ icon: Icon, key }) => (
          <motion.div key={key} variants={fadeInUp}>
            <Card className="text-center p-6 hover:border-brand/30 hover:bg-surface-overlay/50 transition-colors cursor-default">
              <div className="flex justify-center mb-3">
                <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                  <Icon className="h-5 w-5 text-brand" />
                </div>
              </div>
              <h3 className="text-body font-semibold text-content-primary mb-1">
                {t(`welcome.usp.${key}.title`)}
              </h3>
              <p className="text-caption text-content-secondary">{t(`welcome.usp.${key}.desc`)}</p>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      {/* CTAs */}
      <motion.div
        className="relative z-10 w-full max-w-sm space-y-3"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.5 }}
      >
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
      </motion.div>

      {/* Footer */}
      <motion.div
        className="relative z-10 mt-12 text-caption text-content-tertiary text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.7 }}
      >
        {t('welcome.footer')}
      </motion.div>
    </div>
  );
}
