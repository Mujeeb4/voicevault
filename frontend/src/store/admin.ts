/**
 * Admin Store (Zustand)
 * Manages admin dashboard, users, questions, and processing
 * Following .cursorrules patterns
 */

import { create } from 'zustand';
import type {
  AdminStats,
  AdminUser,
  Question,
  QuestionFormData,
  AdminProcessingJob,
  ProcessingStatusResponse,
} from '@/types';
import { adminApi } from '@/lib/api/admin';
import { toast } from 'sonner';

interface AdminState {
  // Dashboard State
  stats: AdminStats | null;
  isLoadingStats: boolean;

  // User Management State
  users: AdminUser[];
  selectedUser: AdminUser | null;
  isLoadingUsers: boolean;
  usersTotalCount: number;

  // Question Management State
  questions: Question[];
  selectedQuestion: Question | null;
  isLoadingQuestions: boolean;

  // Processing Monitor State
  processingJobs: AdminProcessingJob[];
  selectedJobStatus: ProcessingStatusResponse | null;
  isLoadingProcessing: boolean;
  processingTotalCount: number;

  // Common State
  error: string | null;
  isLoading: boolean;

  // Dashboard Actions
  loadStats: () => Promise<void>;

  // User Management Actions
  loadUsers: (params?: { page?: number; limit?: number; search?: string; status?: string }) => Promise<void>;
  loadUser: (userId: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<AdminUser>) => Promise<void>;
  deleteUser: (userId: string) => Promise<void>;

  // Question Management Actions
  loadQuestions: () => Promise<void>;
  createQuestion: (data: QuestionFormData) => Promise<void>;
  updateQuestion: (id: string, data: Partial<QuestionFormData>) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  reorderQuestions: (questions: Array<{ id: string; order: number }>) => Promise<void>;
  seedQuestions: () => Promise<void>;
  bulkUpdateQuestions: (questionIds: string[], updates: { is_active: boolean }) => Promise<void>;
  bulkDeleteQuestions: (questionIds: string[]) => Promise<void>;
  exportQuestions: () => Promise<void>;

  // Processing Monitor Actions
  loadProcessingJobs: (params?: { status?: string; page?: number; limit?: number }) => Promise<void>;
  loadProcessingStatus: (userId: string) => Promise<void>;
  triggerFullPipeline: (userId: string) => Promise<void>;
  triggerTranscription: (userId: string) => Promise<void>;
  triggerPersonalityAnalysis: (userId: string) => Promise<void>;
  triggerVoiceCloning: (userId: string) => Promise<void>;
  retryProcessingStep: (userId: string, step: string) => Promise<void>;
  batchProcessPending: () => Promise<void>;
  batchRetryFailed: () => Promise<void>;

  // Common Actions
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  stats: null,
  isLoadingStats: false,
  users: [],
  selectedUser: null,
  isLoadingUsers: false,
  usersTotalCount: 0,
  questions: [],
  selectedQuestion: null,
  isLoadingQuestions: false,
  processingJobs: [],
  selectedJobStatus: null,
  isLoadingProcessing: false,
  processingTotalCount: 0,
  error: null,
  isLoading: false,
};

