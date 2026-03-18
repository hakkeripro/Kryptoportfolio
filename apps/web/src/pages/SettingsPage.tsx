import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Settings } from '@kp/core';
import { useDbQuery } from '../hooks/useDbQuery';
import { useAuthStore } from '../store/useAuthStore';
import { ensureDefaultSettings } from '../derived/ensureDefaultSettings';
import TaxProfileCard from '../components/settings/TaxProfileCard';
import SecurityCard from '../components/settings/SecurityCard';
import NotificationsCard from '../components/settings/NotificationsCard';
import IntegrationsCard from '../components/settings/IntegrationsCard';
import DangerZoneCard from '../components/settings/DangerZoneCard';
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
    localStorage.setItem('privateledger-lang', lng);
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

      {/* // ACCOUNT */}
      <div data-testid="section-account">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          // Account
        </h2>
        <div className="space-y-3">
          {/* Account info + language */}
          <div className="rounded-xl border border-white/[0.08] bg-[#0F0F0F] p-4 space-y-4">
            <div>
              <div className="text-body font-medium text-content-primary">
                {t('settings.account.title')}
              </div>
              <div className="text-caption text-content-secondary mt-1">
                {token
                  ? t('settings.account.loggedIn', { email })
                  : t('settings.account.notLoggedIn')}
              </div>
            </div>

            {/* Language */}
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

            {/* Link to AccountPage */}
            <div className="pt-1">
              <Link
                to="/account"
                className="text-caption text-brand hover:text-brand-light transition-colors"
              >
                Passkeys, password & vault passphrase →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* // TAX PROFILE */}
      <div data-testid="section-tax-profile">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          // Tax Profile
        </h2>
        <TaxProfileCard
          settings={settingsQ.data}
          loading={settingsQ.loading}
          error={settingsQ.error}
          busy={busy}
          setBusy={setBusy}
        />
      </div>

      {/* // NOTIFICATIONS */}
      <div data-testid="section-notifications">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          // Notifications
        </h2>
        <div className="space-y-3">
          <SecurityCard busy={busy} setBusy={setBusy} />
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

      {/* // INTEGRATIONS */}
      <div data-testid="section-integrations">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-3">
          // Integrations
        </h2>
        <IntegrationsCard
          settings={settingsQ.data}
          autoRefreshIntervalSec={settingsQ.data?.autoRefreshIntervalSec ?? 300}
          busy={busy}
          setBusy={setBusy}
        />
      </div>

      {/* // DANGER ZONE */}
      <div data-testid="section-danger-zone">
        <h2 className="text-[10px] font-mono uppercase tracking-[0.2em] text-red-500/60 mb-3">
          // Danger Zone
        </h2>
        <div className="space-y-3">
          <DangerZoneCard />
          <AdvancedCard />
        </div>
      </div>
    </motion.div>
  );
}
