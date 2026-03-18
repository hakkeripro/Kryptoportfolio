import { motion } from 'framer-motion';
import { Check, X, ArrowRight, Zap } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

const APP_URL = 'https://app.private-ledger.app';

type CellValue = boolean | string;

function FeatureCell({ value }: { value: CellValue }) {
  if (value === false) return <X className="w-4 h-4 text-white/20 mx-auto" />;
  if (value === true) return <Check className="w-4 h-4 text-[#B6FFCE] mx-auto" />;
  return <span className="text-xs font-mono text-[#FF8400]">{value}</span>;
}

export default function PricingSection() {
  const { t } = useLang();
  const p = t.pricing;

  const FEATURES = [
    { text: p.f1, free: true, pro: true },
    { text: p.f2, free: p.alerts3, pro: p.unlimited },
    { text: p.f3, free: true, pro: true },
    { text: p.f4, free: p.year1, pro: p.unlimited },
    { text: p.f5, free: true, pro: true },
    { text: p.f6, free: false, pro: true },
    { text: p.f7, free: false, pro: true },
    { text: p.f8, free: false, pro: true },
    { text: p.f9, free: false, pro: true },
  ];

  return (
    <section id="pricing" className="relative py-24 px-6">
      {/* Background accent */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.02]"
        style={{ background: 'radial-gradient(ellipse at center, #FF8400, transparent 70%)' }}
      />

      <div className="max-w-4xl mx-auto relative">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4">
            {p.label}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-4">
            {p.headline1} <span className="text-[#FF8400]">{p.headline2}</span> {p.headline3}
          </h2>
          <p className="text-white/50">{p.sub}</p>
        </div>

        {/* Pricing cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {/* Free */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0F0F0F] border border-white/[0.08] rounded-2xl p-8"
          >
            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30 mb-3">
                {p.freeLabel}
              </p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-white">€0</span>
                <span className="text-white/40 mb-1.5 text-sm">{p.freePriceSuffix}</span>
              </div>
              <p className="text-sm text-white/40 mt-2">{p.freeTagline}</p>
            </div>
            <a
              href={`${APP_URL}/welcome`}
              className="w-full block text-center py-3 rounded-xl border border-white/[0.12] text-white hover:bg-white/[0.04] transition-colors text-sm font-medium mb-6"
            >
              {p.freeCta}
            </a>
            <ul className="space-y-3">
              {FEATURES.filter((f) => f.free).map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <Check className="w-3.5 h-3.5 text-[#B6FFCE] shrink-0" />
                  <span className="text-sm text-white/60">
                    {typeof f.free === 'string' ? f.free : f.text}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>

          {/* Pro */}
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-[#0F0F0F] border border-[#FF8400]/30 rounded-2xl p-8 overflow-hidden"
            style={{ boxShadow: '0 0 40px rgba(255,132,0,0.08)' }}
          >
            {/* Top orange accent */}
            <div className="absolute inset-x-0 top-0 h-[1px] bg-gradient-to-r from-transparent via-[#FF8400] to-transparent" />

            {/* Popular badge */}
            <div className="absolute top-5 right-5 flex items-center gap-1.5 bg-[#FF8400]/10 border border-[#FF8400]/20 rounded-full px-3 py-1">
              <Zap className="w-2.5 h-2.5 text-[#FF8400]" />
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-[#FF8400]">
                {p.proLabel}
              </span>
            </div>

            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-[#FF8400]/70 mb-3">
                {p.proLabel}
              </p>
              <div className="flex items-end gap-2">
                <span className="text-4xl font-bold text-white">€4,99</span>
                <span className="text-white/40 mb-1.5 text-sm">{p.proPriceSuffix}</span>
              </div>
              <p className="text-sm text-white/40 mt-2">{p.proTagline}</p>
            </div>
            <a
              href={`${APP_URL}/welcome`}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#FF8400] hover:bg-[#FFA040] text-black text-sm font-semibold mb-6 transition-all hover:shadow-[0_0_20px_rgba(255,132,0,0.3)]"
            >
              {p.proCta}
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
            <ul className="space-y-3">
              {FEATURES.map((f) => (
                <li key={f.text} className="flex items-center gap-3">
                  <Check className="w-3.5 h-3.5 text-[#B6FFCE] shrink-0" />
                  <span className="text-sm text-white/60">
                    {typeof f.pro === 'string' ? f.pro : f.text}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Comparison table */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="bg-[#0F0F0F] border border-white/[0.06] rounded-2xl overflow-hidden"
        >
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/[0.06]">
                <th className="text-left px-6 py-4 text-[10px] font-mono uppercase tracking-[0.15em] text-white/20">
                  {p.tableFeature}
                </th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 text-center">
                  {p.freeLabel}
                </th>
                <th className="px-6 py-4 text-[10px] font-mono uppercase tracking-[0.15em] text-[#FF8400]/60 text-center">
                  {p.proLabel}
                </th>
              </tr>
            </thead>
            <tbody>
              {FEATURES.map((f, i) => (
                <tr
                  key={f.text}
                  className={`border-b border-white/[0.04] ${i % 2 === 0 ? '' : 'bg-white/[0.01]'}`}
                >
                  <td className="px-6 py-3.5 text-sm text-white/60">{f.text}</td>
                  <td className="px-6 py-3.5 text-center">
                    <FeatureCell value={f.free} />
                  </td>
                  <td className="px-6 py-3.5 text-center">
                    <FeatureCell value={f.pro} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
}
