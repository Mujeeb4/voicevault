/**
 * Authentication Store (Zustand)
 * Manages user authentication state and actions
 * Following .cursorrules patterns for state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient, { CSRF_HEADERS } from '@/lib/api/client';
import * as session from '@/lib/auth/session';
import type { User, LoginRequest, SignupRequest, SignupResponse } from '@/types';
import { getApiErrorMessage } from '@/lib/utils';

let authCheck: Promise<void> | null = null;

interface AuthState {
  // State
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<SignupResponse>;
  logout: () => void;
  clearError: () => void;
  checkAuth: () => Promise<void>;
  updateUser: (user: Partial<User>) => void;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      // Initial state
      user: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Login action
      login: async (credentials: LoginRequest) => {
        try {
          set({ isLoading: true, error: null });

          // The API sets httpOnly session cookies; only the user comes back in the body
          const { data } = await apiClient.post<{ user: User }>('/users/login/', credentials);
          session.markSignedIn();

          set({
            user: data.user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const errorMessage = getApiErrorMessage(error, 'Login failed');

          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });

          throw error;
        }
      },

      // Signup action
      signup: async (data: SignupRequest) => {
        try {
          set({ isLoading: true, error: null });

          // Signup no longer logs the user in: they must verify their email first.
          const { data: signupData } = await apiClient.post<SignupResponse>('/users/signup/', data);

          set({ isLoading: false, error: null });
          return signupData;
        } catch (error: unknown) {
          const errorMessage = getApiErrorMessage(error, 'Signup failed');

          set({
            isLoading: false,
            error: errorMessage,
            isAuthenticated: false,
            user: null,
          });

          throw error;
        }
      },

      // Logout action
      logout: () => {
        // Revoke the session server-side (best effort) and clear its cookies, then locally.
        if (session.isSignedIn()) {
          // keepalive lets the request survive the full-page navigation that follows logout.
          fetch('/api/users/logout/', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
            body: JSON.stringify({}),
            keepalive: true,
          }).catch(() => undefined);
        }
        session.markSignedOut();

        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Check authentication status (on app load)
      checkAuth: async () => {
        if (authCheck) return authCheck;
        authCheck = (async () => {
          if (session.isSessionIdle() || !session.isSignedIn()) {
            get().logout();
            set({ isLoading: false });
            return;
          }
          set({ isLoading: true });
          try {
            // Expired cookies are refreshed by the API client before this resolves
            const { data: user } = await apiClient.get<User>('/users/profile/');
            if (!session.isSignedIn()) {
              get().logout();
              return;
            }
            if (get().isAuthenticated && get().user?.id !== user.id) return;
            set({ user, isAuthenticated: true, error: null });
            session.updateLastActivity();
          } catch (error) {
            if (!session.isSignedIn()) get().logout();
            else set({ error: getApiErrorMessage(error, 'Could not verify your session. Please try again.') });
          } finally {
            set({ isLoading: false });
          }
        })().finally(() => { authCheck = null; });
        return authCheck;
      },

      // Update user data (e.g., after profile update)
      updateUser: (userData: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, ...userData },
          });
        }
      },

      // Refresh user data from API (e.g., after processing completes)
      refreshUser: async () => {
        if (!session.isSignedIn()) return;

        try {
          const { data: user } = await apiClient.get<User>('/users/profile/');
          if (session.isSignedIn() && get().user?.id === user.id) set({ user });
        } catch {
          console.error('Failed to refresh user');
        }
      },
    }),
    {
      version: 3,
      migrate: () => ({ user: null, isAuthenticated: false }),
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
      }),
    }
  )
);
