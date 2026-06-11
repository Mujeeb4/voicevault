/**
 * Recordings API - upload and manage audio
 */
import apiClient from './client';
import type { UploadResponse } from '@/types';

const baseUrl = '/recordings';

interface UploadMetadata {
  file_format: 'mp3' | 'webm' | 'wav';
  duration_seconds: number;
  file_size_bytes: number;
  questions_answered?: number;
  recording_date?: string;
  chunk_index?: number;
  total_chunks?: number;
  is_final_chunk?: boolean;
  total_duration_seconds?: number;
}

export const recordingsApi = {
  uploadRecording: async (
    file: File,
    metadata: UploadMetadata,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('audio_file', file);
    formData.append('duration_seconds', String(metadata.duration_seconds));
    formData.append(
      'recording_metadata',
      JSON.stringify({
        questions_answered: metadata.questions_answered ?? 0,
        recording_date: metadata.recording_date ?? new Date().toISOString(),
        file_format: metadata.file_format,
        file_size_bytes: metadata.file_size_bytes,
        chunk_index: metadata.chunk_index ?? 1,
        total_chunks: metadata.total_chunks ?? 1,
        is_final_chunk: metadata.is_final_chunk ?? true,
        total_duration_seconds: metadata.total_duration_seconds ?? metadata.duration_seconds,
      })
    );
    return recordingsApi.upload(formData, onProgress);
  },

  upload: async (
    formData: FormData,
    onProgress?: (percent: number) => void
  ): Promise<UploadResponse> => {
    const { data } = await apiClient.post(`${baseUrl}/upload/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: onProgress
        ? (e) => {
            if (e.total) {
              onProgress(Math.round((e.loaded / e.total) * 100));
            }
          }
        : undefined,
    });
    return {
      recording_id: data.id ?? data.recording_id,
      storage_path: data.storage_path ?? '',
      public_url: data.public_url ?? '',
      status: data.upload_status === 'complete' ? 'complete' : ('pending' as const),
      created_at: data.created_at ?? new Date().toISOString(),
    };
  },

  list: async (): Promise<{ count: number; recordings: Array<Record<string, unknown>> }> => {
    const { data } = await apiClient.get(baseUrl + '/');
    return {
      count: data.count ?? 0,
      recordings: data.recordings ?? data.results ?? [],
    };
  },

  delete: async (recordingId: string): Promise<void> => {
    await apiClient.delete(`${baseUrl}/${recordingId}/`);
  },
};
