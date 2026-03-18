import { useState } from 'react';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ImportContext, ImportPlugin } from '../../integrations/importPlugin';
import type { ProviderDescriptor } from '@kp/core';
import { CapabilityChoiceScreen } from './CapabilityChoiceScreen';

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

function BinanceLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className="text-yellow-400">
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
      <path
        d="M12 6l2.5 2.5L12 11 9.5 8.5zM6 12l2.5-2.5L11 12l-2.5 2.5zM18 12l-2.5-2.5L13 12l2.5 2.5zM12 18l-2.5-2.5L12 13l2.5 2.5z"
        fill="currentColor"
      />
    </svg>
  );
}

function KrakenLogo() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" aria-hidden="true" className="text-purple-400">
      <circle cx="12" cy="12" r="12" fill="currentColor" opacity="0.15" />
      <path
        d="M8 7h8M8 12h8M8 17h8"
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
  if (id === 'binance') return <BinanceLogo />;
  if (id === 'kraken') return <KrakenLogo />;
  return <GenericLogo name={name} />;
}

function authMethodLabel(method: string): string {
  if (method === 'api-key') return 'API Key';
  if (method === 'csv') return 'CSV';
  if (method === 'address') return 'Wallet Address';
  return method;
}

type CapabilityChoice = 'api' | 'csv' | null;

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
  const hasApi = !!plugin.api;
  const hasCsv = !!plugin.csv;
  const hasBoth = hasApi && hasCsv;

  // When provider has both API + CSV, show choice screen first
  const [capabilityChoice, setCapabilityChoice] = useState<CapabilityChoice>(
    hasBoth ? null : hasApi ? 'api' : hasCsv ? 'csv' : null,
  );

  const methodLabels = descriptor.authMethods.map(authMethodLabel).join(' · ');

  async function handleDisconnect() {
    await plugin.api?.disconnect();
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
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <ProviderLogo id={descriptor.id} name={descriptor.name} />
          <div>
            <div className="text-body font-medium text-content-primary">{descriptor.name}</div>
            <div className="text-caption text-content-tertiary">
              {descriptor.category === 'exchange' ? 'Cryptocurrency Exchange' : descriptor.category}
              {' · '}
              {methodLabels}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isConnected && (
            <div className="w-6 h-6 rounded-full bg-semantic-success flex items-center justify-center">
              <Check className="h-3.5 w-3.5 text-white" />
            </div>
          )}
          {isConnected && hasApi && (
            <button
              className="rounded-button border border-border px-3 py-1.5 text-caption text-content-secondary hover:bg-surface-overlay transition-colors"
              onClick={() => void handleDisconnect()}
              data-testid={`btn-${descriptor.id}-disconnect`}
            >
              {t('imports.btn.disconnect')}
            </button>
          )}
        </div>
      </div>

      {/* Body — only when not connected */}
      {!isConnected && (
        <>
          {/* Show capability choice when provider has both api + csv and no choice made yet */}
          {hasBoth && !capabilityChoice && (
            <CapabilityChoiceScreen plugin={plugin} onChoice={setCapabilityChoice} />
          )}

          {/* API connect form */}
          {capabilityChoice === 'api' && hasApi && (
            <>
              {hasBoth && (
                <button
                  className="mt-3 text-caption text-content-tertiary hover:text-content-secondary underline underline-offset-2"
                  onClick={() => setCapabilityChoice(null)}
                >
                  ← Back
                </button>
              )}
              <plugin.api.ConnectForm ctx={ctx} onConnected={onConnected} />
            </>
          )}

          {/* CSV upload form */}
          {capabilityChoice === 'csv' && hasCsv && (
            <>
              {hasBoth && (
                <button
                  className="mt-3 text-caption text-content-tertiary hover:text-content-secondary underline underline-offset-2"
                  onClick={() => setCapabilityChoice(null)}
                >
                  ← Back
                </button>
              )}
              <plugin.csv.UploadForm ctx={ctx} />
            </>
          )}
        </>
      )}

      {/* Connected badge */}
      {isConnected && (
        <div
          className="mt-3 rounded-button bg-semantic-success/10 px-3 py-2 text-caption text-semantic-success font-medium"
          data-testid={`badge-${descriptor.id}-connected`}
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
  const methodLabels = descriptor.authMethods.map(authMethodLabel).join(' · ');
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
              {methodLabels}
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
