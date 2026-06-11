/**
 * Processing status hooks - React Query based
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api/client';
import type { ProcessingStatusResponse } from '@/types';

const processBase = '/admin/process';

async function fetchProcessingStatus(userId: string): Promise<ProcessingStatusResponse> {
  const { data } = await apiClient.get(`${processBase}/status/${userId}/`);
  return data;
}

export function useProcessingStatus(
  userId: string,
  enabled = true,
  refetchInterval?: number
) {
  return useQuery({
    queryKey: ['processing-status', userId],
    queryFn: () => fetchProcessingStatus(userId),
    enabled: !!userId && enabled,
    refetchInterval: refetchInterval ?? false,
  });
}

export function useRetryStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, step }: { userId: string; step: string }) => {
      const stepMap: Record<string, string> = {
        transcribe: 'transcribe',
        personality: 'personality',
        'voice-clone': 'voice-clone',
      };
      const ep = stepMap[step] ?? step;
      await apiClient.post(`${processBase}/${ep}/${userId}/`);
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['processing-status', userId] });
    },
  });
}

export function useTriggerStep() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ userId, step }: { userId: string; step: string }) => {
      const stepMap: Record<string, string> = {
        transcribe: 'transcribe',
        personality: 'personality',
        'voice-clone': 'voice-clone',
      };
      const ep = stepMap[step] ?? step;
      await apiClient.post(`${processBase}/${ep}/${userId}/`);
    },
    onSuccess: (_, { userId }) => {
      queryClient.invalidateQueries({ queryKey: ['processing-status', userId] });
    },
  });
}
