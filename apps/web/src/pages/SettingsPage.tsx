import { useState } from 'react';
import type { Settings } from '@kp/core';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAuthStore } from '../store/useAuthStore';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import PortfolioSettingsCard from '../components/settings/PortfolioSettingsCard';
import SecurityCard from '../components/settings/SecurityCard';
import NotificationsCard from '../components/settings/NotificationsCard';
import SyncCard from '../components/settings/SyncCard';
import AdvancedCard from '../components/settings/AdvancedCard';

export default function SettingsPage() {
  const { apiBase, token, email } = useAuthStore();
  const [busy, setBusy] = useState(false);

  const settingsQ = useDbQuery<Settings | null>(
    async () => {
      try {
        return await ensureDefaultSettings();
      } catch {
        return null;
      }
    },
    [],
    null,
  );

  const baseCurrency = String(settingsQ.data?.baseCurrency ?? 'EUR').toUpperCase();

  return (
    <div className="space-y-6" data-testid="page-settings">
      <h1 className="text-xl font-semibold">Settings</h1>

      <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4 space-y-2">
        <div className="font-medium">Account</div>
        <div className="text-sm text-slate-300">
          {token ? `Logged in as ${email}` : 'Not logged in'}
        </div>
      </div>

      <PortfolioSettingsCard
        settings={settingsQ.data}
        loading={settingsQ.loading}
        error={settingsQ.error}
        busy={busy}
        setBusy={setBusy}
      />
      <SecurityCard busy={busy} setBusy={setBusy} />
      <NotificationsCard
        settings={settingsQ.data}
        token={token ?? ''}
        apiBase={apiBase}
        baseCurrency={baseCurrency}
        busy={busy}
        setBusy={setBusy}
      />
      <SyncCard busy={busy} setBusy={setBusy} />
      <AdvancedCard />
    </div>
  );
}
