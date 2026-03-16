import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen safe-area-top bg-[#111111] relative">
      {/* Ambient brand glow — fixed behind all content */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-15%] left-[30%] w-[900px] h-[900px] rounded-full bg-[#FF8400]/[0.05] blur-[220px]" />
        <div className="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] rounded-full bg-[#FF8400]/[0.03] blur-[180px]" />
        <div className="absolute top-[40%] left-[-5%] w-[400px] h-[400px] rounded-full bg-[#FF8400]/[0.02] blur-[160px]" />
      </div>

      <Sidebar />
      {/* pt-[5.5rem] on mobile = 3.5rem header + 2rem gap; md:pt-8 = original spacing on desktop */}
      <main className="relative md:ml-60 px-4 sm:px-6 md:px-10 pt-[5.5rem] md:pt-8 pb-20 md:pb-8">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
