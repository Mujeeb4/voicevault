'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/auth';
import * as session from '@/lib/auth/session';

/**
 * Auth Initializer Component
 * Initializes auth state on app load and sets up idle timeout monitoring
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { checkAuth } = useAuthStore();

  useEffect(() => {
    // Check auth status on mount
    checkAuth();

    // Set up activity listeners to update last activity
    const updateActivity = () => session.updateLastActivity();
    
    // Listen to user activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check for idle timeout periodically (every 5 minutes)
    const idleCheckInterval = setInterval(() => {
      if (session.isSessionIdle()) {
        // Session idle - logout user
        useAuthStore.getState().logout();
        window.location.href = '/login?reason=idle';
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    // Cleanup
    return () => {
      events.forEach((event) => {
        window.removeEventListener(event, updateActivity);
      });
      clearInterval(idleCheckInterval);
    };
  }, [checkAuth]);

  return <>{children}</>;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AuthInitializer>
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </AuthInitializer>
    </QueryClientProvider>
  );
}

