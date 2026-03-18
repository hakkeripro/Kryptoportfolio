import { motion } from 'framer-motion';
import { ShieldCheck, Calculator, RefreshCw, EyeOff } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

export default function FeatureCards() {
  const { t } = useLang();
  const f = t.features;

  const FEATURES = [
    { icon: ShieldCheck, tag: 'SECURITY', title: f.f1Title, description: f.f1Desc },
    { icon: Calculator, tag: 'FINNISH TAX', title: f.f2Title, description: f.f2Desc },
    { icon: RefreshCw, tag: 'INTEGRATIONS', title: f.f3Title, description: f.f3Desc },
    { icon: EyeOff, tag: 'PRIVACY', title: f.f4Title, description: f.f4Desc },
  ];

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-16">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4">
            {f.label}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
            {f.headline1} <span className="text-[#FF8400]">{f.headline2}</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            return (
              <motion.div
                key={feature.tag}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="group relative bg-[#0F0F0F] border border-white/[0.08] rounded-2xl p-7 hover:border-[#FF8400]/20 hover:shadow-[0_0_30px_rgba(255,132,0,0.08)] transition-all duration-300 cursor-default"
              >
                {/* Top border accent on hover */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF8400]/0 to-transparent group-hover:via-[#FF8400]/40 rounded-t-2xl transition-all duration-500" />

                <div className="flex items-start gap-4 mb-4">
                  <div className="w-10 h-10 rounded-xl bg-[#FF8400]/[0.08] border border-[#FF8400]/20 flex items-center justify-center shrink-0 group-hover:bg-[#FF8400]/[0.12] transition-colors">
                    <Icon
                      className="w-4.5 h-4.5 text-[#FF8400]"
                      style={{ width: '18px', height: '18px' }}
                    />
                  </div>
                  <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/20 mt-2.5">
                    {feature.tag}
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-white mb-2.5">{feature.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
