/**
 * Recording Store (Zustand)
 * Manages recording state and actions
 * Following .cursorrules patterns for state management
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Question, RecordingData, RecordingStatus } from '@/types';
import { AudioRecorder } from '@/lib/audio/recorder';
import {
  saveRecording,
  getAllRecordings,
  deleteRecording,
  clearAllRecordings,
} from '@/lib/audio/storage';

interface RecordingState {
  // State
  questions: Question[];
  currentIndex: number;
  recordings: Map<string, RecordingData>; // questionId -> recording
  skippedQuestionIds: string[];
  isRecording: boolean;
  isPaused: boolean;
  currentDuration: number;
  uploadProgress: number;
  status: RecordingStatus;
  audioRecorder: AudioRecorder | null;
  error: string | null;

  // Actions
  setQuestions: (questions: Question[]) => void;
  setCurrentIndex: (index: number) => void;
  nextQuestion: () => void;
  previousQuestion: () => void;
  skipQuestion: (questionId: string) => void;
  clearSkippedQuestion: (questionId: string) => void;

  startRecording: () => Promise<void>;
  stopRecording: () => Promise<{ blob: Blob; duration: number }>;
  pauseRecording: () => void;
  resumeRecording: () => void;

  saveCurrentRecording: (userId: string, questionId: string, data: RecordingData) => Promise<void>;
  deleteRecordingForQuestion: (userId: string, questionId: string) => Promise<void>;
  loadSavedRecordings: (userId: string) => Promise<void>;
  clearAllRecordingsData: (userId: string) => Promise<void>;

  setUploadProgress: (progress: number) => void;
  setStatus: (status: RecordingStatus) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  questions: [],
  currentIndex: 0,
  recordings: new Map(),
  skippedQuestionIds: [],
  isRecording: false,
  isPaused: false,
  currentDuration: 0,
  uploadProgress: 0,
  status: 'idle' as RecordingStatus,
  audioRecorder: null,
  error: null,
};

export const useRecordingStore = create<RecordingState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setQuestions: (questions) => set({ questions }),

      setCurrentIndex: (index) => {
        const { questions } = get();
        if (index >= 0 && index < questions.length) {
          set({ currentIndex: index });
        }
      },

      nextQuestion: () => {
        const { currentIndex, questions } = get();
        if (currentIndex < questions.length - 1) {
          set({ currentIndex: currentIndex + 1 });
        }
      },

      previousQuestion: () => {
        const { currentIndex } = get();
        if (currentIndex > 0) {
          set({ currentIndex: currentIndex - 1 });
        }
      },

      skipQuestion: (questionId: string) => {
        const { skippedQuestionIds, recordings } = get();
        if (recordings.has(questionId)) return;

        set({
          skippedQuestionIds: Array.from(new Set([...skippedQuestionIds, questionId])),
        });
      },

      clearSkippedQuestion: (questionId: string) => {
        const { skippedQuestionIds } = get();
        set({
          skippedQuestionIds: skippedQuestionIds.filter((id) => id !== questionId),
        });
      },

      startRecording: async () => {
        try {
          let { audioRecorder } = get();

          // Initialize recorder if not already done
          if (!audioRecorder) {
            audioRecorder = new AudioRecorder();
            await audioRecorder.initialize();
            set({ audioRecorder });
          }

          audioRecorder.start();
          set({ isRecording: true, isPaused: false, currentDuration: 0, error: null });

          // Update duration every second
          const interval = setInterval(() => {
            const { isRecording, isPaused } = get();
            if (!isRecording || isPaused) {
              clearInterval(interval);
              return;
            }
            set((state) => ({ currentDuration: state.currentDuration + 1 }));
          }, 1000);
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to start recording',
            isRecording: false,
            audioRecorder: null,
          });
          throw error;
        }
      },

      stopRecording: async () => {
        try {
          const { audioRecorder } = get();
          if (!audioRecorder) {
            throw new Error('Recorder not initialized');
          }

          const { blob, duration } = await audioRecorder.stop();
          set({ isRecording: false, isPaused: false, currentDuration: 0, audioRecorder: null });

          return { blob, duration };
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Failed to stop recording',
            isRecording: false,
            audioRecorder: null,
          });
          throw error;
        }
      },

      pauseRecording: () => {
        const { audioRecorder } = get();
        if (audioRecorder) {
          audioRecorder.pause();
          set({ isPaused: true });
        }
      },

      resumeRecording: () => {
        const { audioRecorder } = get();
        if (audioRecorder) {
          audioRecorder.resume();
          set({ isPaused: false });
        }
      },

      saveCurrentRecording: async (userId: string, questionId: string, data: RecordingData) => {
        const { recordings, currentIndex, skippedQuestionIds } = get();
        const newRecordings = new Map(recordings);
        newRecordings.set(questionId, data);

        // Save to IndexedDB
        await saveRecording({
          userId,
          questionId,
          questionNumber: currentIndex + 1,
          blob: data.blob,
          duration: data.duration,
          timestamp: data.timestamp.toISOString(),
        });

        set({
          recordings: newRecordings,
          skippedQuestionIds: skippedQuestionIds.filter((id) => id !== questionId),
        });
      },

      deleteRecordingForQuestion: async (userId: string, questionId: string) => {
        const { recordings } = get();
        const newRecordings = new Map(recordings);
        newRecordings.delete(questionId);

        // Delete from IndexedDB
        await deleteRecording(userId, questionId);

        set({ recordings: newRecordings });
      },

      loadSavedRecordings: async (userId: string) => {
        try {
          const stored = await getAllRecordings(userId);
          const recordings = new Map<string, RecordingData>();

          for (const item of stored) {
            recordings.set(item.questionId, {
              blob: item.blob,
              duration: item.duration,
              timestamp: new Date(item.timestamp),
            });
          }

          set({ recordings });
        } catch {
          console.error('Failed to load saved recordings');
        }
      },

      clearAllRecordingsData: async (userId: string) => {
        await clearAllRecordings(userId);
        set({ recordings: new Map() });
      },

      setUploadProgress: (progress) => set({ uploadProgress: progress }),

      setStatus: (status) => set({ status }),

      setError: (error) => set({ error }),

      reset: () => {
        const { audioRecorder } = get();
        if (audioRecorder) {
          audioRecorder.cleanup();
        }
        set({ ...initialState, audioRecorder: null });
      },
    }),
    {
      name: 'recording-storage',
      partialize: (state) => ({
        // Only persist these fields
        currentIndex: state.currentIndex,
        status: state.status,
        skippedQuestionIds: state.skippedQuestionIds,
      }),
    }
  )
);
