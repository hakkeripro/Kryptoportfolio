import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation, useMotionValue, useTransform, animate } from 'framer-motion';
import { Bell, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';

// Static mock data — no randomness on every render (SSR-compatible)
const ASSETS = [
  { symbol: 'BTC', name: 'Bitcoin', amount: '0.142', value: 6820, change: +2.1 },
  { symbol: 'ETH', name: 'Ethereum', amount: '2.50', value: 4312, change: +1.8 },
  { symbol: 'SOL', name: 'Solana', amount: '45.0', value: 3115, change: -0.4 },
];

const CHART_PATH =
  'M0,80 C20,75 40,60 60,65 C80,70 100,45 120,40 C140,35 160,50 180,42 C200,34 220,20 240,15 C260,10 280,18 300,12';

function AnimatedCounter({ target, duration = 1.5 }: { target: number; duration?: number }) {
  const nodeRef = useRef<HTMLSpanElement>(null);
  const motionVal = useMotionValue(0);

  useEffect(() => {
    const controls = animate(motionVal, target, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        if (nodeRef.current) {
          nodeRef.current.textContent = v.toLocaleString('fi-FI', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
        }
      },
    });
    return controls.stop;
  }, [target, duration, motionVal]);

  return <span ref={nodeRef}>0,00</span>;
}

export default function DashboardMockup() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncLabel, setSyncLabel] = useState('synced · just now');
  const [alertVisible, setAlertVisible] = useState(false);

  useEffect(() => {
    // Syncing animation after 2s
    const t1 = setTimeout(() => {
      setIsSyncing(true);
      setSyncLabel('syncing...');
    }, 2000);
    const t2 = setTimeout(() => {
      setIsSyncing(false);
      setSyncLabel('synced · just now');
    }, 3800);
    // Alert badge after 4.5s
    const t3 = setTimeout(() => setAlertVisible(true), 4500);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <section className="relative py-24 px-6">
      {/* Section header */}
      <div className="text-center mb-16">
        <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-white/30 mb-4">
          // LIVE_PREVIEW
        </p>
        <h2 className="text-4xl md:text-5xl font-bold text-white tracking-tight">
          Your portfolio, <span className="text-[#FF8400]">private by default</span>
        </h2>
      </div>

      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="relative bg-[#0F0F0F] border border-white/[0.08] rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 40px 80px rgba(0,0,0,0.6), 0 0 60px rgba(255,132,0,0.04)' }}
        >
          {/* Top gradient accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#FF8400]/50 to-transparent" />

          {/* Mock browser chrome */}
          <div className="flex items-center gap-2 px-5 py-3.5 border-b border-white/[0.06] bg-[#111111]">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
            </div>
            <div className="flex-1 flex justify-center">
              <div className="bg-white/[0.04] border border-white/[0.06] rounded-md px-4 py-1 text-[10px] font-mono text-white/30">
                app.private-ledger.app/dashboard
              </div>
            </div>
            {/* Alert badge in browser bar */}
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={alertVisible ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.5 }}
              transition={{ type: 'spring', bounce: 0.5 }}
              className="flex items-center gap-1 bg-[#FF8400]/10 border border-[#FF8400]/20 rounded-full px-2 py-0.5"
            >
              <Bell className="w-2.5 h-2.5 text-[#FF8400]" />
              <span className="text-[9px] font-mono text-[#FF8400]">1</span>
            </motion.div>
          </div>

          {/* Dashboard content */}
          <div className="p-6">
            {/* Sync status */}
            <div className="flex items-center gap-2 mb-5">
              <motion.div
                animate={isSyncing ? { rotate: 360 } : { rotate: 0 }}
                transition={isSyncing ? { repeat: Infinity, duration: 1, ease: 'linear' } : {}}
              >
                <RefreshCw className="w-3 h-3 text-white/30" />
              </motion.div>
              <span className="text-[10px] font-mono text-white/30 uppercase tracking-[0.1em]">
                {syncLabel}
              </span>
            </div>

            {/* Portfolio value */}
            <div className="mb-6">
              <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-white/30 mb-2">
                Portfolio value
              </p>
              <div className="flex items-end gap-3">
                <span className="text-4xl font-mono font-bold text-white">
                  <AnimatedCounter target={14247.3} duration={1.8} /> €
                </span>
                <span className="text-sm font-mono text-[#B6FFCE] mb-1">↑ +3.2% (24h)</span>
              </div>
            </div>

            {/* Chart */}
            <div className="mb-6 h-[90px] relative">
              <svg viewBox="0 0 300 100" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#FF8400" stopOpacity="0.15" />
                    <stop offset="100%" stopColor="#FF8400" stopOpacity="0" />
                  </linearGradient>
                  <clipPath id="chartClip">
                    <motion.rect
                      x="0" y="0" height="100"
                      initial={{ width: 0 }}
                      whileInView={{ width: 300 }}
                      viewport={{ once: true }}
                      transition={{ duration: 2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </clipPath>
                </defs>
                {/* Fill area */}
                <path
                  d={`${CHART_PATH} L300,100 L0,100 Z`}
                  fill="url(#chartGrad)"
                  clipPath="url(#chartClip)"
                />
                {/* Line */}
                <motion.path
                  d={CHART_PATH}
                  fill="none"
                  stroke="#FF8400"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  clipPath="url(#chartClip)"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                />
              </svg>
            </div>

            {/* Asset rows */}
            <div className="space-y-1">
              {ASSETS.map((asset, i) => (
                <motion.div
                  key={asset.symbol}
                  initial={{ opacity: 0, x: -10 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: 0.8 + i * 0.12, ease: [0.16, 1, 0.3, 1] }}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-[#FF8400]/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-7 h-7 rounded-full bg-[#FF8400]/10 flex items-center justify-center">
                      <span className="text-[9px] font-mono font-bold text-[#FF8400]">
                        {asset.symbol[0]}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white leading-none mb-0.5">{asset.symbol}</p>
                      <p className="text-[10px] font-mono text-white/30">{asset.amount}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white leading-none mb-0.5">
                      {asset.value.toLocaleString('fi-FI')} €
                    </p>
                    <p
                      className={`text-[10px] font-mono flex items-center gap-0.5 justify-end ${
                        asset.change >= 0 ? 'text-[#B6FFCE]' : 'text-[#FF5C33]'
                      }`}
                    >
                      {asset.change >= 0 ? (
                        <TrendingUp className="w-2.5 h-2.5" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5" />
                      )}
                      {asset.change >= 0 ? '+' : ''}{asset.change}%
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Encrypted badge */}
            <div className="mt-5 flex items-center justify-center gap-2 py-2.5 border border-white/[0.05] rounded-lg bg-white/[0.02]">
              <div className="w-1.5 h-1.5 rounded-full bg-[#B6FFCE]" />
              <span className="text-[9px] font-mono uppercase tracking-[0.15em] text-white/30">
                End-to-end encrypted · Server can't read this
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
