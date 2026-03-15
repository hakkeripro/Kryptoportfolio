import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen safe-area-top noise-overlay">
      {/* Ambient background orbs */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-brand/[0.04] blur-3xl animate-float"
        />
        <div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-brand/[0.03] blur-3xl animate-float"
          style={{ animationDelay: '-3s', animationDuration: '8s' }}
        />
      </div>

      <Sidebar />
      <main className="md:ml-60 px-page py-6 pb-20 md:pb-6 max-w-6xl mx-auto">{children}</main>
      <BottomTabBar />
    </div>
  );
}
