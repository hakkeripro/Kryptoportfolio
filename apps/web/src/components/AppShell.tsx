import React from 'react';
import { useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { pageTransition } from '../lib/animations';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="min-h-screen safe-area-top bg-[#111111]">
      <Sidebar />
      <AnimatePresence mode="wait">
        <motion.main
          key={location.pathname}
          variants={pageTransition}
          initial="initial"
          animate="animate"
          exit="exit"
          className="md:ml-60 px-10 py-8 pb-20 md:pb-8 max-w-6xl mx-auto"
        >
          {children}
        </motion.main>
      </AnimatePresence>
      <BottomTabBar />
    </div>
  );
}
