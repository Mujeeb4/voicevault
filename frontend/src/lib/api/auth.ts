/**
 * Auth API endpoints
 * Following .cursorrules API integration patterns
 */

import apiClient from './client';
import type { User, LoginRequest, SignupRequest, SignupResponse } from '@/types';

/** Sign-in sets httpOnly session cookies; the body carries only the user. */
interface AuthResponse {
  user: User;
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
  logout: async (allDevices = false): Promise<void> => {
    // The refresh token travels as an httpOnly cookie
    await apiClient.post<void>('/users/logout/', { all_devices: allDevices });
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

  /** Revokes every other session; this browser gets fresh session cookies and stays signed in. */
  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await apiClient.post('/users/change-password/', {
      current_password: currentPassword,
      new_password: newPassword,
    });
  },

  recordConsent: async (
    consentType:
      | 'voice_recording'
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
};
