/**
 * Auth API endpoints
 * Following .cursorrules API integration patterns
 */

import apiClient from './client';
import type { User, AuthTokens, LoginRequest, SignupRequest, SignupResponse } from '@/types';

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
  signup: async (data: SignupRequest): Promise<SignupResponse> => {
    const { data: res } = await apiClient.post<SignupResponse>('/users/signup/', data);
    return res;
  },

  /**
   * Confirm an email address with the one-time token from the verification email
   */
  verifyEmail: async (token: string): Promise<void> => {
    await apiClient.post('/users/verify-email/', { token });
  },

  /**
   * Request a fresh verification email (response is identical for unknown emails)
   */
  resendVerification: async (email: string): Promise<void> => {
    await apiClient.post('/users/resend-verification/', { email });
  },

  /**
   * Logout user
   */
  logout: async (refresh: string | null, allDevices = false): Promise<void> => {
    if (!refresh) return;
    await apiClient.post<void>('/users/logout/', { refresh, all_devices: allDevices });
  },

  /**
   * Email a one-time reset link (response is identical for unknown emails)
   */
  requestPasswordReset: async (email: string): Promise<void> => {
    await apiClient.post('/users/password-reset/request/', { email });
  },

  confirmPasswordReset: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/users/password-reset/confirm/', { token, new_password: newPassword });
  },

  /**
   * Permanently delete the account after confirming the password
   */
  deleteAccount: async (password: string): Promise<void> => {
    await apiClient.post('/users/delete-account/', { password });
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

  /** Returns fresh tokens: the change revokes every older session. */
  changePassword: async (currentPassword: string, newPassword: string): Promise<AuthTokens> => {
    const { data } = await apiClient.post<{ tokens: AuthTokens }>('/users/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
    return data.tokens;
  },

  recordConsent: async (
    consentType:
      | 'voice_cloning'
      | 'ai_personality_generation'
      | 'family_access'
      | 'terms_of_service'
      | 'privacy_policy',
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
