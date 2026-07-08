/**
 * Question Stepper Component
 * Navigation and progress for 30 questions
 * Following .cursorrules and best UX practices
 */

'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Check, SkipForward } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRecordingStore } from '@/store/recording';

interface QuestionStepperProps {
  onNext?: () => void;
  onSkip?: () => void;
  onReview?: () => void;
  onPrevious?: () => void;
  onRetake?: () => void;
  canProceed?: boolean;
  canSkip?: boolean;
  canReview?: boolean;
  minimumRecordedCount?: number;
  completedGuidedCount?: number;
  missingRequiredCount?: number;
}

export function QuestionStepper({
  onNext,
  onSkip,
  onReview,
  onPrevious,
  onRetake,
  canProceed = false,
  canSkip = false,
  canReview = false,
  minimumRecordedCount = 10,
  completedGuidedCount = 0,
  missingRequiredCount = 0,
}: QuestionStepperProps) {
  const { questions, currentIndex, recordings, skippedQuestionIds } = useRecordingStore();

  const currentQuestion = questions[currentIndex];
  const hasRecording = currentQuestion && recordings.has(currentQuestion.id);
  const isSkipped = currentQuestion && skippedQuestionIds.includes(currentQuestion.id);
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const completedCount = Array.from(recordings.keys()).length;
  const skippedCount = skippedQuestionIds.length;
  const primaryDisabled = !isLastQuestion && !canProceed && !canSkip;
  const primaryLabel = isLastQuestion
    ? canReview
      ? 'Review all recordings'
      : `Record ${missingRequiredCount} more`
    : hasRecording
    ? 'Next question'
    : isSkipped
    ? 'Next question'
    : canSkip
    ? 'Skip question'
    : 'Next';
  const handlePrimaryAction = () => {
    if (isLastQuestion) {
      onReview?.();
      return;
    }
    if (!hasRecording && canSkip && !isSkipped) {
      onSkip?.();
      return;
    }
    onNext?.();
  };

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-foreground">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-muted-foreground">
            {completedGuidedCount}/{minimumRecordedCount} needed · {completedCount} recorded · {skippedCount} skipped
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Navigation Buttons */}
      <div className="grid gap-3 sm:grid-cols-3">
        {/* Primary Action */}
        <Button
          onClick={handlePrimaryAction}
          disabled={primaryDisabled}
          size="lg"
          className="order-first w-full sm:order-last"
        >
          {isLastQuestion && canReview ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              {primaryLabel}
            </>
          ) : hasRecording && !isLastQuestion ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              {primaryLabel}
            </>
          ) : !hasRecording && canSkip && !isLastQuestion && !isSkipped ? (
            <>
              <SkipForward className="w-5 h-5 mr-2" />
              {primaryLabel}
            </>
          ) : (
            <>
              {primaryLabel}
              {!isLastQuestion && <ChevronRight className="w-5 h-5 ml-2" />}
            </>
          )}
        </Button>

        {/* Previous Button */}
        <Button
          onClick={onPrevious}
          disabled={isFirstQuestion}
          variant="outline"
          size="lg"
          className="flex-1"
        >
          <ChevronLeft className="w-5 h-5 mr-2" />
          Previous
        </Button>

        {/* Retake Button (if has recording) */}
        {hasRecording ? (
          <Button onClick={onRetake} variant="outline" size="lg" className="flex-1">
            <RotateCcw className="w-5 h-5 mr-2" />
            Retake
          </Button>
        ) : (
          <div className="hidden sm:block" />
        )}
      </div>

      {/* Status Message */}
      <div className="text-center">
        {hasRecording ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 bg-success-50 text-success-700 px-4 py-2 rounded-lg border border-success-200"
          >
            <Check className="w-4 h-4" />
            <span className="text-sm font-medium">Recording saved!</span>
          </motion.div>
        ) : isSkipped ? (
          <p className="text-sm text-muted-foreground">Question skipped. You can still record it before upload.</p>
        ) : isLastQuestion && canReview ? (
          <p className="text-sm font-medium text-success-700">Minimum recordings are saved. Review and upload when ready.</p>
        ) : canSkip ? (
          <p className="text-sm text-muted-foreground">Record this answer or skip it and continue.</p>
        ) : isLastQuestion && !canReview ? (
          <p className="text-sm text-muted-foreground">Use the primary button to jump to a question you can record.</p>
        ) : (
          <p className="text-sm text-muted-foreground">Record your answer to continue</p>
        )}
      </div>

      {/* Question Dots (mobile-friendly) */}
      <div className="hidden md:block">
        <QuestionDots current={currentIndex} total={questions.length} completed={recordings} skipped={skippedQuestionIds} />
      </div>
    </div>
  );
}

/**
 * Question Dots Component
 * Visual indicator of all questions
 */
function QuestionDots({
  current,
  total,
  completed,
  skipped,
}: {
  current: number;
  total: number;
  completed: Map<string, unknown>;
  skipped: string[];
}) {
  const { questions, setCurrentIndex } = useRecordingStore();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => {
        const question = questions[index];
        const isCompleted = question && completed.has(question.id);
        const isSkipped = question && skipped.includes(question.id);
        const isCurrent = index === current;

        return (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className={`w-8 h-8 rounded-full border-2 transition-all ${
              isCurrent
                ? 'border-primary-600 bg-primary-600 text-white scale-110'
                : isCompleted
                ? 'border-success-500 bg-success-500 text-white'
                : isSkipped
                ? 'border-warning-500/50 bg-warning-500/10 text-warning-600'
                : 'border-border bg-background/70 text-muted-foreground hover:border-primary/40'
            }`}
            title={`Question ${index + 1}${isCompleted ? ' (recorded)' : isSkipped ? ' (skipped)' : ''}`}
          >
            {isCompleted && !isCurrent ? (
              <Check className="w-4 h-4 mx-auto" />
            ) : isSkipped && !isCurrent ? (
              <SkipForward className="w-4 h-4 mx-auto" />
            ) : (
              <span className="text-xs font-semibold">{index + 1}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
