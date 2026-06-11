/**
 * Question Stepper Component
 * Navigation and progress for 30 questions
 * Following .cursorrules and best UX practices
 */

'use client';

import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useRecordingStore } from '@/store/recording';

interface QuestionStepperProps {
  onNext?: () => void;
  onPrevious?: () => void;
  onRetake?: () => void;
  canProceed?: boolean;
  canSkip?: boolean;
}

export function QuestionStepper({
  onNext,
  onPrevious,
  onRetake,
  canProceed = false,
  canSkip = false,
}: QuestionStepperProps) {
  const { questions, currentIndex, recordings } = useRecordingStore();

  const currentQuestion = questions[currentIndex];
  const hasRecording = currentQuestion && recordings.has(currentQuestion.id);
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === questions.length - 1;
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const completedCount = Array.from(recordings.keys()).length;

  return (
    <div className="space-y-6">
      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-gray-900">
            Question {currentIndex + 1} of {questions.length}
          </span>
          <span className="text-gray-600">{completedCount} completed</span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between gap-4">
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
        {hasRecording && (
          <Button onClick={onRetake} variant="outline" size="lg" className="flex-1">
            <RotateCcw className="w-5 h-5 mr-2" />
            Retake
          </Button>
        )}

        {/* Next Button */}
        <Button
          onClick={onNext}
          disabled={(!canProceed && !canSkip) || isLastQuestion}
          size="lg"
          className="flex-1"
        >
          {hasRecording ? (
            <>
              <Check className="w-5 h-5 mr-2" />
              Next Question
            </>
          ) : (
            <>
              Next
              <ChevronRight className="w-5 h-5 ml-2" />
            </>
          )}
        </Button>
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
        ) : canSkip ? (
          <p className="text-sm text-gray-500">This final reflection is optional</p>
        ) : (
          <p className="text-sm text-gray-500">Record your answer to continue</p>
        )}
      </div>

      {/* Question Dots (mobile-friendly) */}
      <div className="hidden md:block">
        <QuestionDots current={currentIndex} total={questions.length} completed={recordings} />
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
}: {
  current: number;
  total: number;
  completed: Map<string, unknown>;
}) {
  const { questions, setCurrentIndex } = useRecordingStore();

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {Array.from({ length: total }).map((_, index) => {
        const question = questions[index];
        const isCompleted = question && completed.has(question.id);
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
                : 'border-gray-300 bg-white text-gray-400 hover:border-gray-400'
            }`}
            title={`Question ${index + 1}${isCompleted ? ' (completed)' : ''}`}
          >
            {isCompleted && !isCurrent ? (
              <Check className="w-4 h-4 mx-auto" />
            ) : (
              <span className="text-xs font-semibold">{index + 1}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
