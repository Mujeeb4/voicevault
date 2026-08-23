/**
 * Admin API - users, questions, processing
 * Some endpoints may not exist in backend - stubbed for compatibility
 */
import apiClient from './client';
import type {
  AdminStats,
  AdminUser,
  Question,
  QuestionFormData,
  AdminProcessingJob,
  ProcessingStatusResponse,
  AdminPayment,
  AdminLogEntry,
} from '@/types';

const adminBase = '/admin';
const processBase = `${adminBase}/process`;
const recordingsQuestions = '/recordings/questions';

export function isAdmin(user: { id?: string; email?: string; is_admin?: boolean } | null): boolean {
  if (!user) return false;
  if (user.is_admin) return true;
  // Backend may not have is_staff - check for admin email pattern or env
  const adminEmails = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '').split(',').filter(Boolean);
  if (adminEmails.length && user.email) {
    return adminEmails.some((e) => e.trim().toLowerCase() === user.email?.toLowerCase());
  }
  return false;
}

export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    const { data } = await apiClient.get(`${adminBase}/stats/`);
    return data;
  },

  getAllUsers: async (params?: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
  }): Promise<{ count: number; results: AdminUser[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    if (params?.search) searchParams.set('search', params.search);
    if (params?.status && params.status !== 'all') searchParams.set('status', params.status);
    const { data } = await apiClient.get(`${adminBase}/users/?${searchParams}`);
    return { count: data.count ?? 0, results: data.results ?? [] };
  },

  getUser: async (userId: string): Promise<AdminUser> => {
    const { data } = await apiClient.get(`${adminBase}/users/${userId}/`);
    return data;
  },

  updateUser: async (userId: string, updates: Partial<AdminUser>): Promise<AdminUser> => {
    const { data } = await apiClient.patch(`${adminBase}/users/${userId}/`, updates);
    return data;
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`${adminBase}/users/${userId}/`);
  },

  getAllQuestions: async (): Promise<{ results: Question[] }> => {
    const { data } = await apiClient.get(recordingsQuestions + '/');
    return { results: data.results ?? data ?? [] };
  },

  createQuestion: async (formData: QuestionFormData): Promise<Question> => {
    const { data } = await apiClient.post(`${recordingsQuestions}/create/`, formData);
    return data;
  },

  updateQuestion: async (id: string, formData: Partial<QuestionFormData>): Promise<Question> => {
    const { data } = await apiClient.patch(`${recordingsQuestions}/${id}/update/`, formData);
    return data;
  },

  deleteQuestion: async (id: string): Promise<void> => {
    await apiClient.delete(`${recordingsQuestions}/${id}/delete/`);
  },

  reorderQuestions: async (payload: {
    questions: Array<{ id: string; order: number }>;
  }): Promise<void> => {
    await apiClient.post(`${recordingsQuestions}/reorder/`, payload);
  },

  seedQuestions: async (): Promise<{ message?: string; count?: number }> => {
    const { data } = await apiClient.post(`${recordingsQuestions}/seed/`);
    return data;
  },

  bulkUpdateQuestions: async (
    questionIds: string[],
    updates: { is_active: boolean }
  ): Promise<void> => {
    await apiClient.post(`${recordingsQuestions}/bulk-update/`, {
      question_ids: questionIds,
      ...updates,
    });
  },

  bulkDeleteQuestions: async (questionIds: string[]): Promise<void> => {
    await apiClient.post(`${recordingsQuestions}/bulk-delete/`, { question_ids: questionIds });
  },

  exportQuestions: async (): Promise<Blob> => {
    const { data } = await apiClient.get(`${recordingsQuestions}/export/`, {
      responseType: 'blob',
    });
    return data;
  },

  getAllProcessingJobs: async (params?: {
    status?: string;
    user?: string;
    page?: number;
    limit?: number;
  }): Promise<{ count: number; results: AdminProcessingJob[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.user) searchParams.set('user', params.user);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const { data } = await apiClient.get(`${adminBase}/processing/?${searchParams}`);
    return { count: data.count ?? 0, results: data.results ?? [] };
  },

  getProcessingStatus: async (userId: string): Promise<ProcessingStatusResponse> => {
    const { data } = await apiClient.get(`${processBase}/status/${userId}/`);
    return data;
  },

  triggerFullPipeline: async (userId: string): Promise<void> => {
    await apiClient.post(`${processBase}/full-pipeline/${userId}/`);
  },

  triggerTranscription: async (userId: string): Promise<void> => {
    await apiClient.post(`${processBase}/transcribe/${userId}/`);
  },

  triggerPersonalityAnalysis: async (userId: string): Promise<void> => {
    await apiClient.post(`${processBase}/personality/${userId}/`);
  },

  triggerVoiceCloning: async (userId: string): Promise<void> => {
    await apiClient.post(`${processBase}/voice-clone/${userId}/`);
  },

  retryProcessingStep: async (userId: string, step: string): Promise<void> => {
    const stepMap: Record<string, string> = {
      transcribe: 'transcribe',
      personality: 'personality',
      'voice-clone': 'voice-clone',
    };
    const ep = stepMap[step] ?? step;
    await apiClient.post(`${processBase}/${ep}/${userId}/`);
  },

  batchProcessPending: async (): Promise<{ triggered_count: number }> => {
    const { data } = await apiClient.post(`${adminBase}/batch-process-pending/`);
    return { triggered_count: data.triggered_count ?? 0 };
  },

  batchRetryFailed: async (): Promise<{ triggered_count: number }> => {
    const { data } = await apiClient.post(`${adminBase}/batch-retry-failed/`);
    return { triggered_count: data.triggered_count ?? 0 };
  },

  getPayments: async (params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<{ count: number; results: AdminPayment[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const { data } = await apiClient.get(`${adminBase}/payments/?${searchParams}`);
    return { count: data.count ?? 0, results: data.results ?? [] };
  },

  refundPayment: async (paymentId: string): Promise<AdminPayment> => {
    const { data } = await apiClient.post(`${adminBase}/payments/${paymentId}/refund/`);
    return data.payment;
  },

  getLogs: async (params?: {
    type?: 'failures' | 'audit';
    limit?: number;
  }): Promise<{ count: number; results: AdminLogEntry[] }> => {
    const searchParams = new URLSearchParams();
    if (params?.type) searchParams.set('type', params.type);
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const { data } = await apiClient.get(`${adminBase}/logs/?${searchParams}`);
    return { count: data.count ?? 0, results: data.results ?? [] };
  },
};
