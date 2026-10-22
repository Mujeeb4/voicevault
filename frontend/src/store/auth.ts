/**
 * Authentication Store (Zustand)
 * Manages user authentication state and actions
 * Following .cursorrules patterns for state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api/client';
import * as session from '@/lib/auth/session';
import type { User, AuthTokens, LoginRequest, SignupRequest, SignupResponse } from '@/types';
import { getApiErrorMessage } from '@/lib/utils';

let authCheck: Promise<void> | null = null;

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
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
      tokens: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,

      // Login action
      login: async (credentials: LoginRequest) => {
        try {
          set({ isLoading: true, error: null });

          const { data } = await apiClient.post<{
            user: User;
            tokens: AuthTokens;
          }>('/users/login/', credentials);

          // Store tokens in session (which also updates API client)
          const expiresAt = session.decodeTokenExpiry(data.tokens.access);
          session.setTokens({
            access: data.tokens.access,
            refresh: data.tokens.refresh,
            expiresAt: expiresAt || undefined,
          });

          set({
            user: data.user,
            tokens: data.tokens,
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
            tokens: null,
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
            tokens: null,
          });

          throw error;
        }
      },

      // Logout action
      logout: () => {
        // Clear tokens from session (which also clears API client)
        session.clearTokens();

        set({
          user: null,
          tokens: null,
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
          if (session.isSessionIdle() || !session.getAccessToken() || !session.getRefreshToken()) {
            get().logout();
            set({ isLoading: false });
            return;
          }
          set({ isLoading: true });
          try {
            const { data: user } = await apiClient.get<User>('/users/profile/');
            const access = session.getAccessToken();
            const refresh = session.getRefreshToken();
            if (!access || !refresh) {
              get().logout();
              return;
            }
            if (get().isAuthenticated && get().user?.id !== user.id) return;
            set({ user, tokens: { access, refresh }, isAuthenticated: true, error: null });
            session.updateLastActivity();
          } catch (error) {
            if (!session.getAccessToken()) get().logout();
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
        if (!session.getAccessToken()) return;

        try {
          const { data: user } = await apiClient.get<User>('/users/profile/');
          if (session.getAccessToken() && get().user?.id === user.id) set({ user });
        } catch {
          console.error('Failed to refresh user');
        }
      },
    }),
    {
      version: 2,
      migrate: () => ({ user: null, tokens: null, isAuthenticated: false }),
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
      }),
    }
  )
);
