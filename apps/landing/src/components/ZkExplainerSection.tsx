import { motion } from 'framer-motion';
import { Lock, Package, Unlock } from 'lucide-react';
import { useLang } from '../i18n/LangContext';

export default function ZkExplainerSection() {
  const { t } = useLang();
  const zk = t.zk;

  const STEPS = [
    { icon: Lock, number: '01', title: zk.step1Title, description: zk.step1Desc },
    { icon: Package, number: '02', title: zk.step2Title, description: zk.step2Desc },
    { icon: Unlock, number: '03', title: zk.step3Title, description: zk.step3Desc },
  ];

  return (
    <section id="how-it-works" className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-20">
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4">
            {zk.label}
          </p>
          <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight mb-5">
            {zk.headline1} <span className="text-[#FF8400]">{zk.headline2}</span>
          </h2>
          <p className="text-white/50 text-lg max-w-xl mx-auto">{zk.sub}</p>
        </div>

        {/* Steps */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
          {/* Connector line (desktop) */}
          <div className="hidden md:block absolute top-[3.25rem] left-[calc(33.33%_+_24px)] right-[calc(33.33%_+_24px)] h-px bg-gradient-to-r from-[#FF8400]/20 via-[#FF8400]/40 to-[#FF8400]/20" />

          {STEPS.map((step, i) => {
            const Icon = step.icon;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.6, delay: i * 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="relative bg-[#0F0F0F] border border-white/[0.08] rounded-2xl p-8 hover:border-[#FF8400]/20 hover:shadow-[0_0_30px_rgba(255,132,0,0.06)] transition-all duration-300"
              >
                {/* Top border accent */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF8400]/30 to-transparent rounded-t-2xl" />

                {/* Icon + number */}
                <div className="flex items-start gap-4 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-[#FF8400]/[0.08] border border-[#FF8400]/20 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-[#FF8400]" />
                  </div>
                  <span className="font-mono text-3xl font-bold text-white/[0.06] leading-none mt-2">
                    {step.number}
                  </span>
                </div>

                <h3 className="text-lg font-semibold text-white mb-3">{step.title}</h3>
                <p className="text-sm text-white/50 leading-relaxed">{step.description}</p>
              </motion.div>
            );
          })}
        </div>

        {/* Code callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 bg-[#0F0F0F] border border-white/[0.06] rounded-xl p-6 font-mono text-sm"
        >
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            <span className="text-[10px] text-white/20 ml-2 uppercase tracking-[0.1em]">
              vault.ts — client-side encryption
            </span>
          </div>
          <pre className="text-xs leading-6 overflow-x-auto">
            <span className="text-white/30">{`// ${zk.codeComment1.replace('// ', '')}`}</span>
            {'\n'}
            <span className="text-[#FF8400]/80">const</span>
            <span className="text-white/70"> key </span>
            <span className="text-white/40">= await </span>
            <span className="text-[#B2B2FF]/80">crypto.subtle.importKey</span>
            <span className="text-white/40">(</span>
            <span className="text-[#B6FFCE]/70">"raw"</span>
            <span className="text-white/40">, passphraseBytes, </span>
            <span className="text-[#B6FFCE]/70">"AES-GCM"</span>
            <span className="text-white/40">, </span>
            <span className="text-[#FF8400]/80">false</span>
            <span className="text-white/40">, [</span>
            <span className="text-[#B6FFCE]/70">"encrypt"</span>
            <span className="text-white/40">]);</span>
            {'\n'}
            <span className="text-[#FF8400]/80">const</span>
            <span className="text-white/70"> ciphertext </span>
            <span className="text-white/40">= await </span>
            <span className="text-[#B2B2FF]/80">crypto.subtle.encrypt</span>
            <span className="text-white/40">({'{ name: "AES-GCM", iv }'}, key, plaintext);</span>
            {'\n'}
            <span className="text-white/30">{`// ${zk.codeComment2.replace('// ', '')}`}</span>
          </pre>
        </motion.div>
      </div>
    </section>
  );
}
