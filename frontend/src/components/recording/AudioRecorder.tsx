/**
 * AudioRecorder Component
 * Real-time waveform visualization during recording
 * Following .cursorrules and best UX practices
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff } from 'lucide-react';
import { drawWaveform } from '@/lib/audio/waveform';
import type { AudioRecorder as AudioRecorderClass } from '@/lib/audio/recorder';
import { useRecordingStore } from '@/store/recording';

interface AudioRecorderProps {
  isRecording: boolean;
  isPaused: boolean;
}

export function AudioRecorder({ isRecording, isPaused }: AudioRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);
  const { audioRecorder } = useRecordingStore();

  // Animate waveform
  useEffect(() => {
    if (!isRecording || isPaused || !canvasRef.current || !audioRecorder) {
      // Stop animation
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }

      // Draw empty waveform
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.fillStyle = '#1f2937';
          ctx.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
      }
      return;
    }

    // Animation loop
    const animate = () => {
      if (!canvasRef.current || !audioRecorder) return;

      const waveformData = audioRecorder.getWaveformData();

      drawWaveform(canvasRef.current, waveformData, {
        width: canvasRef.current.width,
        height: canvasRef.current.height,
        barWidth: 3,
        barGap: 2,
        color: isRecording && !isPaused ? '#3b82f6' : '#6b7280',
        backgroundColor: '#1f2937',
      });

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isRecording, isPaused, audioRecorder]);

  // Set canvas size on mount
  useEffect(() => {
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const parent = canvas.parentElement;
      if (parent) {
        canvas.width = parent.clientWidth;
        canvas.height = 120;
      }
    }
  }, []);

  return (
    <div className="relative">
      {/* Waveform Canvas */}
      <div className="relative rounded-xl overflow-hidden bg-gray-800 border-2 border-gray-700">
        <canvas
          ref={canvasRef}
          className="w-full"
          style={{ display: 'block', height: '120px' }}
        />

        {/* Overlay Status */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {!isRecording && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-gray-700/80 rounded-full flex items-center justify-center mb-2">
                <MicOff className="w-8 h-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-400 font-medium">Ready to record</p>
            </motion.div>
          )}

          {isRecording && isPaused && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-warning-500/20 rounded-full flex items-center justify-center mb-2 border-2 border-warning-500">
                <Mic className="w-8 h-8 text-warning-500" />
              </div>
              <p className="text-sm text-warning-500 font-medium">Paused</p>
            </motion.div>
          )}

          {isRecording && !isPaused && (
            <motion.div
              initial={{ scale: 1 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="absolute top-4 right-4"
            >
              <div className="flex items-center gap-2 bg-error-500/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                <span className="text-xs font-semibold text-white">REC</span>
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Audio Level Indicator */}
      {isRecording && !isPaused && (
        <div className="mt-3">
          <AudioLevelIndicator audioRecorder={audioRecorder} />
        </div>
      )}
    </div>
  );
}

/**
 * Audio Level Indicator Component
 */
function AudioLevelIndicator({ audioRecorder }: { audioRecorder: AudioRecorderClass | null }) {
  const [level, setLevel] = useState(0);

  useEffect(() => {
    if (!audioRecorder) return;

    const interval = setInterval(() => {
      const audioLevel = audioRecorder.getAudioLevel();
      setLevel(audioLevel);
    }, 50); // Update every 50ms

    return () => clearInterval(interval);
  }, [audioRecorder]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs text-gray-400">
        <span>Audio Level</span>
        <span>{Math.round(level * 100)}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-success-500 to-primary-500"
          animate={{ width: `${level * 100}%` }}
          transition={{ duration: 0.1 }}
        />
      </div>
    </div>
  );
}

