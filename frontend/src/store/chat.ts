/**
 * Chat Store (Zustand)
 * Manages chat state with streaming support
 * Following .cursorrules patterns and CIA Triad principles
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Conversation } from '@/types';
import { VoicePlayer } from '@/lib/audio/player';
import { chatApi, type StreamingConnection } from '@/lib/api/chat';

const AUDIO_POLL_INTERVAL_MS = 2000;
const AUDIO_POLL_MAX_ATTEMPTS = 90;

interface ChatState {
  // State
  aiOwnerId: string | null;
  familyMemberId: string | null;
  conversations: Conversation[];
  currentMessage: string;
  isStreaming: boolean;
  streamingText: string;
  audioQueue: string[];
  isAudioPlaying: boolean;
  processingAudioIds: string[];
  currentAudioId: string | null;
  currentTime: number;
  duration: number;
  volume: number;
  audioErrors: Record<string, string>;
  readyAudioUrls: Record<string, string>;
  error: string | null;
  voicePlayer: VoicePlayer | null;
  eventSource: StreamingConnection | null;

  // Actions
  setAIOwner: (id: string) => void;
  setFamilyMember: (id: string) => void;
  setCurrentMessage: (message: string) => void;
  loadConversations: () => Promise<void>;
  sendMessage: (message: string) => Promise<void>;
  pollAudioStatus: (taskId: string, conversationId: string) => Promise<void>;
  rateConversation: (id: string, rating: number, feedback?: string) => Promise<void>;
  clearError: () => void;
  stopStreaming: () => void;
  playAudio: (url: string, id: string) => void;
  pauseAudio: () => void;
  resumeAudio: () => void;
  stopAudio: () => void;
  seekAudio: (time: number) => void;
  setVolume: (volume: number) => void;
  ensureVoicePlayer: () => VoicePlayer;
  queueAudio: (url: string, id: string) => void;
  reset: () => void;
}

const initialState = {
  aiOwnerId: null,
  familyMemberId: null,
  conversations: [],
  currentMessage: '',
  isStreaming: false,
  streamingText: '',
  audioQueue: [],
  isAudioPlaying: false,
  processingAudioIds: [],
  currentAudioId: null,
  currentTime: 0,
  duration: 0,
  volume: 1,
  audioErrors: {} as Record<string, string>,
  readyAudioUrls: {} as Record<string, string>,
  error: null,
  voicePlayer: null,
  eventSource: null,
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setAIOwner: (id) => set({ aiOwnerId: id }),

      setFamilyMember: (id) => set({ familyMemberId: id }),

      setCurrentMessage: (message) => set({ currentMessage: message }),

      ensureVoicePlayer: () => {
        const existing = get().voicePlayer;
        if (existing) return existing;
        const player = new VoicePlayer({
          onSelect: (id) => set(state => ({
            currentAudioId: id, isAudioPlaying: false, currentTime: 0, duration: 0,
            audioErrors: { ...state.audioErrors, [id]: '' },
          })),
          onPlay: (id) => set(state => ({
            isAudioPlaying: true, currentAudioId: id,
            audioErrors: { ...state.audioErrors, [id]: '' },
          })),
          onPause: (id) => {
            if (get().currentAudioId === id) set({ isAudioPlaying: false });
          },
          onTimeUpdate: (currentTime, duration) => set({ currentTime, duration }),
          onComplete: (id) => {
            if (get().currentAudioId === id) set({ isAudioPlaying: false });
          },
          onError: (message, id) => {
            if (get().currentAudioId === id) {
              set(state => ({ isAudioPlaying: false, audioErrors: { ...state.audioErrors, [id]: message } }));
            }
          },
        });
        player.setVolume(get().volume);
        set({ voicePlayer: player });
        return player;
      },

      queueAudio: (url, id) => {
        set(state => ({
          readyAudioUrls: { ...state.readyAudioUrls, [id]: url },
          conversations: state.conversations.map(c => c.id === id ? { ...c, audio_url: url } : c),
          processingAudioIds: state.processingAudioIds.filter(value => value !== id),
        }));
        get().ensureVoicePlayer().addToQueue(url, id);
      },

      loadConversations: async () => {
        try {
          const { aiOwnerId, familyMemberId } = get();

          if (!aiOwnerId) {
            throw new Error('AI Owner not set');
          }

          const response = await chatApi.getConversations(
            aiOwnerId,
            familyMemberId || undefined
          );
          set(state => ({
            conversations: response.results.map(c => ({
              ...c, audio_url: c.audio_url || state.readyAudioUrls[c.id],
            })),
            error: null,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to load conversations' });
          throw error;
        }
      },

      pollAudioStatus: async (taskId: string, conversationId: string) => {
        // Add to processing set
        set(state => ({
          processingAudioIds: state.processingAudioIds.includes(conversationId)
            ? state.processingAudioIds
            : [...state.processingAudioIds, conversationId],
        }));

        const check = async (attempt = 1) => {
          try {
            const existingConversation = get().conversations.find((c) => c.id === conversationId);
            if (existingConversation?.audio_url) {
              get().queueAudio(existingConversation.audio_url, conversationId);
              return;
            }

            const status = await chatApi.checkAudioStatus(taskId, conversationId);

            if (status.status === 'complete' && status.audio_url) {
              get().queueAudio(status.audio_url, conversationId);
            } else if (status.status === 'processing' || status.status === 'pending') {
              if (attempt >= AUDIO_POLL_MAX_ATTEMPTS) {
                await get().loadConversations().catch(() => undefined);
                set(state => ({
                  processingAudioIds: state.processingAudioIds.filter(id => id !== conversationId),
                }));
                return;
              }

              setTimeout(() => check(attempt + 1), AUDIO_POLL_INTERVAL_MS);
            } else {
              // Failed or unknown - stop processing
              console.warn(status.error || 'Audio generation failed');
              set(state => ({ processingAudioIds: state.processingAudioIds.filter(id => id !== conversationId) }));
            }
          } catch {
            console.error('Audio polling failed');
            // Remove from processing on error
            set(state => ({ processingAudioIds: state.processingAudioIds.filter(id => id !== conversationId) }));
          }
        };

        // Start polling
        check();
      },

      sendMessage: async (message: string) => {
        const { aiOwnerId, familyMemberId, eventSource } = get();

        if (!aiOwnerId || !familyMemberId) {
          throw new Error('Missing required IDs');
        }

        // Validate message (Integrity - CIA)
        if (message.trim().length === 0) {
          throw new Error('Message cannot be empty');
        }

        if (message.length > 500) {
          throw new Error('Message too long (max 500 characters)');
        }

        // Stop any existing stream
        if (eventSource) {
          eventSource.close();
        }

        set({
          isStreaming: true,
          streamingText: '',
          error: null,
          currentMessage: '',
        });

        try {
          const source = chatApi.sendMessageStream(
            { ai_owner_id: aiOwnerId, family_member_id: familyMemberId, message },
            (token) => {
              // Append streaming token
              set((state) => ({ streamingText: state.streamingText + token }));
            },
            (audioUrl, conversationId) => {
              get().queueAudio(audioUrl, conversationId);
            },
            (taskId, conversationId) => {
              // Handle async audio processing
              if (taskId && conversationId) {
                get().pollAudioStatus(taskId, conversationId);
              }
            },
            (conversationId) => {
              // Streaming complete
              const { streamingText } = get();
              const realId = conversationId || Date.now().toString();

              // Add to conversations (optimistic update turned real)
              set((state) => ({
                isStreaming: false,
                streamingText: '',
                conversations: [
                  {
                    id: realId,
                    ai_owner: { id: aiOwnerId, full_name: state.conversations[0]?.ai_owner?.full_name || '' },
                    family_member: { id: familyMemberId, full_name: state.conversations[0]?.family_member?.full_name || '' },
                    question_text: message,
                    response_text: streamingText,
                    audio_url: state.readyAudioUrls[realId],
                    created_at: new Date().toISOString(),
                    response_time_ms: 0,
                  } as Conversation,
                  ...state.conversations,
                ],
              }));

              // Reload conversations after a delay to ensure DB consistency
              // This prevents the "disappearing message" issue if read replica is lagging
              setTimeout(() => {
                get().loadConversations();
              }, 2000);
            },
            (error) => {
              // Error occurred
              set({ isStreaming: false, streamingText: '', error });
            }
          );

          set({ eventSource: source });
        } catch (error) {
          set({
            isStreaming: false,
            streamingText: '',
            error: error instanceof Error ? error.message : 'Failed to send message',
          });
          throw error;
        }
      },

      rateConversation: async (id, rating, feedback) => {
        try {
          await chatApi.rateConversation(id, rating, feedback);

          // Update local conversation
          set((state) => ({
            conversations: state.conversations.map((conv) =>
              conv.id === id ? { ...conv, user_rating: rating, user_feedback: feedback } : conv
            ),
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Failed to rate conversation' });
          throw error;
        }
      },

      clearError: () => set({ error: null }),

      stopStreaming: () => {
        const { eventSource } = get();
        if (eventSource) {
          eventSource.close();
        }
        set({ isStreaming: false, streamingText: '', eventSource: null });
      },

      playAudio: (url, id) => {
        get().ensureVoicePlayer().play(url, id);
      },

      pauseAudio: () => {
        const { voicePlayer } = get();
        voicePlayer?.pause();
        set({ isAudioPlaying: false });
      },

      resumeAudio: () => {
        const { voicePlayer } = get();
        voicePlayer?.resume();
      },

      stopAudio: () => {
        const { voicePlayer } = get();
        voicePlayer?.stop();
        set({ isAudioPlaying: false, currentAudioId: null, audioQueue: [], currentTime: 0, duration: 0 });
      },

      seekAudio: (time: number) => {
        const { voicePlayer } = get();
        voicePlayer?.seek(time);
        set({ currentTime: time });
      },

      setVolume: (volume: number) => {
        set({ volume });
        const { voicePlayer } = get();
        voicePlayer?.setVolume(volume);
      },

      reset: () => {
        const { voicePlayer, eventSource } = get();
        voicePlayer?.stop();
        eventSource?.close();
        set({ ...initialState, voicePlayer: null, eventSource: null });
      },
    }),
    {
      name: 'chat-storage',
      partialize: (state) => ({
        // Only persist these fields (Confidentiality - CIA)
        aiOwnerId: state.aiOwnerId,
        familyMemberId: state.familyMemberId,
      }),
    }
  )
);
