/**
 * Review Step Component
 * Review all recordings before upload
 * Following .cursorrules and best UX practices
 */

'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Play, Pause, RotateCcw, Upload, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useRecordingStore } from '@/store/recording';
import { isOptionalReflectionQuestion } from '@/lib/recording/optional-question';
import type { Question, RecordingData } from '@/types';

interface ReviewStepProps {
  onBack: () => void;
  onProceed: () => void;
}

export function ReviewStep({ onBack, onProceed }: ReviewStepProps) {
  const { questions, recordings, skippedQuestionIds, setCurrentIndex } = useRecordingStore();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const totalDuration = Array.from(recordings.values()).reduce((sum, r) => sum + r.duration, 0);
  const guidedQuestions = questions.filter((question) => !isOptionalReflectionQuestion(question.id));
  const minimumRecordedCount = Math.min(10, guidedQuestions.length);
  const completedGuidedCount = guidedQuestions.filter((question) => recordings.has(question.id)).length;
  const skippedGuidedCount = Math.max(0, guidedQuestions.length - completedGuidedCount);
  const canProceed = completedGuidedCount >= minimumRecordedCount;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="journey-card p-6 text-center sm:p-8">
        <p className="journey-kicker">Final check</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground">Review Your Recordings</h1>
        <p className="mx-auto mt-2 max-w-2xl text-muted-foreground">
          Your answers are saved on this browser. Listen, retake anything needed, and upload once at least {minimumRecordedCount} guided answers are recorded.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Recorded Answers" value={`${completedGuidedCount} / ${minimumRecordedCount} minimum`} />
        <StatCard label="Total Duration" value={formatDuration(totalDuration)} />
        <StatCard label="Skipped Questions" value={`${skippedGuidedCount}`} />
      </div>

      {/* Warning if incomplete */}
      {!canProceed && (
        <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 p-4">
          <p className="font-medium text-warning-200">
            Record {minimumRecordedCount - completedGuidedCount} more guided answer{minimumRecordedCount - completedGuidedCount === 1 ? '' : 's'} before uploading.
          </p>
        </div>
      )}

      {canProceed && skippedGuidedCount > 0 && (
        <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
          <p className="font-medium text-primary">
            {skippedGuidedCount} guided question{skippedGuidedCount === 1 ? '' : 's'} will be skipped.
          </p>
          <p className="mt-1 text-sm text-primary/85">
            That is okay. Only your recorded answers are uploaded and used for AI processing.
          </p>
        </div>
      )}

      {/* Recordings List */}
      <div className="journey-card overflow-hidden">
        <div className="border-b border-border p-5">
          <h2 className="font-heading text-xl font-semibold text-foreground">All Recordings</h2>
        </div>

        <div className="divide-y divide-border">
          {questions.map((question, index) => {
            const recording = recordings.get(question.id);
            const isPlaying = playingId === question.id;
            const isOptional = isOptionalReflectionQuestion(question.id);
            const isSkipped = skippedQuestionIds.includes(question.id) || !recording;

            return (
              <RecordingRow
                key={question.id}
                question={question}
                index={index}
                recording={recording}
                isOptional={isOptional}
                isSkipped={isSkipped}
                isPlaying={isPlaying}
                onPlay={() => setPlayingId(question.id)}
                onPause={() => setPlayingId(null)}
                onRetake={() => {
                  setCurrentIndex(index);
                  onBack();
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="sticky bottom-4 z-20 grid gap-3 rounded-lg border border-border bg-background/86 p-3 backdrop-blur-xl sm:static sm:grid-cols-2 sm:border-0 sm:bg-transparent sm:p-0">
        <Button onClick={onBack} variant="outline" size="lg" className="w-full">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back to Recording
        </Button>

        <Button onClick={onProceed} disabled={!canProceed} size="lg" className="w-full shimmer-btn text-primary-foreground">
          <Upload className="w-5 h-5 mr-2" />
          Upload all recordings
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Stat Card Component
 */
function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="journey-card p-5">
      <p className="mb-1 text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * Recording Row Component
 */
function RecordingRow({
  question,
  index,
  recording,
  isOptional,
  isSkipped,
  isPlaying,
  onPlay,
  onPause,
  onRetake,
}: {
  question: Question;
  index: number;
  recording: RecordingData | undefined;
  isOptional: boolean;
  isSkipped: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRetake: () => void;
}) {
  const [audio] = useState(() => (recording ? new Audio(URL.createObjectURL(recording.blob)) : null));

  const handlePlayPause = () => {
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      onPause();
    } else {
      audio.play();
      onPlay();

      audio.onended = () => {
        onPause();
      };
    }
  };

  return (
    <div className="p-4 transition hover:bg-muted/35">
      <div className="flex items-center gap-4">
        {/* Question Number */}
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/12">
          <span className="font-bold text-primary">{index + 1}</span>
        </div>

        {/* Question Text */}
        <div className="flex-1 min-w-0">
          <p className="truncate font-medium text-foreground">{question.question_text}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {isOptional ? 'optional' : question.domain}
            </Badge>
            {recording && (
              <span className="text-xs text-muted-foreground">{formatDuration(recording.duration)}</span>
            )}
            {!recording && isSkipped && (
              <span className="text-xs text-muted-foreground">Skipped</span>
            )}
          </div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {recording ? (
            <>
              <Button onClick={handlePlayPause} size="sm" variant="outline">
                {isPlaying ? (
                  <Pause className="w-4 h-4" />
                ) : (
                  <Play className="w-4 h-4" />
                )}
              </Button>

              <Button onClick={onRetake} size="sm" variant="ghost">
                <RotateCcw className="w-4 h-4" />
              </Button>
            </>
          ) : (
            <span className="text-sm text-muted-foreground">
              Skipped
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Format duration in seconds to MM:SS
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}
