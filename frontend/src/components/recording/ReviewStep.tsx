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
  const { questions, recordings } = useRecordingStore();
  const [playingId, setPlayingId] = useState<string | null>(null);

  const totalDuration = Array.from(recordings.values()).reduce((sum, r) => sum + r.duration, 0);
  const requiredQuestions = questions.filter((question) => !isOptionalReflectionQuestion(question.id));
  const completedRequiredCount = requiredQuestions.filter((question) => recordings.has(question.id)).length;
  const optionalRecorded = questions.some((question) => isOptionalReflectionQuestion(question.id) && recordings.has(question.id));

  const canProceed = completedRequiredCount === requiredQuestions.length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-5xl mx-auto space-y-8"
    >
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Review Your Recordings</h1>
        <p className="text-gray-600">
          Review all your answers below. You can retake any question before uploading.
        </p>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-3 gap-4">
        <StatCard label="Guided Questions" value={`${completedRequiredCount} / ${requiredQuestions.length}`} />
        <StatCard label="Total Duration" value={formatDuration(totalDuration)} />
        <StatCard label="Optional Reflection" value={optionalRecorded ? 'Recorded' : 'Skipped'} />
      </div>

      {/* Warning if incomplete */}
      {!canProceed && (
        <div className="bg-warning-50 border border-warning-200 rounded-lg p-4">
          <p className="text-warning-700 font-medium">
            ⚠️ You need to complete all {requiredQuestions.length} guided questions before uploading. Missing:{' '}
            {requiredQuestions.length - completedRequiredCount}
          </p>
        </div>
      )}

      {/* Recordings List */}
      <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">All Recordings</h2>
        </div>

        <div className="divide-y divide-gray-200">
          {questions.map((question, index) => {
            const recording = recordings.get(question.id);
            const isPlaying = playingId === question.id;
            const isOptional = isOptionalReflectionQuestion(question.id);

            return (
              <RecordingRow
                key={question.id}
                question={question}
                index={index}
                recording={recording}
                isOptional={isOptional}
                isPlaying={isPlaying}
                onPlay={() => setPlayingId(question.id)}
                onPause={() => setPlayingId(null)}
                onRetake={() => onBack()}
              />
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Button onClick={onBack} variant="outline" size="lg" className="flex-1">
          <ChevronLeft className="w-5 h-5 mr-2" />
          Back to Recording
        </Button>

        <Button onClick={onProceed} disabled={!canProceed} size="lg" className="flex-1">
          <Upload className="w-5 h-5 mr-2" />
          Upload Recordings
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
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <p className="text-sm text-gray-600 mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
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
  isPlaying,
  onPlay,
  onPause,
  onRetake,
}: {
  question: Question;
  index: number;
  recording: RecordingData | undefined;
  isOptional: boolean;
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
    <div className="p-4 hover:bg-gray-50 transition">
      <div className="flex items-center gap-4">
        {/* Question Number */}
        <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <span className="font-bold text-primary-600">{index + 1}</span>
        </div>

        {/* Question Text */}
        <div className="flex-1 min-w-0">
          <p className="font-medium text-gray-900 truncate">{question.question_text}</p>
          <div className="flex items-center gap-2 mt-1">
            <Badge variant="outline" className="text-xs">
              {isOptional ? 'optional' : question.domain}
            </Badge>
            {recording && (
              <span className="text-xs text-gray-500">{formatDuration(recording.duration)}</span>
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
            <span className={isOptional ? 'text-sm text-gray-500' : 'text-sm text-error-500'}>
              {isOptional ? 'Skipped' : 'Not recorded'}
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
