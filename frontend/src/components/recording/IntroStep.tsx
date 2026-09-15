/**
 * Introduction Step Component
 * Welcome screen with microphone setup
 * Following .cursorrules and best UX practices
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Mic, Check, X, Loader2, AlertCircle, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AudioRecorder } from '@/lib/audio/recorder';

interface IntroStepProps {
  onStart: () => void;
}

type MicrophoneStatusValue = 'checking' | 'prompt' | 'granted' | 'denied' | 'unavailable';
type MicrophoneTestResult = 'idle' | 'listening' | 'success' | 'silent' | 'error';

export function IntroStep({ onStart }: IntroStepProps) {
  const [micStatus, setMicStatus] = useState<MicrophoneStatusValue>('checking');
  const [micMessage, setMicMessage] = useState('');
  const [isTestingMic, setIsTestingMic] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [testResult, setTestResult] = useState<MicrophoneTestResult>('idle');

  const checkMicrophone = useCallback(async () => {
    try {
      setMicStatus('checking');
      setMicMessage('');

      const isAvailable = await AudioRecorder.checkMicrophoneAvailable();
      if (!isAvailable) {
        setMicStatus('unavailable');
        setMicMessage(
          window.isSecureContext
            ? 'No microphone is available, or this browser does not support microphone recording.'
            : 'Microphone access requires a secure HTTPS connection.'
        );
        return;
      }

      const permission = await AudioRecorder.getMicrophonePermission();
      setMicStatus(permission);
    } catch (error) {
      console.error('Microphone check failed', error);
      setMicStatus('unavailable');
      setMicMessage(AudioRecorder.getErrorMessage(error));
    }
  }, []);

  useEffect(() => {
    checkMicrophone();
  }, [checkMicrophone]);

  const requestMicrophone = async () => {
    try {
      setMicStatus('checking');
      setMicMessage('');
      const stream = await AudioRecorder.requestMicrophone();
      stream.getTracks().forEach((track) => track.stop());
      setMicStatus('granted');
    } catch (error) {
      const errorName = (error as { name?: string })?.name;
      setMicStatus(
        errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError'
          ? 'unavailable'
          : 'denied'
      );
      setMicMessage(AudioRecorder.getErrorMessage(error));
    }
  };

  const testMicrophone = async () => {
    try {
      setIsTestingMic(true);
      setTestResult('listening');
      setMicLevel(0);
      setMicMessage('');

      const result = await AudioRecorder.testMicrophone(setMicLevel);
      setMicLevel(result.peakLevel);
      setTestResult(result.signalDetected ? 'success' : 'silent');
      setMicStatus('granted');
    } catch (error) {
      const errorName = (error as { name?: string })?.name;
      setTestResult('error');
      setMicStatus(
        errorName === 'NotFoundError' || errorName === 'DevicesNotFoundError'
          ? 'unavailable'
          : 'denied'
      );
      setMicMessage(AudioRecorder.getErrorMessage(error));
    } finally {
      setIsTestingMic(false);
    }
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

        <MicrophoneStatus
          status={micStatus}
          message={micMessage}
          onRequest={requestMicrophone}
          onRetry={checkMicrophone}
        />

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

            <div className="mt-4" aria-live="polite" role="status">
              {(testResult === 'listening' || testResult === 'success' || testResult === 'silent') && (
                <div className="rounded-lg border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {testResult === 'listening' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : testResult === 'success' ? (
                        <Check className="h-4 w-4 text-success-500" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-warning-500" />
                      )}
                      {testResult === 'listening'
                        ? 'Speak normally — listening now'
                        : testResult === 'success'
                          ? 'Sound detected. Your microphone is working.'
                          : 'Microphone connected, but no sound was detected. Speak louder and try again.'}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      {Math.round(micLevel * 100)}%
                    </span>
                  </div>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-success-500 to-primary-500 transition-[width] duration-75"
                      style={{ width: `${Math.max(testResult === 'listening' ? 2 : 0, micLevel * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {testResult === 'error' && micMessage && (
                <p className="rounded-lg border border-error-500/30 bg-error-500/10 p-3 text-sm text-error-500">
                  {micMessage}
                </p>
              )}
            </div>
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
  message,
  onRequest,
  onRetry,
}: {
  status: MicrophoneStatusValue;
  message: string;
  onRequest: () => void;
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
    prompt: {
      icon: <Volume2 className="w-8 h-8 text-primary" />,
      title: 'Microphone permission needed',
      description: 'Allow access to test your microphone and start recording.',
      color: 'text-foreground',
      bgColor: 'bg-primary/10',
    },
    denied: {
      icon: <X className="w-8 h-8 text-error-500" />,
      title: 'Microphone access denied',
      description: message || 'Please allow microphone access in your browser settings',
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
    unavailable: {
      icon: <AlertCircle className="w-8 h-8 text-warning-500" />,
      title: 'No microphone detected',
      description: message || 'Please connect a microphone and try again',
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

      {status === 'prompt' && (
        <Button onClick={onRequest} size="sm" className="mt-4">
          <Mic className="mr-2 h-4 w-4" />
          Allow Microphone
        </Button>
      )}

      {(status === 'denied' || status === 'unavailable') && (
        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={onRequest} size="sm">Request Access</Button>
          <Button onClick={onRetry} size="sm" variant="outline">Check Again</Button>
        </div>
      )}
    </div>
  );
}
