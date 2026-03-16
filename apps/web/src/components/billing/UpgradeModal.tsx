import { X, Check, Lock } from 'lucide-react';

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
}

const FEATURES = [
  'Realized gains & losses (FIFO/LIFO/HIFO/AVG)',
  'PDF & CSV tax report export',
  'FI hankintameno-olettama (20%/40%)',
  'Multi-year history',
];

export function UpgradeModal({ open, onClose }: UpgradeModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Upgrade to Tax plan"
      data-testid="upgrade-modal"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal card */}
      <div className="relative z-10 w-full max-w-sm bg-[#0F0F0F] border border-white/[0.08] rounded-2xl shadow-2xl overflow-hidden">
        {/* Top accent border */}
        <div className="h-px w-full bg-gradient-to-r from-transparent via-[#FF8400]/60 to-transparent" />

        <div className="p-6 space-y-5">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-1">
                // TAX_REPORT
              </p>
              <h2 className="text-lg font-semibold text-white leading-tight">
                Tax Plan — Premium
              </h2>
              <p className="text-[13px] text-white/50 mt-0.5">~29–49 EUR / year</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              data-testid="upgrade-modal-close"
              className="text-white/30 hover:text-white/70 transition-colors mt-0.5"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Feature list */}
          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2.5">
            {FEATURES.map((f) => (
              <div key={f} className="flex items-start gap-2.5">
                <Check className="h-3.5 w-3.5 text-[#FF8400] mt-0.5 shrink-0" />
                <span className="text-[13px] text-white/70">{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="space-y-3">
            <button
              data-testid="upgrade-modal-waitlist"
              onClick={onClose}
              className="w-full rounded-xl bg-[#FF8400] hover:bg-[#FF8400]/90 text-black font-semibold text-[13px] py-2.5 transition-colors"
            >
              Join waitlist
            </button>
            <button
              data-testid="upgrade-modal-dismiss"
              onClick={onClose}
              className="w-full rounded-xl border border-white/[0.08] text-white/50 hover:text-white/70 text-[13px] py-2 transition-colors"
            >
              Not now
            </button>
          </div>

          <p className="text-[11px] text-white/25 text-center leading-relaxed">
            Full payment support coming soon. Join the waitlist and we'll notify you at launch.
          </p>
        </div>
      </div>
    </div>
  );
}

/** Inline upgrade teaser — shown inside gated content areas */
export function UpgradeTeaser({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <div
      data-testid="upgrade-teaser"
      className="rounded-xl border border-[#FF8400]/20 bg-[#FF8400]/[0.04] p-4 space-y-2"
    >
      <div className="flex items-center gap-2">
        <Lock className="h-3.5 w-3.5 text-[#FF8400]" />
        <span className="text-[12px] font-mono uppercase tracking-[0.12em] text-[#FF8400]/80">
          Premium required
        </span>
      </div>
      <p className="text-[13px] text-white/50">
        Detailed report &amp; export require a Tax subscription.
      </p>
      <button
        data-testid="upgrade-teaser-btn"
        onClick={onUpgrade}
        className="text-[12px] text-[#FF8400] hover:text-[#FF8400]/80 underline underline-offset-2 transition-colors"
      >
        View pricing →
      </button>
    </div>
  );
}