export const useAdminStore = create<AdminState>()((set, get) => ({
  ...initialState,

  // ============================================================================
  // Dashboard Actions
  // ============================================================================

  loadStats: async () => {
    try {
      set({ isLoadingStats: true, error: null });
      const stats = await adminApi.getStats();
      set({ stats, isLoadingStats: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load stats';
      set({ error: errorMessage, isLoadingStats: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // ============================================================================
  // User Management Actions
  // ============================================================================

  loadUsers: async (params) => {
    try {
      set({ isLoadingUsers: true, error: null });
      const response = await adminApi.getAllUsers(params);
      set({
        users: response.results,
        usersTotalCount: response.count,
        isLoadingUsers: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load users';
      set({ error: errorMessage, isLoadingUsers: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  loadUser: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      const user = await adminApi.getUser(userId);
      set({ selectedUser: user, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load user';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  updateUser: async (userId, updates) => {
    try {
      set({ isLoading: true, error: null });
      const updatedUser = await adminApi.updateUser(userId, updates);
      
      // Update in list
      set((state) => ({
        users: state.users.map((u) => (u.id === userId ? updatedUser : u)),
        selectedUser: state.selectedUser?.id === userId ? updatedUser : state.selectedUser,
        isLoading: false,
      }));
      
      toast.success('User updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update user';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  deleteUser: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.deleteUser(userId);
      
      // Remove from list
      set((state) => ({
        users: state.users.filter((u) => u.id !== userId),
        usersTotalCount: state.usersTotalCount - 1,
        isLoading: false,
      }));
      
      toast.success('User deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete user';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // ============================================================================
  // Question Management Actions
  // ============================================================================

  loadQuestions: async () => {
    try {
      set({ isLoadingQuestions: true, error: null });
      const response = await adminApi.getAllQuestions();
      set({ questions: response.results, isLoadingQuestions: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load questions';
      set({ error: errorMessage, isLoadingQuestions: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  createQuestion: async (data) => {
    try {
      set({ isLoading: true, error: null });
      const newQuestion = await adminApi.createQuestion(data);
      
      // Add to list
      set((state) => ({
        questions: [...state.questions, newQuestion].sort((a, b) => a.order - b.order),
        isLoading: false,
      }));
      
      toast.success('Question created successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create question';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  updateQuestion: async (id, data) => {
    try {
      set({ isLoading: true, error: null });
      const updatedQuestion = await adminApi.updateQuestion(id, data);
      
      // Update in list
      set((state) => ({
        questions: state.questions.map((q) => (q.id === id ? updatedQuestion : q)),
        isLoading: false,
      }));
      
      toast.success('Question updated successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update question';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  deleteQuestion: async (id) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.deleteQuestion(id);
      
      // Remove from list
      set((state) => ({
        questions: state.questions.filter((q) => q.id !== id),
        isLoading: false,
      }));
      
      toast.success('Question deleted successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to delete question';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  reorderQuestions: async (questions) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.reorderQuestions({ questions });
      
      // Reload questions to get updated order
      await get().loadQuestions();
      
      set({ isLoading: false });
      toast.success('Questions reordered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to reorder questions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  seedQuestions: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminApi.seedQuestions();
      
      // Reload questions
      await get().loadQuestions();
      
      set({ isLoading: false });
      toast.success(response.message || `${response.count} questions loaded successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to seed questions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  bulkUpdateQuestions: async (questionIds, updates) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.bulkUpdateQuestions(questionIds, updates);
      
      // Reload questions
      await get().loadQuestions();
      
      set({ isLoading: false });
      toast.success(`${questionIds.length} questions updated successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk update questions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  bulkDeleteQuestions: async (questionIds) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.bulkDeleteQuestions(questionIds);
      
      // Remove from list
      set((state) => ({
        questions: state.questions.filter((q) => !questionIds.includes(q.id)),
        isLoading: false,
      }));
      
      toast.success(`${questionIds.length} questions deleted successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to bulk delete questions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  exportQuestions: async () => {
    try {
      set({ isLoading: true, error: null });
      const blob = await adminApi.exportQuestions();
      
      // Download file
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `questions_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      set({ isLoading: false });
      toast.success('Questions exported successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to export questions';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // ============================================================================
  // Processing Monitor Actions
  // ============================================================================

  loadProcessingJobs: async (params) => {
    try {
      set({ isLoadingProcessing: true, error: null });
      const response = await adminApi.getAllProcessingJobs(params);
      set({
        processingJobs: response.results,
        processingTotalCount: response.count,
        isLoadingProcessing: false,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load processing jobs';
      set({ error: errorMessage, isLoadingProcessing: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  loadProcessingStatus: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      const status = await adminApi.getProcessingStatus(userId);
      set({ selectedJobStatus: status, isLoading: false });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load processing status';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  triggerFullPipeline: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.triggerFullPipeline(userId);
      set({ isLoading: false });
      toast.success('Full AI pipeline triggered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger pipeline';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  triggerTranscription: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.triggerTranscription(userId);
      set({ isLoading: false });
      toast.success('Transcription triggered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger transcription';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  triggerPersonalityAnalysis: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.triggerPersonalityAnalysis(userId);
      set({ isLoading: false });
      toast.success('Personality analysis triggered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger personality analysis';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  triggerVoiceCloning: async (userId) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.triggerVoiceCloning(userId);
      set({ isLoading: false });
      toast.success('Voice cloning triggered successfully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to trigger voice cloning';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  retryProcessingStep: async (userId, step) => {
    try {
      set({ isLoading: true, error: null });
      await adminApi.retryProcessingStep(userId, step);
      set({ isLoading: false });
      toast.success(`Retrying ${step} step...`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to retry processing step';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  batchProcessPending: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminApi.batchProcessPending();
      set({ isLoading: false });
      toast.success(`Triggered processing for ${response.triggered_count} users`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to batch process pending';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  batchRetryFailed: async () => {
    try {
      set({ isLoading: true, error: null });
      const response = await adminApi.batchRetryFailed();
      set({ isLoading: false });
      toast.success(`Retrying ${response.triggered_count} failed jobs`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to batch retry failed';
      set({ error: errorMessage, isLoading: false });
      toast.error(errorMessage);
      throw error;
    }
  },

  // ============================================================================
  // Common Actions
  // ============================================================================

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));

