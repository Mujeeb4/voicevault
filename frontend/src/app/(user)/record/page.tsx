/**
 * Recording Page (Protected)
 * 4-step recording flow: Intro → Record → Review → Upload
 * Following FRONTEND_PLAN.md specifications
 */

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth';
import { useRecordingStore } from '@/store/recording';
import { Button } from '@/components/ui/button';
import { questionsApi } from '@/lib/api/questions';
import { recordingsApi } from '@/lib/api/recordings';
import { combineAudioFiles, compressToMP3, blobToFile, getAudioFormat } from '@/lib/audio/compression';
import { createOptionalReflectionQuestion } from '@/lib/recording/optional-question';

// Step Components
import { IntroStep } from '@/components/recording/IntroStep';
import { RecordingStep } from '@/components/recording/RecordingStep';
import { ReviewStep } from '@/components/recording/ReviewStep';
import { UploadStep } from '@/components/recording/UploadStep';

type Step = 'intro' | 'recording' | 'review' | 'upload';

function RecordingContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const {
    questions,
    setQuestions,
    recordings,
    setStatus,
    setUploadProgress,
    reset: resetRecording,
    loadSavedRecordings,
  } = useRecordingStore();

  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
  const uploadChunkDurationSeconds = 20 * 60;

  // Load questions and saved recordings
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Load questions from API
        const guidedQuestions = await questionsApi.getActiveQuestions();
        setQuestions([
          ...guidedQuestions,
          createOptionalReflectionQuestion(guidedQuestions.length + 1),
        ]);

        // Load saved recordings from IndexedDB
        await loadSavedRecordings();

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        setIsLoading(false);
        toast.error('Failed to load questions');
      }
    };

    loadData();
  }, [setQuestions, loadSavedRecordings]);

  const handleStartRecording = () => {
    setCurrentStep('recording');
    setStatus('recording');
  };

  const handleFinishRecording = () => {
    setCurrentStep('review');
    setStatus('reviewing');
  };

  const handleBackToRecording = () => {
    setCurrentStep('recording');
    setStatus('recording');
  };

  const handleStartUpload = async () => {
    setCurrentStep('upload');
    setStatus('uploading');

    try {
      // Upload in ordered chunks so long sessions stay manageable.
      const orderedRecordings = questions
        .map((question) => {
          const recording = recordings.get(question.id);
          return recording
            ? {
                questionId: question.id,
                blob: recording.blob,
                duration: recording.duration,
              }
            : null;
        })
        .filter((recording): recording is { questionId: string; blob: Blob; duration: number } => Boolean(recording));

      if (orderedRecordings.length === 0) {
        throw new Error('No recordings found');
      }

      const totalDuration = orderedRecordings.reduce((sum, recording) => sum + recording.duration, 0);
      const uploadChunks = createUploadChunks(orderedRecordings, uploadChunkDurationSeconds);

      for (let index = 0; index < uploadChunks.length; index += 1) {
        const chunk = uploadChunks[index];
        const chunkStart = index / uploadChunks.length;
        const chunkWeight = 1 / uploadChunks.length;

        toast.info(`Preparing part ${index + 1} of ${uploadChunks.length}...`);
        const combinedBlob = await combineAudioFiles(chunk.recordings.map((recording) => recording.blob), (progress) => {
          setUploadProgress(Math.round((chunkStart + progress * chunkWeight * 0.3) * 100));
        });

        toast.info(`Compressing part ${index + 1} of ${uploadChunks.length}...`);
        const compressedBlob = await compressToMP3(combinedBlob, (progress) => {
          setUploadProgress(Math.round((chunkStart + chunkWeight * 0.3 + progress * chunkWeight * 0.3) * 100));
        });

        toast.info(`Uploading part ${index + 1} of ${uploadChunks.length}...`);
        const file = blobToFile(compressedBlob, `recording-part-${index + 1}.mp3`);
        const fileFormat = getAudioFormat(compressedBlob);

        await recordingsApi.uploadRecording(
          file,
          {
            file_format: fileFormat,
            duration_seconds: chunk.duration,
            file_size_bytes: file.size,
            questions_answered: orderedRecordings.length,
            recording_date: new Date().toISOString(),
            chunk_index: index + 1,
            total_chunks: uploadChunks.length,
            is_final_chunk: index === uploadChunks.length - 1,
            total_duration_seconds: totalDuration,
          },
          (progress) => {
            setUploadProgress(Math.round((chunkStart + chunkWeight * 0.6 + (progress / 100) * chunkWeight * 0.4) * 100));
          }
        );
      }

      setUploadProgress(100);
      setStatus('complete');
      toast.success('Upload complete!');

      // Cleanup and redirect
      setTimeout(() => {
        resetRecording();
        router.push('/processing');
      }, 2000);
    } catch (err) {
      setStatus('idle');
      toast.error(err instanceof Error ? err.message : 'Upload failed');
      console.error('Upload error');
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-lg border border-border bg-card/55 p-5">
        <p className="text-xs font-semibold uppercase text-primary/85">Guided recording</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
          Voice Recording
        </h1>
        <p className="mt-1 text-muted-foreground">{getStepTitle(currentStep)}</p>
        <p className="mt-2 text-sm text-muted-foreground">
          {isPremium
            ? 'Premium includes 30+ questions and up to 5 hours of recordings.'
            : 'Memory Starter includes 5 guided questions and 15 minutes of recording.'}
        </p>
      </div>

      {/* Main Content */}
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState error={error} onRetry={() => window.location.reload()} />
      ) : (
        <AnimatePresence mode="wait">
          {currentStep === 'intro' && (
            <IntroStep key="intro" onStart={handleStartRecording} />
          )}

          {currentStep === 'recording' && (
            <RecordingStep key="recording" onComplete={handleFinishRecording} />
          )}

          {currentStep === 'review' && (
            <ReviewStep
              key="review"
              onBack={handleBackToRecording}
              onProceed={handleStartUpload}
            />
          )}

          {currentStep === 'upload' && <UploadStep key="upload" />}
        </AnimatePresence>
      )}
    </div>
  );
}

