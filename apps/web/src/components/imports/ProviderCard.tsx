import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImportContext, ImportPlugin } from '../../integrations/importPlugin';
import type { ProviderDescriptor } from '@kp/core';

// Simple SVG logos for providers
function CoinbaseLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className="text-blue-500">
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
      <path
        d="M14.5 8.5a4.5 4.5 0 1 0 0 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function GenericLogo({ name }: { name: string }) {
  return (
    <div className="w-8 h-8 rounded-full bg-surface-overlay flex items-center justify-center text-caption font-mono text-content-tertiary">
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

function ProviderLogo({ id, name }: { id: string; name: string }) {
  if (id === 'coinbase') return <CoinbaseLogo />;
  return <GenericLogo name={name} />;
}

interface ProviderCardProps {
  plugin: ImportPlugin;
  ctx: ImportContext;
  isConnected: boolean;
  onConnected: () => void;
  onDisconnect: () => void;
}

export function ProviderCard({
  plugin,
  ctx,
  isConnected,
  onConnected,
  onDisconnect,
}: ProviderCardProps) {
  const { t } = useTranslation();
  const { descriptor } = plugin;

  async function handleDisconnect() {
    await plugin.disconnect();
    onDisconnect();
  }

  return (
    <div
      className={`rounded-xl border-2 p-5 transition-all duration-200 ${
        isConnected
          ? 'border-[#FF8400]/50 bg-[#FF8400]/[0.04] shadow-[0_0_20px_rgba(255,132,0,0.08)]'
          : 'border-white/[0.08] bg-[#0F0F0F] hover:border-[#FF8400]/30 hover:bg-[#FF8400]/[0.02]'
      }`}
      data-testid={`card-import-${descriptor.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProviderLogo id={descriptor.id} name={descriptor.name} />
          <div>
            <div className="text-body font-medium text-content-primary">{descriptor.name}</div>
            <div className="text-caption text-content-tertiary">
              {descriptor.category === 'exchange' ? 'Cryptocurrency Exchange' : descriptor.category}
              {' · '}
              {descriptor.authMethods[0] === 'api-key' ? 'API Key' : descriptor.authMethods[0]}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="w-6 h-6 rounded-full bg-semantic-success flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          {isConnected && (
            <button
              className="rounded-button border border-border px-3 py-1.5 text-caption text-content-secondary hover:bg-surface-overlay transition-colors"
              onClick={() => void handleDisconnect()}
              data-testid="btn-coinbase-disconnect"
            >
              {t('imports.btn.disconnect')}
            </button>
          )}
        </div>
      </div>

      {/* Connect form (when not connected) */}
      {!isConnected && <plugin.ConnectForm ctx={ctx} onConnected={onConnected} />}

      {/* Connected badge */}
      {isConnected && (
        <div
          className="mt-3 rounded-button bg-semantic-success/10 px-3 py-2 text-caption text-semantic-success font-medium"
          data-testid="badge-coinbase-connected"
        >
          {t('imports.badge.connected')}
        </div>
      )}
    </div>
  );
}

interface ComingSoonCardProps {
  descriptor: ProviderDescriptor;
}

export function ComingSoonCard({ descriptor }: ComingSoonCardProps) {
  return (
    <div
      className="rounded-xl border-2 border-white/[0.08] bg-[#0F0F0F] p-5 opacity-60"
      data-testid={`card-import-${descriptor.id}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProviderLogo id={descriptor.id} name={descriptor.name} />
          <div>
            <div className="text-body font-medium text-content-primary">{descriptor.name}</div>
            <div className="text-caption text-content-tertiary">
              {descriptor.category === 'exchange' ? 'Cryptocurrency Exchange' : descriptor.category}
              {' · '}
              {descriptor.authMethods[0] === 'api-key' ? 'API Key' : descriptor.authMethods[0]}
            </div>
          </div>
        </div>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[0.625rem] font-mono uppercase tracking-wider text-white/40">
          Coming Soon
        </span>
      </div>
    </div>
  );
}
