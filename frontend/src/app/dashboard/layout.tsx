'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { isAuthenticated } from '@/lib/auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.replace('/login');
    }
  }, [router]);

  // Prevent hydration mismatch — only render after client mount
  if (!mounted) {
    return null;
  }

  if (!isAuthenticated()) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="lg:ml-64 transition-[margin] duration-200">
        <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
        <main className="p-3 sm:p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
