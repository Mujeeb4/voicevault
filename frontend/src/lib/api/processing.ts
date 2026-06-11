/**
 * Processing API endpoints
 * Following .cursorrules API integration patterns
 */

import apiClient from './client';
import type { ProcessingStatusResponse } from '@/types';

export const processingApi = {
  /**
   * Get processing status for a user
   */
  getStatus: async (userId: string): Promise<ProcessingStatusResponse> => {
    const { data } = await apiClient.get<ProcessingStatusResponse>(`/admin/process/status/${userId}/`);
    return data;
  },

  /**
   * Trigger full AI processing pipeline
   */
  triggerFullPipeline: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/process/full-pipeline/${userId}/`,
      {}
    );
    return data;
  },

  /**
   * Retry failed processing step
   */
  retryStep: async (
    userId: string,
    step: 'transcribe' | 'personality' | 'voice-clone'
  ): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/process/${step}/${userId}/`,
      {}
    );
    return data;
  },

  /**
   * Finalize AI configuration (mark as ready)
   */
  finalizeConfig: async (userId: string): Promise<{ success: boolean; message: string }> => {
    const { data } = await apiClient.post<{ success: boolean; message: string }>(
      `/admin/process/finalize/${userId}/`,
      {}
    );
    return data;
  },
};

