import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen safe-area-top bg-[#111111]">
      <Sidebar />
      <main className="md:ml-60 px-10 py-8 pb-20 md:pb-8 max-w-6xl mx-auto">{children}</main>
      <BottomTabBar />
    </div>
  );
}
