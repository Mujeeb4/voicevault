'use client';

/**
 * Dashboard Layout Component
 * Wrapper with sidebar and header for all dashboard pages
 */

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar, MobileNav } from './Sidebar';
import { Header } from './Header';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  // Check authentication on mount
  useEffect(() => {
    let isMounted = true;

    checkAuth().finally(() => {
      if (isMounted) {
        setHasCheckedAuth(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  // Redirect if not authenticated
  useEffect(() => {
    if (hasCheckedAuth && !isLoading && !isAuthenticated) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname || '/dashboard')}`);
    }
  }, [hasCheckedAuth, isLoading, isAuthenticated, pathname, router]);

  // Loading state
  if (!hasCheckedAuth || isLoading || !user) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading your vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex h-full min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto pb-[calc(5.5rem+env(safe-area-inset-bottom))] lg:pb-0">
          <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</div>
        </main>
      </div>

      <MobileNav />
    </div>
  );
}
