/**
 * Processing Timeline Component
 * Beautiful step-by-step visual timeline
 * Following .cursorrules and Tailwind CSS best practices
 */

'use client';

import { Brain, Mic, Sparkles } from 'lucide-react';
import type { ProcessingStatusResponse } from '@/types';
import { ProcessingStepCard } from './ProcessingStepCard';

interface ProcessingTimelineProps {
  status: ProcessingStatusResponse;
  onRetryStep?: (step: 'transcribe' | 'personality' | 'voice-clone') => void;
  onTriggerStep?: (step: 'transcribe' | 'personality' | 'voice-clone') => void;  // Manual trigger
  userId?: string;  // User ID for trigger buttons
}

export function ProcessingTimeline({ status, onRetryStep, onTriggerStep }: ProcessingTimelineProps) {
  // Safely access steps with fallback to empty object
  const stepsData = status?.steps || {};

  // Check if all individual steps are complete (fallback for incorrect overall_status)
  const allStepsComplete =
    stepsData.transcription?.status === 'complete' &&
    stepsData.personality_analysis?.status === 'complete' &&
    stepsData.voice_cloning?.status === 'complete';

  // Show "Generating Voice" as main step, with transcription hidden but accessible
  const transcriptionComplete = stepsData.transcription?.status === 'complete';
  const transcriptionText = stepsData.transcription?.result?.transcript ?? '';
  
  const steps = [
    {
      key: 'voice_cloning' as const,
      title: 'Generating Voice',
      description: 'Creating your AI voice clone with ElevenLabs',
      icon: <Mic className="w-6 h-6 text-primary-600" />,
      stepData: stepsData.voice_cloning || { status: 'pending' },
      showTranscriptionButton: transcriptionComplete && transcriptionText.length > 0,
      transcriptionText: transcriptionText,
    },
    {
      key: 'personality_analysis' as const,
      title: 'Personality Analysis',
      description: 'Analyzing your speech patterns and personality with GPT-4',
      icon: <Brain className="w-6 h-6 text-primary-600" />,
      stepData: stepsData.personality_analysis || { status: 'pending' },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Overall Progress Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary-50 border border-primary-200 rounded-full">
          <Sparkles className="w-5 h-5 text-primary-600 animate-pulse" />
          <span className="text-sm font-medium text-primary-700">
            {(status?.overall_status === 'complete' || allStepsComplete)
              ? 'Processing Complete!'
              : status?.overall_status === 'failed'
                ? 'Processing Failed'
                : status?.overall_status === 'in_progress'
                  ? 'Processing Your AI...'
                  : status?.overall_status === 'recorded_and_uploaded'
                    ? 'Recorded and Uploaded - Processing Starting Soon...'
                    : 'Waiting to Start'}
          </span>
        </div>
      </div>

      {/* Timeline Steps */}
      <div className="space-y-4">
        {steps.map((step, index) => (
          <div key={step.key} className="relative">
            {/* Connector Line */}
            {index < steps.length - 1 && (
              <div className="absolute left-10 top-24 bottom-0 w-0.5 bg-gray-200 -mb-4" />
            )}

            <ProcessingStepCard
              title={step.title}
              description={step.description}
              step={step.stepData}
              icon={step.icon}
              stepKey={step.key}
              previousStepComplete={
                step.key === 'voice_cloning'
                  ? stepsData.personality_analysis?.status === 'complete'  // Needs personality complete
                  : stepsData.transcription?.status === 'complete'  // Needs transcription complete
              }
              showTranscriptionButton={step.showTranscriptionButton}
              transcriptionText={step.transcriptionText}
              onRetry={() =>
                onRetryStep?.(
                  step.key === 'voice_cloning'
                    ? 'voice-clone'
                    : step.key === 'personality_analysis'
                      ? 'personality'
                      : 'transcribe'
                )
              }
              onTrigger={() =>
                onTriggerStep?.(
                  step.key === 'voice_cloning'
                    ? 'voice-clone'
                    : step.key === 'personality_analysis'
                      ? 'personality'
                      : 'transcribe'
                )
              }
            />
          </div>
        ))}
      </div>
    </div>
  );
}

