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
import { getApiErrorMessage } from '@/lib/utils';
import { questionsApi } from '@/lib/api/questions';
import { recordingsApi } from '@/lib/api/recordings';
import {
  combineAudioFiles,
  compressToMP3,
  splitAudioToMP3Chunks,
  blobToFile,
  getAudioFormat,
} from '@/lib/audio/compression';
import { createOptionalReflectionQuestion } from '@/lib/recording/optional-question';

// Step Components
import { IntroStep } from '@/components/recording/IntroStep';
import { RecordingStep } from '@/components/recording/RecordingStep';
import { ReviewStep } from '@/components/recording/ReviewStep';
import { UploadStep } from '@/components/recording/UploadStep';

type Step = 'intro' | 'recording' | 'review' | 'upload';
type OrderedRecording = { questionId: string; blob: Blob; duration: number };
type UploadChunk = { recordings: OrderedRecording[]; duration: number };
type PreparedUploadPart = { blob: Blob; duration: number };

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
    clearAllRecordingsData,
  } = useRecordingStore();

  const [currentStep, setCurrentStep] = useState<Step>('intro');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
  const uploadChunkDurationSeconds = 10 * 60;
  const uploadPartMaxBytes = 22 * 1024 * 1024;

  // Load questions and saved recordings
  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) {
        setIsLoading(false);
        return;
      }

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
        await loadSavedRecordings(user.id);

        setIsLoading(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load questions');
        setIsLoading(false);
        toast.error('Failed to load questions');
      }
    };

    loadData();
  }, [setQuestions, loadSavedRecordings, user?.id]);

  // Redirect to processing if recordings are completed but AI is not ready yet
  useEffect(() => {
    if (user && user.recording_completed && !user.ai_ready) {
      router.replace('/processing');
    }
  }, [user, router]);

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
    if (!user?.id) {
      toast.error('Please sign in again before uploading recordings.');
      return;
    }

    const userId = user.id;
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
        .filter((recording): recording is OrderedRecording => Boolean(recording));

      if (orderedRecordings.length === 0) {
        throw new Error('No recordings found');
      }

      const totalDuration = orderedRecordings.reduce((sum, recording) => sum + recording.duration, 0);
      const uploadChunks = createUploadChunks(orderedRecordings, uploadChunkDurationSeconds, uploadPartMaxBytes);
      const totalUploadParts = uploadChunks.reduce(
        (sum, chunk) => sum + estimatePreparedPartCount(chunk, uploadChunkDurationSeconds),
        0
      );
      let uploadedPartIndex = 0;

      for (let index = 0; index < uploadChunks.length; index += 1) {
        const chunk = uploadChunks[index];
        const expectedPartCount = estimatePreparedPartCount(chunk, uploadChunkDurationSeconds);
        const preparationStart = uploadedPartIndex / totalUploadParts;
        const preparationWeight = expectedPartCount / totalUploadParts;

        toast.info(`Preparing part ${uploadedPartIndex + 1} of ${totalUploadParts}...`);
        const preparedParts = await prepareUploadParts(chunk, uploadPartMaxBytes, uploadChunkDurationSeconds, (progress) => {
          setUploadProgress(Math.round((preparationStart + progress * preparationWeight * 0.45) * 100));
        });

        if (preparedParts.length !== expectedPartCount) {
          throw new Error('Could not prepare audio parts consistently. Please try uploading again.');
        }

        for (const part of preparedParts) {
          const partNumber = uploadedPartIndex + 1;
          const partStart = uploadedPartIndex / totalUploadParts;
          const partWeight = 1 / totalUploadParts;
          toast.info(`Uploading part ${partNumber} of ${totalUploadParts}...`);
          const file = blobToFile(part.blob, `recording-part-${partNumber}.${getAudioFormat(part.blob)}`);
          const fileFormat = getAudioFormat(part.blob);

          await recordingsApi.uploadRecording(
            file,
            {
              file_format: fileFormat,
              duration_seconds: part.duration,
              file_size_bytes: file.size,
              questions_answered: orderedRecordings.length,
              recording_date: new Date().toISOString(),
              chunk_index: partNumber,
              total_chunks: totalUploadParts,
              is_final_chunk: partNumber === totalUploadParts,
              total_duration_seconds: totalDuration,
            },
            (progress) => {
              setUploadProgress(Math.round((partStart + (progress / 100) * partWeight) * 100));
            }
          );
          uploadedPartIndex += 1;
        }
      }

      setUploadProgress(100);
      setStatus('complete');
      toast.success('Upload complete!');

      // Cleanup and redirect
      setTimeout(async () => {
        try {
          await clearAllRecordingsData(userId);
        } catch (e) {
          console.error('Failed to clear recordings from IndexedDB:', e);
        }
        resetRecording();
        router.push('/processing');
      }, 2000);
    } catch (err) {
      setStatus('idle');
      toast.error(getApiErrorMessage(err, err instanceof Error ? err.message : 'Upload failed'));
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

async function prepareUploadParts(
  chunk: UploadChunk,
  maxBytes: number,
  segmentSeconds: number,
  onProgress?: (progress: number) => void
): Promise<PreparedUploadPart[]> {
  if (chunk.recordings.length === 1) {
    const recording = chunk.recordings[0];
    if (recording.duration <= segmentSeconds && recording.blob.size <= maxBytes) {
      await assertUploadableAudio(recording.blob);
      onProgress?.(1);
      return [{ blob: recording.blob, duration: recording.duration }];
    }

    const compressedBlob = await compressToMP3(recording.blob, (progress) => onProgress?.(progress * 0.5));
    if (recording.duration <= segmentSeconds && compressedBlob.size <= maxBytes) {
      await assertUploadableAudio(compressedBlob);
      onProgress?.(1);
      return [{ blob: compressedBlob, duration: recording.duration }];
    }

    const splitBlobs = await splitAudioToMP3Chunks(compressedBlob, segmentSeconds, (progress) => {
      onProgress?.(0.5 + progress * 0.5);
    });

    await Promise.all(splitBlobs.map((blob) => assertUploadableAudio(blob)));
    return splitBlobs.map((blob, index) => ({
      blob,
      duration: Math.min(segmentSeconds, Math.max(0, recording.duration - index * segmentSeconds)),
    }));
  }

  const combinedBlob = await combineAudioFiles(chunk.recordings.map((recording) => recording.blob), (progress) => {
    onProgress?.(progress * 0.45);
  });
  const compressedBlob = await compressToMP3(combinedBlob, (progress) => {
    onProgress?.(0.45 + progress * 0.55);
  });

  if (compressedBlob.size > maxBytes) {
    throw new Error('An upload part is still too large after compression. Please try again from a stronger connection.');
  }

  await assertUploadableAudio(compressedBlob);
  return [{ blob: compressedBlob, duration: chunk.duration }];
}

async function assertUploadableAudio(blob: Blob): Promise<void> {
  const header = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  const format = getAudioFormat(blob);
  const isWebm = format === 'webm' && header[0] === 0x1a && header[1] === 0x45 && header[2] === 0xdf && header[3] === 0xa3;
  const isWav = format === 'wav'
    && header[0] === 0x52
    && header[1] === 0x49
    && header[2] === 0x46
    && header[3] === 0x46
    && header[8] === 0x57
    && header[9] === 0x41
    && header[10] === 0x56
    && header[11] === 0x45;
  const isMp3 = format === 'mp3'
    && (
      (header[0] === 0x49 && header[1] === 0x44 && header[2] === 0x33)
      || (header[0] === 0xff && (header[1] & 0xe0) === 0xe0)
    );

  if (!isWebm && !isWav && !isMp3) {
    throw new Error('A saved recording could not be decoded as audio. Please retake that recording before uploading.');
  }
}

function estimatePreparedPartCount(chunk: UploadChunk, segmentSeconds: number): number {
  if (chunk.recordings.length !== 1) {
    return 1;
  }

  return Math.max(1, Math.ceil(chunk.duration / segmentSeconds));
}

function createUploadChunks(
  recordings: OrderedRecording[],
  maxDurationSeconds: number,
  maxBytes: number
): UploadChunk[] {
  const chunks: UploadChunk[] = [];
  let currentChunk: OrderedRecording[] = [];
  let currentDuration = 0;
  let currentBytes = 0;

  for (const recording of recordings) {
    const recordingBytes = recording.blob.size;
    const wouldExceedDuration = currentDuration > 0 && currentDuration + recording.duration > maxDurationSeconds;
    const wouldExceedSize = currentBytes > 0 && currentBytes + recordingBytes > maxBytes;
    if (wouldExceedDuration || wouldExceedSize) {
      chunks.push({ recordings: currentChunk, duration: currentDuration });
      currentChunk = [];
      currentDuration = 0;
      currentBytes = 0;
    }

    currentChunk.push(recording);
    currentDuration += recording.duration;
    currentBytes += recordingBytes;
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
