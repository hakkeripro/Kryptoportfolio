import { Lock } from 'lucide-react';

interface BlurOverlayProps {
  children: React.ReactNode;
  onUpgrade?: () => void;
  ctaText?: string;
}

/**
 * Wraps content in a blur overlay for free-tier gating.
 * Data is rendered behind the blur (not hidden from DOM),
 * which creates a "locked but visible" psychological effect.
 */
export function BlurOverlay({ children, onUpgrade, ctaText = 'Unlock — Pro' }: BlurOverlayProps) {
  return (
    <div className="relative" data-testid="blur-overlay">
      <div
        className="blur-[6px] pointer-events-none select-none"
        aria-hidden="true"
        style={{ filter: 'blur(6px)' }}
      >
        {children}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 rounded-lg z-10">
        <Lock className="h-5 w-5 text-[#FF8400] mb-2" />
        <p className="text-[13px] font-medium text-white/80 mb-3">{ctaText}</p>
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="px-4 py-1.5 rounded-full bg-[#FF8400] text-black text-[12px] font-semibold
              hover:bg-[#FF8400]/90 transition-colors"
          >
            Upgrade
          </button>
        )}
      </div>
    </div>
  );
}
