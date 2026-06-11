/**
 * Recording Step Component
 * Main recording interface with questions
 * Following .cursorrules and best UX practices
 */

'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useRecordingStore } from '@/store/recording';
import { useAuthStore } from '@/store/auth';
import { QuestionCard } from './QuestionCard';
import { AudioRecorder } from './AudioRecorder';
import { RecordingControls } from './RecordingControls';
import { QuestionStepper } from './QuestionStepper';
import { Button } from '@/components/ui/button';
import { CheckCircle2 } from 'lucide-react';
import { isOptionalReflectionQuestion } from '@/lib/recording/optional-question';

interface RecordingStepProps {
  onComplete: () => void;
}

export function RecordingStep({ onComplete }: RecordingStepProps) {
  const { user } = useAuthStore();
  const {
    questions,
    currentIndex,
    recordings,
    isRecording,
    isPaused,
    nextQuestion,
    previousQuestion,
    saveCurrentRecording,
    stopRecording,
    deleteRecordingForQuestion,
  } = useRecordingStore();

  const [hasRecordedCurrent, setHasRecordedCurrent] = useState(false);

  const currentQuestion = questions[currentIndex];
  const requiredQuestions = questions.filter((question) => !isOptionalReflectionQuestion(question.id));
  const allRequiredQuestionsComplete = requiredQuestions.every((question) => recordings.has(question.id));
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
  const isOptionalReflection = isOptionalReflectionQuestion(currentQuestion?.id);

  // The final reflection is intentionally open-ended; plan-level limits still apply during upload.
  const maxDuration = isOptionalReflection
    ? null
    : isPremium
    ? 600
    : (currentQuestion?.suggested_duration_seconds || 120);

  // Check if current question is recorded
  useEffect(() => {
    if (currentQuestion) {
      setHasRecordedCurrent(recordings.has(currentQuestion.id));
    }
  }, [currentQuestion, recordings]);

  // Handle stop recording
  const handleStopRecording = async () => {
    try {
      const result = await stopRecording();

      if (result && currentQuestion) {
        // Save recording
        await saveCurrentRecording(currentQuestion.id, {
          blob: result.blob,
          duration: result.duration,
          timestamp: new Date(),
        });

        setHasRecordedCurrent(true);
        toast.success('Recording saved!');
      }
    } catch {
      toast.error('Failed to save recording');
      console.error('Stop recording error');
    }
  };

  // Handle next question
  const handleNext = () => {
    nextQuestion();
    setHasRecordedCurrent(false);
  };

  // Handle previous question
  const handlePrevious = () => {
    previousQuestion();
    setHasRecordedCurrent(false);
  };

  // Handle retake
  const handleRetake = async () => {
    if (currentQuestion) {
      await deleteRecordingForQuestion(currentQuestion.id);
      setHasRecordedCurrent(false);
      toast.info('Recording deleted. You can record again.');
    }
  };

  // Handle max duration reached
  const handleMaxDuration = () => {
    if (!maxDuration) return;
    handleStopRecording();
    toast.warning('Maximum duration reached');
  };

  if (!currentQuestion) {
    return <div>Loading questions...</div>;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="max-w-4xl mx-auto space-y-8"
    >
      {/* Question Card */}
      <QuestionCard
        question={currentQuestion}
        questionNumber={currentIndex + 1}
        totalQuestions={questions.length}
      />

      {/* Audio Recorder */}
      <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200">
        <AudioRecorder isRecording={isRecording} isPaused={isPaused} />

        {/* Recording Controls */}
        <div className="mt-8">
          <RecordingControls
            maxDuration={maxDuration}
            onMaxDurationReached={handleMaxDuration}
            onStopRecording={handleStopRecording}
          />
        </div>

        {/* Stop Button (when recording) */}
        {isRecording && (
          <div className="mt-6 text-center">
            <Button onClick={handleStopRecording} size="lg" variant="outline" className="w-full max-w-md">
              Save & Continue
            </Button>
          </div>
        )}
      </div>

      {/* Question Stepper */}
      <QuestionStepper
        onNext={handleNext}
        onPrevious={handlePrevious}
        onRetake={handleRetake}
        canProceed={hasRecordedCurrent}
        canSkip={isOptionalReflection}
      />

      {/* Complete All Questions Button */}
      {allRequiredQuestionsComplete && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-success-500 to-success-600 rounded-xl p-8 text-white text-center shadow-lg"
        >
          <CheckCircle2 className="w-16 h-16 mx-auto mb-4" />
          <h3 className="text-2xl font-bold mb-2">All Questions Complete!</h3>
          <p className="text-success-100 mb-6">
            You&apos;ve recorded the guided questions. Add the optional final reflection if you want, then review your recordings.
          </p>
          <Button
            onClick={onComplete}
            size="lg"
            className="bg-white text-success-600 hover:bg-gray-100"
          >
            Review Recordings
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
