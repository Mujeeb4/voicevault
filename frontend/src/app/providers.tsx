'use client';

import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Toaster } from 'sonner';
import { useAuthStore } from '@/store/auth';
import * as session from '@/lib/auth/session';
import { useChatStore } from '@/store/chat';
import { useFamilyStore } from '@/store/family';
import { useRecordingStore } from '@/store/recording';

/**
 * Auth Initializer Component
 * Initializes auth state on app load and sets up idle timeout monitoring
 */
function AuthInitializer({ children }: { children: React.ReactNode }) {
  const { checkAuth, user } = useAuthStore();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null>(null);

  useEffect(() => {
    const userId = user?.id ?? null;
    if (previousUserId.current !== userId) {
      useChatStore.getState().reset();
      useFamilyStore.getState().reset();
      useRecordingStore.getState().reset();
      queryClient.clear();
      previousUserId.current = userId;
    }
  }, [user?.id, queryClient]);

  useEffect(() => {
    const syncSession = () => {
      const access = session.getAccessToken();
      const refresh = session.getRefreshToken();
      if (!access || !refresh) {
        useAuthStore.setState({ user: null, tokens: null, isAuthenticated: false, isLoading: false });
      } else {
        useAuthStore.setState({ tokens: { access, refresh } });
      }
    };
    window.addEventListener(session.SESSION_CHANGED_EVENT, syncSession);
    const syncExternalSession = (event: StorageEvent) => {
      if (event.key !== null && event.key !== 'voicevault_session') return;
      syncSession();
      void checkAuth();
    };
    window.addEventListener('storage', syncExternalSession);
    void checkAuth();

    // Set up activity listeners to update last activity
    const updateActivity = () => session.updateLastActivity();

    // Listen to user activity events
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((event) => {
      window.addEventListener(event, updateActivity, { passive: true });
    });

    // Check for idle timeout periodically (every 5 minutes)
    const idleCheckInterval = setInterval(() => {
      if (session.getAccessToken() && session.isSessionIdle()) {
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
      window.removeEventListener(session.SESSION_CHANGED_EVENT, syncSession);
      window.removeEventListener('storage', syncExternalSession);
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
        <Toaster position="top-center" />
      </AuthInitializer>
    </QueryClientProvider>
  );
}

