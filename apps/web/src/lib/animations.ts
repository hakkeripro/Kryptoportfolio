import type { Variants, Transition } from 'framer-motion';

/* ── Stagger container ── */
export const staggerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

/* ── Fade in + slide up (children) ── */
export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
};

/* ── Page transition ── */
export const pageTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

/* ── Spring config for drawers/modals ── */
export const drawerSpring: Transition = {
  type: 'spring',
  damping: 25,
  stiffness: 300,
};

/* ── Counter spring (KPI animated numbers) ── */
export const counterSpring: Transition = {
  type: 'spring',
  stiffness: 100,
  damping: 30,
};

/* ── Scale on hover (cards) ── */
export const cardHover = {
  rest: { y: 0, transition: { duration: 0.2 } },
  hover: { y: -2, transition: { duration: 0.2 } },
};
