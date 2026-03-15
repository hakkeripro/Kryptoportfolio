import { useNavigate } from 'react-router-dom';
import { Shield, ArrowLeftRight, FileText } from 'lucide-react';
import { Logo } from '../components/ui/Logo';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';

const usps = [
  {
    icon: Shield,
    title: 'Zero-Knowledge Encryption',
    desc: 'Your data is encrypted before it leaves your device. We can never see it.',
  },
  {
    icon: ArrowLeftRight,
    title: 'Multi-Exchange Import',
    desc: 'Connect Coinbase and more exchanges with one click.',
  },
  {
    icon: FileText,
    title: 'Tax Reports',
    desc: 'Generate capital gains reports ready for tax filing.',
  },
] as const;

export default function WelcomePage() {
  const nav = useNavigate();

  return (
    <div
      data-testid="page-welcome"
      className="min-h-screen flex flex-col items-center justify-center px-page relative overflow-hidden"
    >
      {/* Gradient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] rounded-full opacity-20 blur-3xl pointer-events-none"
        style={{ background: 'radial-gradient(circle, var(--color-brand) 0%, transparent 70%)' }}
      />

      {/* Logo + Hero */}
      <div className="relative z-10 text-center mb-12">
        <div className="flex justify-center mb-6">
          <Logo size="lg" showWordmark={false} />
        </div>
        <h1 className="text-heading-1 text-content-primary mb-2 text-3xl md:text-4xl font-bold">
          VaultFolio
        </h1>
        <p className="text-lg text-content-secondary max-w-md mx-auto">
          The only crypto tracker that never sees your data.
        </p>
      </div>

      {/* USP Cards */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl w-full mb-10">
        {usps.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="text-center p-6">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-10 rounded-full bg-brand/10 flex items-center justify-center">
                <Icon className="h-5 w-5 text-brand" />
              </div>
            </div>
            <h3 className="text-body font-semibold text-content-primary mb-1">{title}</h3>
            <p className="text-caption text-content-secondary">{desc}</p>
          </Card>
        ))}
      </div>

      {/* CTAs */}
      <div className="relative z-10 w-full max-w-sm space-y-3">
        <Button
          data-testid="btn-signup"
          onClick={() => nav('/auth/signup')}
          size="lg"
          className="w-full"
        >
          Get Started Free
        </Button>
        <Button
          data-testid="btn-signin"
          onClick={() => nav('/auth/signin')}
          variant="secondary"
          size="lg"
          className="w-full"
        >
          Sign In
        </Button>
        <button
          data-testid="btn-offline"
          onClick={() => nav('/vault/setup?offline=1')}
          className="w-full text-caption text-content-tertiary hover:text-content-secondary py-2 transition-colors"
        >
          Use without account
        </button>
      </div>

      {/* Footer */}
      <div className="relative z-10 mt-12 text-caption text-content-tertiary text-center">
        Your data never leaves your device unencrypted.
      </div>
    </div>
  );
}
