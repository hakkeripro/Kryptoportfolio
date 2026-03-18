import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, ChevronDown } from 'lucide-react';
import { useLang } from '../i18n/LangContext';
import type { Lang } from '../i18n/translations';

const APP_URL = 'https://app.private-ledger.app';

export default function HeroSection() {
  const { lang, setLang, t } = useLang();

  return (
    <section className="relative min-h-screen flex flex-col overflow-hidden">
      {/* Ambient glow blobs */}
      <div
        className="pointer-events-none fixed top-[-200px] left-1/2 -translate-x-1/2 w-[900px] h-[600px] rounded-full opacity-[0.06]"
        style={{
          background: 'radial-gradient(ellipse at center, #FF8400, transparent 70%)',
          filter: 'blur(80px)',
          zIndex: 0,
        }}
      />
      <div
        className="pointer-events-none fixed top-[300px] right-[-100px] w-[500px] h-[500px] rounded-full opacity-[0.04]"
        style={{
          background: 'radial-gradient(ellipse at center, #FF8400, transparent 70%)',
          filter: 'blur(100px)',
          zIndex: 0,
        }}
      />

      {/* Navigation */}
      <nav className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-[#FF8400]/10 border border-[#FF8400]/20 flex items-center justify-center">
            <ShieldCheck className="w-4 h-4 text-[#FF8400]" />
          </div>
          <span className="font-mono text-sm font-semibold tracking-wider text-white">
            PrivateLedger
          </span>
        </div>
        <div className="flex items-center gap-3">
          {/* Language switcher */}
          <div className="flex items-center border border-white/[0.08] rounded-lg overflow-hidden">
            {(['en', 'fi'] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-2.5 py-1 text-[11px] font-mono uppercase tracking-wider transition-colors ${
                  lang === l
                    ? 'bg-[#FF8400]/10 text-[#FF8400]'
                    : 'text-white/30 hover:text-white/60'
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          <a
            href={`${APP_URL}/welcome`}
            className="text-sm text-white/50 hover:text-white transition-colors px-3 py-1.5"
          >
            {t.nav.signIn}
          </a>
          <a
            href={`${APP_URL}/welcome`}
            className="flex items-center gap-1.5 text-sm font-medium bg-[#FF8400] hover:bg-[#FF8400]/90 text-black px-4 py-2 rounded-lg transition-all duration-200 hover:shadow-[0_0_20px_rgba(255,132,0,0.25)]"
          >
            {t.nav.getStarted}
            <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </nav>

      {/* Hero content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 pt-16 pb-24 text-center max-w-5xl mx-auto w-full">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 bg-[#FF8400]/[0.08] border border-[#FF8400]/20 rounded-full px-4 py-1.5 mb-8"
        >
          <div className="w-1.5 h-1.5 rounded-full bg-[#FF8400] animate-pulse" />
          <span className="text-[11px] font-mono uppercase tracking-[0.15em] text-[#FF8400]">
            {t.hero.badge}
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.08] mb-6"
        >
          {t.hero.headline1}
          <br />
          <span className="text-[#FF8400]">{t.hero.headline2}</span> {t.hero.headline3}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg text-white/50 max-w-2xl mx-auto leading-relaxed mb-10"
        >
          {t.hero.sub}
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col sm:flex-row items-center gap-4"
        >
          <a
            href={`${APP_URL}/welcome`}
            className="flex items-center gap-2 bg-[#FF8400] hover:bg-[#FFA040] text-black font-semibold px-7 py-3.5 rounded-xl transition-all duration-200 hover:shadow-[0_0_30px_rgba(255,132,0,0.3)] text-base"
          >
            <ArrowRight className="w-4 h-4" />
            {t.hero.cta1}
          </a>
          <a
            href="#how-it-works"
            className="flex items-center gap-2 text-white/60 hover:text-white transition-colors text-base"
          >
            {t.hero.cta2}
            <ChevronDown className="w-4 h-4" />
          </a>
        </motion.div>

        {/* Trust signals */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="mt-16 flex items-center gap-6 text-white/20"
        >
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">
            {t.hero.trustTax}
          </span>
          <div className="w-px h-4 bg-white/10" />
          <span className="text-[10px] font-mono uppercase tracking-[0.15em]">
            {t.hero.trustPrivacy}
          </span>
        </motion.div>
      </div>
    </section>
  );
}
