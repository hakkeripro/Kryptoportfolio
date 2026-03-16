import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowLeftRight, FileText } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const uspKeys = [
  { icon: Shield, key: 'encryption' },
  { icon: ArrowLeftRight, key: 'import' },
  { icon: FileText, key: 'tax' },
] as const;

export default function WelcomePage() {
  const nav = useNavigate();
  const { t } = useTranslation();

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
      <div className="relative z-10 text-center mb-12 animate-fade-in">
        <div className="flex justify-center mb-6">
          <Logo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-heading-1 font-heading text-content-primary mb-2 text-3xl md:text-4xl font-bold">
          {t('welcome.title')}
        </h1>
        <p className="text-lg text-content-secondary max-w-md mx-auto">{t('welcome.tagline')}</p>
      </div>

      {/* USP Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
        {uspKeys.map(({ icon: Icon, key }, index) => (
          <div
            key={key}
            className="animate-slide-up"
            style={{ animationDelay: `${index * 100 + 200}ms` }}
          >
            <Card hover className="text-center p-6">
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
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div
        className="relative z-10 w-full max-w-sm space-y-3 animate-fade-in"
        style={{ animationDelay: '500ms' }}
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
      </div>

      {/* Footer */}
      <div
        className="relative z-10 mt-12 text-caption text-content-tertiary text-center animate-fade-in"
        style={{ animationDelay: '600ms' }}
      >
        {t('welcome.footer')}
      </div>
    </div>
  );
}
