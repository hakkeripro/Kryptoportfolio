import { useEffect, useRef } from 'react';
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion';
import { Card } from './Card';
import { cn } from '@/lib/utils';
import { cardHover, counterSpring } from '@/lib/animations';

interface KpiCardProps {
  label: string;
  value: string;
  numericValue?: number;
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

  return <motion.span>{display}</motion.span>;
}

export function KpiCard({
  label,
  value,
  numericValue,
  delta,
  deltaType = 'neutral',
}: KpiCardProps) {
  const deltaColor =
    deltaType === 'positive'
      ? 'text-[#B6FFCE]'
      : deltaType === 'negative'
        ? 'text-[#FF5C33]'
        : 'text-muted-foreground';

  return (
    <motion.div variants={cardHover} initial="rest" whileHover="hover" className="h-full">
      <Card className="p-5 h-full border-[#2E2E2E] bg-[#1A1A1A] transition-shadow hover:shadow-lg">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="mt-2 text-2xl font-semibold font-heading text-card-foreground">
          {numericValue !== undefined ? <AnimatedNumber value={numericValue} /> : value}
        </div>
        {delta && <div className={cn('mt-2 text-xs', deltaColor)}>{delta}</div>}
      </Card>
    </motion.div>
  );
}
