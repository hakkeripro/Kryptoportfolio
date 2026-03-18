import { Key, Upload } from 'lucide-react';
import type { ImportPlugin } from '../../integrations/importPlugin';

type CapabilityChoice = 'api' | 'csv';

interface CapabilityChoiceScreenProps {
  plugin: ImportPlugin;
  onChoice: (choice: CapabilityChoice) => void;
}

/**
 * Shown when a provider has both api + csv capabilities.
 * Lets the user pick how they want to import.
 */
export function CapabilityChoiceScreen({ plugin, onChoice }: CapabilityChoiceScreenProps) {
  const hasApi = !!plugin.api;
  const hasCsv = !!plugin.csv;

  return (
    <div className="mt-4 space-y-2">
      <div className="text-caption text-content-tertiary mb-3">
        How would you like to import from {plugin.descriptor.name}?
      </div>
      {hasApi && (
        <button
          className="w-full flex items-start gap-4 rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 text-left hover:border-[#FF8400]/40 hover:bg-[#FF8400]/[0.02] transition-all"
          onClick={() => onChoice('api')}
          data-testid={`btn-${plugin.descriptor.id}-choice-api`}
        >
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-[#FF8400]/[0.08] flex items-center justify-center">
            <Key className="h-4 w-4 text-[#FF8400]" />
          </div>
          <div>
            <div className="text-body font-medium text-content-primary">Connect via API</div>
            <div className="text-caption text-content-tertiary mt-0.5">
              Automatic sync using API key. Fetches trades, deposits and withdrawals automatically.
            </div>
          </div>
        </button>
      )}
      {hasCsv && (
        <button
          className="w-full flex items-start gap-4 rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 text-left hover:border-[#FF8400]/40 hover:bg-[#FF8400]/[0.02] transition-all"
          onClick={() => onChoice('csv')}
          data-testid={`btn-${plugin.descriptor.id}-choice-csv`}
        >
          <div className="mt-0.5 flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.04] flex items-center justify-center">
            <Upload className="h-4 w-4 text-content-secondary" />
          </div>
          <div>
            <div className="text-body font-medium text-content-primary">Import via CSV</div>
            <div className="text-caption text-content-tertiary mt-0.5">
              One-time import from a Statement CSV export. No API key required. 100% private — processed locally.
            </div>
          </div>
        </button>
      )}
    </div>
  );
}
