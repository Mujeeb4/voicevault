/**
 * Introduction Step Component
 * Welcome screen with microphone setup
 * Following .cursorrules and best UX practices
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/lib/audio/recorder';

interface IntroStepProps {
  onStart: () => void;
}

export function IntroStep({ onStart }: IntroStepProps) {
  const [micStatus, setMicStatus] = useState<'checking' | 'granted' | 'denied' | 'unavailable'>(
    'checking'
  );
  const [isTestingMic, setIsTestingMic] = useState(false);

  const checkMicrophone = useCallback(async () => {
    try {
      setMicStatus('checking');

      // Check if microphone is available
      const isAvailable = await AudioRecorder.checkMicrophoneAvailable();
      if (!isAvailable) {
        setMicStatus('unavailable');
        return;
      }

      // Check permission
      const permission = await AudioRecorder.getMicrophonePermission();
      if (permission === 'granted') {
        setMicStatus('granted');
      } else if (permission === 'denied') {
        setMicStatus('denied');
      } else {
        // Prompt for permission
        await requestMicrophone();
      }
    } catch {
      console.error('Microphone check failed');
      setMicStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    checkMicrophone();
  }, [checkMicrophone]);

  const requestMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop()); // Stop immediately
      setMicStatus('granted');
    } catch {
      setMicStatus('denied');
    }
  };

  const testMicrophone = async () => {
    setIsTestingMic(true);
    // Simulate microphone test
    await new Promise((resolve) => setTimeout(resolve, 2000));
    setIsTestingMic(false);
  };

  const canStart = micStatus === 'granted';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto"
    >
      {/* Hero Section */}
      <div className="journey-card p-6 text-center sm:p-8">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-lg border border-primary/30 bg-primary/12 glow-amber-sm"
        >
          <Mic className="h-10 w-10 text-primary" />
        </motion.div>

        <p className="journey-kicker">Private recording session</p>
        <h1 className="mt-2 font-heading text-4xl font-semibold text-foreground">
          Let Your Voice Live On
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-lg text-muted-foreground">
          Record your answers, leave and return safely, then upload everything when you are ready.
        </p>
      </div>

      {/* What to Expect */}
      <div className="journey-card mt-6 p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground">What to Expect</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          <FeatureItem
            icon="1"
            title="Guided questions"
            description="Move question by question through family, career, wisdom, and personality prompts."
          />
          <FeatureItem
            icon="2"
            title="Saved drafts"
            description="Each answer is encrypted and stored on this browser until upload."
          />
          <FeatureItem
            icon="3"
            title="Review before upload"
            description="Listen back, retake, then upload all recordings for AI processing."
          />
        </div>
      </div>

      {/* Microphone Setup */}
      <div className="journey-card mt-6 p-6 sm:p-8">
        <h2 className="font-heading text-2xl font-semibold text-foreground">Microphone Setup</h2>

        <MicrophoneStatus status={micStatus} onRetry={checkMicrophone} />

        {micStatus === 'granted' && (
          <div className="mt-6">
            <Button
              onClick={testMicrophone}
              disabled={isTestingMic}
              variant="outline"
              size="lg"
              className="w-full"
            >
              {isTestingMic ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Testing microphone...
                </>
              ) : (
                <>
                  <Mic className="w-5 h-5 mr-2" />
                  Test Microphone
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="mt-6 rounded-lg border border-primary/25 bg-primary/10 p-5">
        <h3 className="font-semibold text-foreground">Tips for Great Recordings</h3>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>Find a quiet place with minimal background noise</li>
          <li>Speak clearly and at a normal pace</li>
          <li>Use headphones to reduce echo</li>
          <li>Take breaks if needed; your progress is saved</li>
        </ul>
      </div>

      {/* Start Button */}
      <div className="sticky bottom-4 z-20 mt-6 rounded-lg border border-border bg-background/86 p-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:p-0">
        <Button onClick={onStart} disabled={!canStart} size="lg" className="w-full shimmer-btn text-primary-foreground sm:mx-auto sm:flex sm:max-w-md">
          {canStart ? (
            <>
              <Mic className="w-5 h-5 mr-2" />
              Start Recording
            </>
          ) : (
            'Please allow microphone access'
          )}
        </Button>
      </div>
    </motion.div>
  );
}

/**
 * Feature Item Component
 */
function FeatureItem({
  icon,
  title,
  description,
}: {
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <div className="journey-card-muted flex h-full items-start gap-4 p-4">
      <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-primary/25 bg-primary/12">
        <span className="text-lg font-bold text-primary">{icon}</span>
      </div>
      <div>
        <h3 className="mb-1 font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

/**
 * Microphone Status Component
 */
function MicrophoneStatus({
  status,
  onRetry,
}: {
  status: 'checking' | 'granted' | 'denied' | 'unavailable';
  onRetry: () => void;
}) {
  const statusConfig = {
    checking: {
      icon: <Loader2 className="w-8 h-8 text-gray-400 animate-spin" />,
      title: 'Checking microphone...',
      description: '',
      color: 'text-gray-600',
      bgColor: 'bg-gray-50',
    },
    granted: {
      icon: <Check className="w-8 h-8 text-success-500" />,
      title: 'Microphone access granted',
      description: "You're all set!",
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    denied: {
      icon: <X className="w-8 h-8 text-error-500" />,
      title: 'Microphone access denied',
      description: 'Please allow microphone access in your browser settings',
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
    unavailable: {
      icon: <AlertCircle className="w-8 h-8 text-warning-500" />,
      title: 'No microphone detected',
      description: 'Please connect a microphone and try again',
      color: 'text-warning-600',
      bgColor: 'bg-warning-50',
    },
  };

  const config = statusConfig[status];

  return (
    <div className={`${config.bgColor} mt-5 rounded-lg border border-border p-5`}>
      <div className="flex items-center gap-4">
        {config.icon}
        <div className="flex-1">
          <p className={`font-semibold ${config.color}`}>{config.title}</p>
          {config.description && (
            <p className="text-sm text-gray-600 mt-1">{config.description}</p>
          )}
        </div>
      </div>

      {(status === 'denied' || status === 'unavailable') && (
        <Button onClick={onRetry} size="sm" className="mt-4">
          Try Again
        </Button>
      )}
    </div>
  );
}
