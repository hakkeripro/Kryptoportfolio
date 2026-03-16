import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { cn } from '@/lib/utils';
import { counterSpring } from '@/lib/animations';

interface KpiCardProps {
  label: string;
  value: string;
  numericValue?: number;
  unit?: string;
  delta?: string;
  deltaType?: 'positive' | 'negative' | 'neutral';
}

function AnimatedNumber({ value }: { value: number }) {
  const motionVal = useMotionValue(0);
  const spring = useSpring(motionVal, counterSpring);
  const display = useTransform(spring, (v) => {
    if (Math.abs(value) >= 1) return v.toLocaleString(undefined, { maximumFractionDigits: 2 });
    return v.toLocaleString(undefined, { maximumFractionDigits: 4 });
  });
  const ref = useRef(false);

  useEffect(() => {
    if (!ref.current) {
      ref.current = true;
      motionVal.set(0);
    }
    motionVal.set(value);
  }, [value, motionVal]);

  return <motion.span className="tabular-nums">{display}</motion.span>;
}

export function KpiCard({
  label,
  value,
  numericValue,
  unit,
  delta,
  deltaType = 'neutral',
}: KpiCardProps) {
  return (
    <motion.div
      className="relative h-full"
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
    >
      {/* Top accent line — brand gradient */}
      <div className="absolute top-0 left-0 right-0 h-px rounded-t-xl bg-gradient-to-r from-[#FF8400]/70 via-[#FF8400]/20 to-transparent z-10" />

      <div className="relative h-full rounded-xl border border-white/[0.08] bg-[#0F0F0F] px-5 py-4 flex flex-col gap-2.5 overflow-hidden transition-all duration-300 hover:border-[#FF8400]/25 hover:shadow-[0_0_30px_rgba(255,132,0,0.12),0_0_60px_rgba(255,132,0,0.05)]">
        {/* Corner glow */}
        <div className="absolute -top-10 -left-10 w-28 h-28 rounded-full bg-[#FF8400]/[0.04] blur-2xl pointer-events-none" />

        <span className="text-[10px] font-mono uppercase tracking-[0.18em] text-white/30">
          {label}
        </span>

        <div className="text-[21px] font-mono font-semibold text-white leading-none tabular-nums">
          {numericValue !== undefined ? (
            <>
              <AnimatedNumber value={numericValue} />
              {unit && <span className="text-sm font-normal text-white/25 ml-1.5">{unit}</span>}
            </>
          ) : (
            value
          )}
        </div>

        {delta && (
          <span
            className={cn(
              'self-start text-[11px] font-mono px-2 py-0.5 rounded-full',
              deltaType === 'positive'
                ? 'bg-emerald-500/10 text-emerald-400'
                : deltaType === 'negative'
                  ? 'bg-red-500/10 text-red-400'
                  : 'bg-white/5 text-white/30',
            )}
          >
            {delta}
          </span>
        )}
      </div>
    </motion.div>
  );
}
