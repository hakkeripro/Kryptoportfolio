import { useEffect, useState } from 'react';
import { useVaultStore } from '../../store/useVaultStore';
import { useAuthStore } from '../../store/useAuthStore';
import { PROVIDER_REGISTRY, COMING_SOON_PROVIDERS } from '../../integrations/providerRegistry';
import type { ImportContext, ImportPlugin } from '../../integrations/importPlugin';
import { ProviderCard, ComingSoonCard } from './ProviderCard';

export function ProviderGrid() {
  const passphrase = useVaultStore((s) => s.passphrase);
  const token = useAuthStore((s) => s.token);
  const apiBase = useAuthStore((s) => s.apiBase);

  const [connections, setConnections] = useState<Record<string, boolean>>({});

  const ctx: ImportContext = {
    passphrase: passphrase ?? '',
    token: token ?? '',
    apiBase,
  };

  useEffect(() => {
    if (!passphrase) return;
    void (async () => {
      const results: Record<string, boolean> = {};
      for (const plugin of PROVIDER_REGISTRY) {
        results[plugin.descriptor.id] = await plugin.isConnected(passphrase);
      }
      setConnections(results);
    })();
  }, [passphrase]);

  function handleConnected(plugin: ImportPlugin) {
    setConnections((c) => ({ ...c, [plugin.descriptor.id]: true }));
  }

  function handleDisconnect(plugin: ImportPlugin) {
    setConnections((c) => ({ ...c, [plugin.descriptor.id]: false }));
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2" data-testid="list-import-sources">
        {PROVIDER_REGISTRY.map((plugin) => (
          <ProviderCard
            key={plugin.descriptor.id}
            plugin={plugin}
            ctx={ctx}
            isConnected={connections[plugin.descriptor.id] ?? false}
            onConnected={() => handleConnected(plugin)}
            onDisconnect={() => handleDisconnect(plugin)}
          />
        ))}
        {COMING_SOON_PROVIDERS.map((descriptor) => (
          <ComingSoonCard key={descriptor.id} descriptor={descriptor} />
        ))}
      </div>

      {/* Render FetchPanel for each connected provider */}
      {PROVIDER_REGISTRY.filter((p) => connections[p.descriptor.id]).map((plugin) => (
        <plugin.FetchPanel key={plugin.descriptor.id} ctx={ctx} />
      ))}
    </div>
  );
}
