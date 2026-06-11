/**
 * Auth API endpoints
 * Following .cursorrules API integration patterns
 */

import apiClient from './client';
import type { User, AuthTokens, LoginRequest, SignupRequest } from '@/types';

interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

export const authApi = {
  /**
   * Login user
   */
  login: async (credentials: LoginRequest): Promise<AuthResponse> => {
    const { data } = await apiClient.post<AuthResponse>('/users/login/', credentials);
    return data;
  },

  /**
   * Sign up new user
   */
  signup: async (data: SignupRequest): Promise<AuthResponse> => {
    const { data: res } = await apiClient.post<AuthResponse>('/users/signup/', data);
    return res;
  },

  /**
   * Logout user
   */
  logout: async (): Promise<void> => {
    await apiClient.post<void>('/users/logout/', {});
  },

  /**
   * Get current user profile
   */
  getProfile: async (): Promise<User> => {
    const { data } = await apiClient.get<User>('/users/profile/');
    return data;
  },

  /**
   * Update user profile
   */
  updateProfile: async (data: Partial<User>): Promise<User> => {
    const { data: res } = await apiClient.patch<User>('/users/profile/', data);
    return res;
  },

  recordConsent: async (
    consentType: 'voice_cloning' | 'ai_personality_generation' | 'family_access' | 'terms_of_service' | 'privacy_policy',
    accepted = true
  ): Promise<{ id: string; accepted: boolean; accepted_at: string | null }> => {
    const { data } = await apiClient.post('/users/consent/', {
      consent_type: consentType,
      accepted,
    });
    return data;
  },

  /**
   * Refresh access token
   */
  refreshToken: async (refreshToken: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<AuthTokens>('/users/refresh/', {
      refresh: refreshToken,
    });
    return data;
  },
};
