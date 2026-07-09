/**
 * Chat API - streaming messages and conversation history
 */
import apiClient from './client';
import * as session from '@/lib/auth/session';
import type { Conversation } from '@/types';

const envApiUrl = process.env.NEXT_PUBLIC_API_URL || '';

/** EventSource requires an absolute URL; ensure we never pass a relative or empty base. */
function getStreamBaseUrl(): string {
  const raw = envApiUrl.trim();
  if (raw && (raw.startsWith('http://') || raw.startsWith('https://'))) return raw;

  if (typeof window !== 'undefined') {
    const origin = window.location.origin;
    if (raw) {
      const path = raw.startsWith('/') ? raw : `/${raw}`;
      return `${origin}${path}`;
    }

    return `${origin}/api`;
  }

  return '/api';
}

const chatBase = '/chat';

export interface StreamingConnection {
  close: () => void;
}

interface SendMessageParams {
  ai_owner_id: string;
  family_member_id: string;
  message: string;
}

export const chatApi = {
  getConversations: async (
    aiOwnerId: string,
    familyMemberId?: string
  ): Promise<{ count: number; results: Conversation[] }> => {
    const params = new URLSearchParams({ ai_owner_id: aiOwnerId });
    if (familyMemberId) params.set('family_member_id', familyMemberId);
    const { data } = await apiClient.get(`${chatBase}/conversations/?${params}`);
    return {
      count: data.count ?? 0,
      results: (data.results ?? []).map((c: Record<string, unknown>): Conversation => ({
        id: c.id as string,
        ai_owner: (c.ai_owner as { id: string; full_name: string }) ?? { id: aiOwnerId, full_name: '' },
        family_member: (c.family_member as { id: string; full_name: string }) ?? { id: familyMemberId ?? '', full_name: '' },
        question_text: (c.question ?? c.question_text) as string,
        response_text: (c.response ?? c.response_text) as string,
        audio_url: c.audio_url as string | undefined,
        created_at: (c.created_at as string) ?? '',
        response_time_ms: (c.response_time_ms as number) ?? 0,
        user_rating: c.user_rating as number | undefined,
        user_feedback: c.user_feedback as string | undefined,
      })),
    };
  },

  sendMessageStream: (
    params: SendMessageParams,
    onToken: (token: string) => void,
    onAudioUrl: (url: string, conversationId: string) => void,
    onAudioTask: (taskId: string, conversationId: string) => void,
    onComplete: (conversationId?: string) => void,
    onError: (message: string) => void
  ): StreamingConnection => {
    const token = session.getAccessToken();
    const base = getStreamBaseUrl().replace(/\/$/, '');
    const path = `${chatBase}/stream/`.replace(/^\//, '');
    const url = new URL(path, `${base}/`);

    const controller = new AbortController();

    const handlePayload = (payload: Record<string, unknown>) => {
      switch (payload.type) {
        case 'text_chunk':
          onToken((payload.content as string) ?? '');
          break;
        case 'text_complete':
          break;
        case 'audio_processing':
          onAudioTask((payload.task_id as string) ?? '', (payload.conversation_id as string) ?? '');
          break;
        case 'audio_ready':
          onAudioUrl((payload.audio_url as string) ?? '', (payload.conversation_id as string) ?? '');
          break;
        case 'complete':
          onComplete(payload.conversation_id as string | undefined);
          break;
        case 'error':
          onError((payload.message as string) ?? 'Unknown error');
          break;
      }
    };

    void (async () => {
      try {
        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            ai_owner_id: params.ai_owner_id,
            family_member_id: params.family_member_id,
            question: params.message,
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          onError('Connection failed');
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const messages = buffer.split('\n\n');
          buffer = messages.pop() ?? '';

          for (const message of messages) {
            const dataLine = message.split('\n').find((line) => line.startsWith('data: '));
            if (!dataLine) continue;

            try {
              handlePayload(JSON.parse(dataLine.slice(6)));
            } catch {
              onError('Invalid stream response');
            }
          }
        }
      } catch {
        if (!controller.signal.aborted) onError('Connection failed');
      }
    })();

    return {
      close: () => controller.abort(),
    };
  },

  checkAudioStatus: async (
    taskId: string,
    conversationId?: string
  ): Promise<{ status: string; audio_url?: string; error?: string }> => {
    const params = new URLSearchParams();
    if (conversationId) params.set('conversation_id', conversationId);
    const query = params.toString() ? `?${params}` : '';
    const { data } = await apiClient.get(`${chatBase}/audio-status/${taskId}/${query}`);
    return data;
  },

  transcribeVoice: async (audioBlob: Blob): Promise<{ transcript: string }> => {
    const formData = new FormData();
    formData.append('audio', audioBlob);
    const { data } = await apiClient.post<{ transcript: string }>(`${chatBase}/transcribe-voice/`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return { transcript: data.transcript ?? '' };
  },

  rateConversation: async (
    conversationId: string,
    rating: number,
    feedback?: string
  ): Promise<void> => {
    await apiClient.post(`${chatBase}/conversations/${conversationId}/rate/`, { rating, feedback });
  },
};
