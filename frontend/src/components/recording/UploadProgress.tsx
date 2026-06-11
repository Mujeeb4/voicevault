/**
 * Upload Progress Component
 * Shows upload progress with detailed stats
 * Following .cursorrules and best UX practices
 */

'use client';

import { motion } from 'framer-motion';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';

interface UploadProgressProps {
  progress: number; // 0-100
  status: 'idle' | 'combining' | 'compressing' | 'uploading' | 'complete' | 'error';
  fileSize?: number; // in bytes
  uploadSpeed?: number; // in bytes per second
  error?: string | null;
  onRetry?: () => void;
}

export function UploadProgress({
  progress,
  status,
  fileSize,
  uploadSpeed,
  error,
  onRetry,
}: UploadProgressProps) {
  const statusConfig = {
    idle: {
      icon: <Upload className="w-12 h-12 text-gray-400" />,
      title: 'Ready to Upload',
      description: '',
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
    },
    combining: {
      icon: <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />,
      title: 'Combining Recordings...',
      description: 'Merging all your answers into one file',
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    compressing: {
      icon: <Loader2 className="w-12 h-12 text-primary-600 animate-spin" />,
      title: 'Compressing Audio...',
      description: 'Optimizing file size for upload',
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    uploading: {
      icon: <Upload className="w-12 h-12 text-primary-600 animate-pulse" />,
      title: 'Uploading...',
      description: 'Sending your recordings to our servers',
      color: 'text-primary-600',
      bgColor: 'bg-primary-50',
    },
    complete: {
      icon: <CheckCircle2 className="w-12 h-12 text-success-500" />,
      title: 'Upload Complete!',
      description: 'Your recordings have been uploaded successfully',
      color: 'text-success-600',
      bgColor: 'bg-success-50',
    },
    error: {
      icon: <AlertCircle className="w-12 h-12 text-error-500" />,
      title: 'Upload Failed',
      description: error || 'An error occurred during upload',
      color: 'text-error-600',
      bgColor: 'bg-error-50',
    },
  };

  const config = statusConfig[status];
  const isProcessing = ['combining', 'compressing', 'uploading'].includes(status);
  const timeRemaining = uploadSpeed && fileSize ? calculateTimeRemaining(progress, fileSize, uploadSpeed) : null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-2xl p-8 shadow-lg border border-gray-200"
    >
      {/* Icon and Status */}
      <div className="text-center mb-6">
        <motion.div
          className={`inline-flex items-center justify-center w-24 h-24 rounded-full ${config.bgColor} mb-4`}
          animate={status === 'complete' ? { scale: [1, 1.2, 1] } : {}}
          transition={{ duration: 0.5 }}
        >
          {config.icon}
        </motion.div>

        <h3 className={`text-2xl font-bold ${config.color} mb-2`}>{config.title}</h3>

        {config.description && (
          <p className="text-gray-600">{config.description}</p>
        )}
      </div>

      {/* Progress Bar */}
      {isProcessing && (
        <div className="space-y-3 mb-6">
          <Progress value={progress} className="h-3" />

          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-gray-900">{progress}%</span>

            {timeRemaining && (
              <span className="text-gray-600">
                {timeRemaining < 60
                  ? `${timeRemaining}s remaining`
                  : `${Math.ceil(timeRemaining / 60)}m remaining`}
              </span>
            )}
          </div>
        </div>
      )}

      {/* File Stats */}
      {fileSize && status === 'uploading' && (
        <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mb-6">
          <div>
            <p className="text-xs text-gray-500 mb-1">File Size</p>
            <p className="font-semibold text-gray-900">{formatBytes(fileSize)}</p>
          </div>

          {uploadSpeed && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Upload Speed</p>
              <p className="font-semibold text-gray-900">{formatBytes(uploadSpeed)}/s</p>
            </div>
          )}
        </div>
      )}

      {/* Success Message */}
      {status === 'complete' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-success-50 border border-success-200 rounded-lg p-4 text-center"
        >
          <p className="text-sm text-success-700 font-medium">
            ✨ Your AI is now being processed! This usually takes 2-5 minutes.
          </p>
        </motion.div>
      )}

      {/* Error Message with Retry */}
      {status === 'error' && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <div className="bg-error-50 border border-error-200 rounded-lg p-4">
            <p className="text-sm text-error-700">{error || 'An unexpected error occurred'}</p>
          </div>

          {onRetry && (
            <Button onClick={onRetry} size="lg" className="w-full">
              Try Again
            </Button>
          )}
        </motion.div>
      )}

      {/* Loading Steps Indicator */}
      {isProcessing && (
        <div className="mt-6 space-y-2">
          <StepIndicator label="Combine recordings" isActive={status === 'combining'} isComplete={['compressing', 'uploading', 'complete'].includes(status)} />
          <StepIndicator label="Compress audio" isActive={status === 'compressing'} isComplete={['uploading', 'complete'].includes(status)} />
          <StepIndicator label="Upload to server" isActive={status === 'uploading'} isComplete={status === 'complete'} />
        </div>
      )}
    </motion.div>
  );
}

/**
 * Step Indicator Component
 */
function StepIndicator({
  label,
  isActive,
  isComplete,
}: {
  label: string;
  isActive: boolean;
  isComplete: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`w-6 h-6 rounded-full flex items-center justify-center border-2 ${
          isComplete
            ? 'bg-success-500 border-success-500'
            : isActive
            ? 'bg-primary-500 border-primary-500 animate-pulse'
            : 'bg-white border-gray-300'
        }`}
      >
        {isComplete && <CheckCircle2 className="w-4 h-4 text-white" />}
        {isActive && !isComplete && (
          <div className="w-2 h-2 bg-white rounded-full" />
        )}
      </div>

      <span
        className={`text-sm font-medium ${
          isActive || isComplete ? 'text-gray-900' : 'text-gray-400'
        }`}
      >
        {label}
      </span>
    </div>
  );
}

/**
 * Format bytes to human-readable size
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

/**
 * Calculate time remaining in seconds
 */
function calculateTimeRemaining(
  progress: number,
  fileSize: number,
  uploadSpeed: number
): number {
  const remaining = fileSize * ((100 - progress) / 100);
  return Math.ceil(remaining / uploadSpeed);
}

