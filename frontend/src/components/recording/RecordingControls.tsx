/**
 * Recording Controls Component
 * Start/Stop/Pause buttons with timer
 * Following .cursorrules and best UX practices
 */

'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, Square, Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRecordingStore } from '@/store/recording';

interface RecordingControlsProps {
  maxDuration?: number | null; // in seconds
  onMaxDurationReached?: () => void;
  onStopRecording?: () => Promise<void>;
}

export function RecordingControls({
  maxDuration = 120, // 2 minutes default
  onMaxDurationReached,
  onStopRecording,
}: RecordingControlsProps) {
  const {
    isRecording,
    isPaused,
    currentDuration,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
  } = useRecordingStore();

  // Check max duration
  useEffect(() => {
    if (isRecording && maxDuration && currentDuration >= maxDuration) {
      onMaxDurationReached?.();
    }
  }, [currentDuration, maxDuration, isRecording, onMaxDurationReached]);

  const handleStart = async () => {
    try {
      await startRecording();
    } catch {
      console.error('Failed to start recording');
    }
  };

  const handleStop = async () => {
    try {
      if (onStopRecording) {
        await onStopRecording();
      } else {
        await stopRecording();
      }
    } catch {
      console.error('Failed to stop recording');
    }
  };

  const handlePauseResume = () => {
    if (isPaused) {
      resumeRecording();
    } else {
      pauseRecording();
    }
  };

  return (
    <div className="space-y-4">
      {/* Timer Display */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 bg-gray-100 px-6 py-3 rounded-xl border border-gray-200">
          <span className="text-3xl font-mono font-bold text-gray-900">
            {formatTime(currentDuration)}
          </span>
          {maxDuration ? (
            <>
              <span className="text-gray-400">/</span>
              <span className="text-lg font-mono text-gray-600">{formatTime(maxDuration)}</span>
            </>
          ) : (
            <span className="text-sm font-medium text-gray-500">open ended</span>
          )}
        </div>

        {/* Progress Bar */}
        {maxDuration && (
        <div className="mt-3 max-w-md mx-auto">
          <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${
                currentDuration >= maxDuration
                  ? 'bg-error-500'
                  : currentDuration >= maxDuration * 0.8
                  ? 'bg-warning-500'
                  : 'bg-primary-600'
              }`}
              animate={{ width: `${(currentDuration / maxDuration) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
        )}
      </div>

      {/* Control Buttons */}
      <div className="flex items-center justify-center gap-4">
        {!isRecording ? (
          // Start Button
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button
              onClick={handleStart}
              size="lg"
              className="w-32 h-32 rounded-full bg-error-500 hover:bg-error-600 text-white shadow-lg"
            >
              <div className="flex flex-col items-center gap-2">
                <Mic className="w-12 h-12" />
                <span className="text-sm font-semibold">Start</span>
              </div>
            </Button>
          </motion.div>
        ) : (
          <>
            {/* Pause/Resume Button */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handlePauseResume}
                size="lg"
                variant="outline"
                className="w-20 h-20 rounded-full border-2"
              >
                {isPaused ? (
                  <Play className="w-8 h-8 text-primary-600" />
                ) : (
                  <Pause className="w-8 h-8 text-warning-600" />
                )}
              </Button>
            </motion.div>

            {/* Stop Button */}
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                onClick={handleStop}
                size="lg"
                className="w-32 h-32 rounded-full bg-gray-900 hover:bg-gray-800 text-white shadow-lg"
              >
                <div className="flex flex-col items-center gap-2">
                  <Square className="w-12 h-12 fill-white" />
                  <span className="text-sm font-semibold">Stop</span>
                </div>
              </Button>
            </motion.div>
          </>
        )}
      </div>

      {/* Instructions */}
      <div className="text-center text-sm text-gray-600">
        {!isRecording && <p>Click the microphone to start recording</p>}
        {isRecording && !isPaused && <p>Recording in progress... Click stop when finished</p>}
        {isRecording && isPaused && <p>Recording paused. Click play to resume</p>}
      </div>

      {/* Keyboard Shortcuts Hint */}
      {!isRecording && (
        <div className="text-center">
          <p className="text-xs text-gray-400">
            Tip: Press <kbd className="px-2 py-1 bg-gray-100 rounded border">Space</kbd> to
            start/stop
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
