import { ArrowRight, Github, ShieldCheck } from 'lucide-react';

const APP_URL = 'https://app.private-ledger.app';

export default function Footer() {
  return (
    <footer className="relative border-t border-white/[0.06] px-6 py-16">
      <div className="max-w-6xl mx-auto">
        {/* CTA strip */}
        <div className="relative bg-[#0F0F0F] border border-[#FF8400]/20 rounded-2xl p-10 text-center mb-16 overflow-hidden">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF8400]/60 to-transparent" />
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03]"
            style={{ background: 'radial-gradient(ellipse at center, #FF8400, transparent 70%)' }}
          />
          <h3 className="text-3xl md:text-4xl font-bold text-white mb-4 relative">
            Start tracking privately.
            <br />
            <span className="text-[#FF8400]">Free, forever.</span>
          </h3>
          <p className="text-white/50 mb-8 relative">No credit card. No tracking. No excuses.</p>
          <a
            href={`${APP_URL}/welcome`}
            className="inline-flex items-center gap-2 bg-[#FF8400] hover:bg-[#FFA040] text-black font-semibold px-8 py-3.5 rounded-xl transition-all hover:shadow-[0_0_30px_rgba(255,132,0,0.3)] relative"
          >
            <ArrowRight className="w-4 h-4" />
            Get started — it's free
          </a>
        </div>

        {/* Footer links */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-[#FF8400]/10 border border-[#FF8400]/20 flex items-center justify-center">
              <ShieldCheck className="w-3.5 h-3.5 text-[#FF8400]" />
            </div>
            <span className="font-mono text-sm font-semibold text-white/60">PrivateLedger</span>
          </div>

          {/* Links */}
          <div className="flex items-center gap-6">
            <a
              href="/blog/krypto-verotus-suomi-2026"
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              Krypto verotus 2026
            </a>
            <a
              href={`${APP_URL}/welcome`}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              App
            </a>
            <a
              href="https://github.com/private-ledger"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 transition-colors"
            >
              <Github className="w-3.5 h-3.5" />
              GitHub
            </a>
          </div>

          {/* Privacy tagline */}
          <p className="text-[10px] font-mono uppercase tracking-[0.1em] text-white/20">
            Your data. Your keys. Always.
          </p>
        </div>

        <div className="mt-8 pt-6 border-t border-white/[0.04] text-center">
          <p className="text-[10px] font-mono text-white/15">
            © 2026 PrivateLedger. Zero-knowledge crypto portfolio tracker.
          </p>
        </div>
      </div>
    </footer>
  );
}
