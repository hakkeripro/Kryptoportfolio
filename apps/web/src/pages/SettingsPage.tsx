import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
    <motion.div
      className="space-y-section max-w-[680px]"
      data-testid="page-settings"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <div>
        <h1 className="text-heading-1 font-heading text-content-primary">{t('settings.title')}</h1>
        <p className="text-caption text-content-tertiary mt-0.5">
          Manage your vault, preferences, and account
        </p>
      </div>

      {/* Vault & Security */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          Vault & Security
        </h2>
        <div className="space-y-3">
          <div className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4">
            <div className="text-body font-medium text-content-primary">
              {t('settings.account.title')}
            </div>
            <div className="text-caption text-content-secondary mt-1">
              {token
                ? t('settings.account.loggedIn', { email })
                : t('settings.account.notLoggedIn')}
            </div>
          </div>
          <SecurityCard busy={busy} setBusy={setBusy} />
        </div>
      </div>

      {/* Preferences */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          Preferences
        </h2>
        <div className="space-y-3">
          {/* Language selector */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4">
            <div className="flex items-center justify-between">
              <div className="text-body font-medium text-content-primary">
                {t('settings.language.title')}
              </div>
              <div className="flex gap-2">
                <button
                  data-testid="btn-lang-en"
                  className={`px-3 py-1.5 rounded-button text-caption font-medium transition-colors ${
                    i18n.language === 'en'
                      ? 'bg-brand text-content-inverse'
                      : 'bg-surface-overlay text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => changeLang('en')}
                >
                  {t('settings.language.en')}
                </button>
                <button
                  data-testid="btn-lang-fi"
                  className={`px-3 py-1.5 rounded-button text-caption font-medium transition-colors ${
                    i18n.language === 'fi'
                      ? 'bg-brand text-content-inverse'
                      : 'bg-surface-overlay text-content-secondary hover:text-content-primary'
                  }`}
                  onClick={() => changeLang('fi')}
                >
                  {t('settings.language.fi')}
                </button>
              </div>
            </div>
          </div>

          <PortfolioSettingsCard
            settings={settingsQ.data}
            loading={settingsQ.loading}
            error={settingsQ.error}
            busy={busy}
            setBusy={setBusy}
          />

          <NotificationsCard
            settings={settingsQ.data}
            token={token ?? ''}
            apiBase={apiBase}
            baseCurrency={baseCurrency}
            busy={busy}
            setBusy={setBusy}
          />
        </div>
      </div>

      {/* Sync */}
      <SyncCard busy={busy} setBusy={setBusy} />

      {/* Danger Zone */}
      <div>
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500/60 mb-3">
          Danger Zone
        </h2>
        <AdvancedCard />
      </div>
    </motion.div>
  );
}
