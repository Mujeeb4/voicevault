/**
 * Chat API - streaming messages and conversation history
 */
import apiClient, { API_BASE_URL, CSRF_HEADERS, refreshSession } from './client';
import * as session from '@/lib/auth/session';
import type { Conversation } from '@/types';

const chatBase = '/chat';

export interface StreamingConnection {
  close: () => void;
}

/** Why a message was refused, so the chat can offer credits or an upgrade. */
export interface ChatErrorDetails {
  creditsRequired?: boolean;
  upgradeRequired?: boolean;
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
    onError: (message: string, details?: ChatErrorDetails) => void
  ): StreamingConnection => {
    const url = `${API_BASE_URL}${chatBase}/stream/`;

    const controller = new AbortController();
    let terminal = false;
    const fail = (message: string, details?: ChatErrorDetails) => {
      if (terminal || controller.signal.aborted) return;
      terminal = true;
      onError(message, details);
    };
    const errorDetails = (body: Record<string, unknown>): ChatErrorDetails => ({
      creditsRequired: body.credits_required === true,
      upgradeRequired: body.upgrade_required === true,
    });

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
          terminal = true;
          onComplete(payload.conversation_id as string | undefined);
          break;
        case 'error':
          fail((payload.message as string) ?? 'Unable to generate a reply.', errorDetails(payload));
          break;
      }
    };

    void (async () => {
      try {
        // Session cookies go with the request; the header is required for cookie-authenticated writes
        const request = () => fetch(url, {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
          body: JSON.stringify({ ai_owner_id: params.ai_owner_id, question: params.message }),
          signal: controller.signal,
        });
        let response = await request();
        if (response.status === 401 && session.isSignedIn()) {
          await refreshSession().catch(() => undefined);
          if (session.isSignedIn()) response = await request();
        }
        if (!response.ok || !response.body) {
          if (response.status === 401) session.markSignedOut();
          const error = await response.json().catch(() => ({}));
          fail(error.message ?? error.error ?? error.detail ?? 'Connection failed. Please try again.', errorDetails(error));
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const processEvent = (message: string) => {
          const data = message.split('\n')
            .filter((line) => line.startsWith('data:'))
            .map((line) => line.slice(5).trimStart()).join('\n');
          if (!data || terminal) return;
          try {
            handlePayload(JSON.parse(data));
          } catch {
            fail('Invalid stream response. Please try again.');
          }
        };
        try {
          while (!terminal) {
            const { done, value } = await reader.read();
            buffer += done ? decoder.decode() : decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');
            const messages = buffer.split('\n\n');
            buffer = messages.pop() ?? '';
            for (const message of messages) processEvent(message);
            if (done) {
              if (buffer.trim()) processEvent(buffer);
              if (!terminal) fail('The connection closed before the reply finished. Please try again.');
              break;
            }
          }
        } finally {
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
      } catch {
        fail('Connection failed. Please try again.');
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

  /** Transcribe a spoken question for one AI; the server checks the caller may talk to it. */
  transcribeVoice: async (audioBlob: Blob, aiOwnerId: string): Promise<{ transcript: string }> => {
    const formData = new FormData();
    formData.append('ai_owner_id', aiOwnerId);
    const mime = audioBlob.type.split(';')[0];
    const extension =
      ({
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/x-m4a': 'm4a',
        'audio/m4a': 'm4a',
        'video/mp4': 'mp4',
        'audio/aac': 'aac',
        'audio/mpeg': 'mp3',
        'audio/mp3': 'mp3',
        'audio/wav': 'wav',
        'audio/x-wav': 'wav',
      } as Record<string, string>)[mime.toLowerCase()] ?? 'webm';
    formData.append('audio', audioBlob, `voice-input.${extension}`);
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
