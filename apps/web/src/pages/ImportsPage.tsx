import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { pageTransition } from '../lib/animations';
import { ProviderGrid } from '../components/imports/ProviderGrid';

export default function ImportsPage() {
  const { t } = useTranslation();

  return (
    <motion.div className="space-y-section" {...pageTransition}>
      {/* Header */}
      <div>
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25 mb-1">
          {t('imports.description')}
        </p>
        <h1 className="text-heading-1 font-heading text-content-primary">Import Transactions</h1>
      </div>

      <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/25">
        // IMPORT SOURCES
      </p>

      <ProviderGrid />
    </motion.div>
  );
}
