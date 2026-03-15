import { useState } from 'react';
import { useTranslation } from 'react-i18next';
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
  const { t, i18n } = useTranslation();
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

  const changeLang = (lng: string) => {
    void i18n.changeLanguage(lng);
    localStorage.setItem('vaultfolio-lang', lng);
  };

  return (
    <div className="space-y-6" data-testid="page-settings">
      <h1 className="text-xl font-semibold">{t('settings.title')}</h1>

      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
        <div className="font-medium">{t('settings.account.title')}</div>
        <div className="text-sm text-content-secondary">
          {token ? t('settings.account.loggedIn', { email }) : t('settings.account.notLoggedIn')}
        </div>
      </div>

      {/* Language selector */}
      <div className="rounded-xl border border-border bg-surface-raised p-4 space-y-2">
        <div className="font-medium">{t('settings.language.title')}</div>
        <div className="flex gap-2">
          <button
            className={`px-3 py-1.5 rounded-button text-caption font-medium transition-colors ${i18n.language === 'en' ? 'bg-brand text-content-inverse' : 'bg-surface-overlay text-content-secondary hover:text-content-primary'}`}
            onClick={() => changeLang('en')}
          >
            {t('settings.language.en')}
          </button>
          <button
            className={`px-3 py-1.5 rounded-button text-caption font-medium transition-colors ${i18n.language === 'fi' ? 'bg-brand text-content-inverse' : 'bg-surface-overlay text-content-secondary hover:text-content-primary'}`}
            onClick={() => changeLang('fi')}
          >
            {t('settings.language.fi')}
          </button>
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