function createUploadChunks(
  recordings: Array<{ questionId: string; blob: Blob; duration: number }>,
  maxDurationSeconds: number
): Array<{ recordings: Array<{ questionId: string; blob: Blob; duration: number }>; duration: number }> {
  const chunks: Array<{ recordings: Array<{ questionId: string; blob: Blob; duration: number }>; duration: number }> = [];
  let currentChunk: Array<{ questionId: string; blob: Blob; duration: number }> = [];
  let currentDuration = 0;

  for (const recording of recordings) {
    const wouldExceedDuration = currentDuration > 0 && currentDuration + recording.duration > maxDurationSeconds;
    if (wouldExceedDuration) {
      chunks.push({ recordings: currentChunk, duration: currentDuration });
      currentChunk = [];
      currentDuration = 0;
    }

    currentChunk.push(recording);
    currentDuration += recording.duration;
  }

  if (currentChunk.length > 0) {
    chunks.push({ recordings: currentChunk, duration: currentDuration });
  }

  return chunks;
}

export default function RecordingPage() {
  return <RecordingContent />;
}

/**
 * Get step title for header
 */
function getStepTitle(step: Step): string {
  const titles = {
    intro: 'Getting Started',
    recording: 'Recording Your Answers',
    review: 'Review Your Recordings',
    upload: 'Uploading...',
  };
  return titles[step];
}

/**
 * Loading State
 */
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="mb-4 h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
      />
      <p className="text-muted-foreground">Loading questions...</p>
    </div>
  );
}

/**
 * Error State
 */
function ErrorState({ error, onRetry }: { error: string; onRetry: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="max-w-md mx-auto text-center py-20"
    >
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-destructive/12">
        <AlertCircle className="w-8 h-8 text-error-500" />
      </div>
      <h2 className="mb-2 text-2xl font-bold text-foreground">Something Went Wrong</h2>
      <p className="mb-6 text-muted-foreground">{error}</p>
      <Button onClick={onRetry} size="lg">
        Try Again
      </Button>
    </motion.div>
  );
}
