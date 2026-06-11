/**
 * Recording questions API
 */
import apiClient from './client';
import type { Question } from '@/types';

const baseUrl = '/recordings/questions';

export const questionsApi = {
  getActiveQuestions: async (): Promise<Question[]> => {
    const { data } = await apiClient.get(`${baseUrl}/?is_active=true`);
    return data.results ?? data ?? [];
  },

  getQuestions: async (params?: { domain?: string }): Promise<Question[]> => {
    const searchParams = params ? new URLSearchParams(params as Record<string, string>) : '';
    const { data } = await apiClient.get(`${baseUrl}/${searchParams ? '?' + searchParams : ''}`);
    return data.results ?? data ?? [];
  },
};
