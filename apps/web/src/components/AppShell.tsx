import React from 'react';
import Sidebar from './Sidebar';
import BottomTabBar from './BottomTabBar';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <Sidebar />
      <main className="md:ml-60 px-page py-6 pb-20 md:pb-6 max-w-6xl">
        {children}
      </main>
      <BottomTabBar />
    </div>
  );
}
