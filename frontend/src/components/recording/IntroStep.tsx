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
      <div className="text-center mb-12">
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring' }}
          className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-6"
        >
          <Mic className="w-12 h-12 text-primary-600" />
        </motion.div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Let Your Voice Live On
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Record your answers. Preserve your story. Give your family the gift of hearing you forever. This will take about 15–30 minutes.
        </p>
      </div>

      {/* What to Expect */}
      <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">What to Expect</h2>

        <div className="space-y-4">
          <FeatureItem
            icon="1"
            title="30 Questions"
            description="Questions about your childhood, career, family, wisdom, and personality"
          />
          <FeatureItem
            icon="2"
            title="Your Pace"
            description="Take your time. You can pause, retake, or come back anytime"
          />
          <FeatureItem
            icon="3"
            title="Private & Secure"
            description="Your recordings are encrypted and only accessible by you and your invited family"
          />
        </div>
      </div>

      {/* Microphone Setup */}
      <div className="bg-white rounded-xl p-8 shadow-lg border border-gray-200 mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Microphone Setup</h2>

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
      <div className="bg-primary-50 border border-primary-200 rounded-xl p-6 mb-8">
        <h3 className="font-semibold text-primary-900 mb-3">Tips for Great Recordings</h3>
        <ul className="space-y-2 text-sm text-primary-700">
          <li>• Find a quiet place with minimal background noise</li>
          <li>• Speak clearly and at a normal pace</li>
          <li>• Use headphones to reduce echo</li>
          <li>• Take breaks if needed - your progress is saved</li>
        </ul>
      </div>

      {/* Start Button */}
      <div className="text-center">
        <Button onClick={onStart} disabled={!canStart} size="lg" className="w-full max-w-md">
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
    <div className="flex items-start gap-4">
      <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center flex-shrink-0">
        <span className="text-lg font-bold text-primary-600">{icon}</span>
      </div>
      <div>
        <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
        <p className="text-sm text-gray-600">{description}</p>
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
    <div className={`${config.bgColor} rounded-lg p-6`}>
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
