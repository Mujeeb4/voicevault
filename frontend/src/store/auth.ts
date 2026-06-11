/**
 * Authentication Store (Zustand)
 * Manages user authentication state and actions
 * Following .cursorrules patterns for state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import apiClient from '@/lib/api/client';
import * as session from '@/lib/auth/session';
import type { User, AuthTokens, LoginRequest, SignupRequest } from '@/types';

interface AuthState {
  // State
  user: User | null;
  tokens: AuthTokens | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (credentials: LoginRequest) => Promise<void>;
  signup: (data: SignupRequest) => Promise<void>;
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
      isLoading: false,
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
          const err = error as { response?: { data?: { error?: string; detail?: string } } };
          const errorMessage =
            err.response?.data?.error || err.response?.data?.detail || 'Login failed';

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

          const { data: signupData } = await apiClient.post<{
            user: User;
            tokens: AuthTokens;
          }>('/users/signup/', data);

          // Store tokens in session (which also updates API client)
          const expiresAt = session.decodeTokenExpiry(signupData.tokens.access);
          session.setTokens({
            access: signupData.tokens.access,
            refresh: signupData.tokens.refresh,
            expiresAt: expiresAt || undefined,
          });

          set({
            user: signupData.user,
            tokens: signupData.tokens,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: string; detail?: string } } };
          const errorMessage =
            err.response?.data?.error || err.response?.data?.detail || 'Signup failed';

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
          error: null,
        });
      },

      // Clear error
      clearError: () => {
        set({ error: null });
      },

      // Check authentication status (on app load)
      checkAuth: async () => {
        // Check if session is idle
        if (session.isSessionIdle()) {
          get().logout();
          set({ isLoading: false, isAuthenticated: false });
          return;
        }

        // Get tokens from session (source of truth)
        const accessToken = session.getAccessToken();
        const refreshToken = session.getRefreshToken();

        if (!accessToken || !refreshToken) {
          // Sync Zustand store with session
          set({
            tokens: null,
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return;
        }

        // Sync tokens to Zustand store
        const tokens: AuthTokens = {
          access: accessToken,
          refresh: refreshToken,
        };

        // Check if token needs refresh
        if (session.isTokenExpired()) {
          try {
            // Try to refresh token
            const { data: refreshData } = await apiClient.post<{ access: string }>('/users/refresh/', {
              refresh: refreshToken,
            });

            const expiresAt = session.decodeTokenExpiry(refreshData.access);
            session.setTokens({
              access: refreshData.access,
              refresh: refreshToken,
              expiresAt: expiresAt || undefined,
            });

            tokens.access = refreshData.access;
          } catch (_error) {
            // Refresh failed - logout
            get().logout();
            set({ isLoading: false, isAuthenticated: false });
            return;
          }
        }

        try {
          set({ isLoading: true, tokens });

          // Verify token by fetching user profile
          const { data: profileUser } = await apiClient.get<User>('/users/profile/');

          set({
            user: profileUser,
            tokens,
            isAuthenticated: true,
            isLoading: false,
          });

          // Update last activity
          session.updateLastActivity();
        } catch (_error) {
          // Token is invalid, try refresh one more time
          try {
            const { data: refreshData } = await apiClient.post<{ access: string }>('/users/refresh/', {
              refresh: refreshToken,
            });

            const expiresAt = session.decodeTokenExpiry(refreshData.access);
            session.setTokens({
              access: refreshData.access,
              refresh: refreshToken,
              expiresAt: expiresAt || undefined,
            });

            // Retry profile fetch
            const { data: retryUser } = await apiClient.get<User>('/users/profile/');
            set({
              user: retryUser,
              tokens: { access: refreshData.access, refresh: refreshToken },
              isAuthenticated: true,
              isLoading: false,
            });
          } catch (_refreshError) {
            // Refresh failed - logout
            get().logout();
            set({ isLoading: false, isAuthenticated: false });
          }
        }
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
        const { tokens } = get();
        if (!tokens?.access) return;

        try {
          const { data: user } = await apiClient.get<User>('/users/profile/');
          set({ user });
        } catch {
          console.error('Failed to refresh user');
        }
      },
    }),
    {
      name: 'auth-storage', // localStorage key
      partialize: (state) => ({
        // Only persist these fields
        user: state.user,
        tokens: state.tokens,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
