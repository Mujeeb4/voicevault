/**
 * Processing Step Card Component
 * Following .cursorrules and Tailwind CSS best practices
 */

'use client';

import { motion } from 'framer-motion';
import {
  CheckCircle2,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import type { ProcessingStepResult } from '@/types';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface ProcessingStepCardProps {
  title: string;
  description: string;
  step: ProcessingStepResult;
  onRetry?: () => void;
  onTrigger?: () => void;  // New: Manual trigger button
  icon: React.ReactNode;
  stepKey?: 'transcription' | 'personality_analysis' | 'voice_cloning';  // For determining if trigger should show
  previousStepComplete?: boolean;  // Whether previous step is complete (for enabling trigger)
  showTranscriptionButton?: boolean;  // Show button to view transcription
  transcriptionText?: string;  // Transcription text to display
}

export function ProcessingStepCard({
  title,
  description,
  step,
  onRetry,
  onTrigger,
  icon,
  previousStepComplete = true,  // Default to true for first step
  showTranscriptionButton = false,
  transcriptionText = '',
}: ProcessingStepCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showTranscription, setShowTranscription] = useState(false);
  const { status, progress, error, result } = step;

  // Status configuration
  const statusConfig = {
    pending: {
      icon: <Clock className="w-5 h-5 text-gray-400" />,
      badge: <Badge variant="outline">Pending</Badge>,
      color: 'border-gray-200',
    },
    in_progress: {
      icon: <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />,
      badge: <Badge variant="default">In Progress</Badge>,
      color: 'border-primary-300 bg-primary-50',
    },
    complete: {
      icon: <CheckCircle2 className="w-5 h-5 text-success-500" />,
      badge: <Badge variant="success">Complete</Badge>,
      color: 'border-success-200 bg-success-50',
    },
    failed: {
      icon: <AlertCircle className="w-5 h-5 text-error-500" />,
      badge: <Badge variant="error">Failed</Badge>,
      color: 'border-error-200 bg-error-50',
    },
    recorded_and_uploaded: {
      icon: <CheckCircle2 className="w-5 h-5 text-success-500" />,
      badge: <Badge variant="success">Recorded</Badge>,
      color: 'border-success-200 bg-success-50',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border-2 p-6 transition-all ${config.color}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="w-12 h-12 rounded-full bg-white border-2 border-gray-200 flex items-center justify-center">
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <div className="flex items-center gap-2">
              {config.badge}
              {config.icon}
            </div>
          </div>

          <p className="text-sm text-gray-600 mb-3">{description}</p>

          {/* Progress Bar (only show when in progress) */}
          {status === 'in_progress' && (
            <div className="space-y-2">
              <Progress value={progress || 0} className="h-2" />
              <p className="text-xs text-gray-500 text-right">{progress || 0}%</p>
            </div>
          )}

          {/* Manual Trigger Button (show when pending and previous step is complete) */}
          {status === 'pending' && onTrigger && previousStepComplete && (
            <div className="mt-3">
              <Button onClick={onTrigger} size="sm" variant="default" className="w-full">
                <RefreshCw className="w-4 h-4 mr-2" />
                Start {title}
              </Button>
            </div>
          )}

          {/* Error Message */}
          {status === 'failed' && error && (
            <div className="mt-3 p-3 bg-error-50 border border-error-200 rounded-lg">
              <p className="text-sm text-error-700 mb-2">{error}</p>
              {onRetry && (
                <Button onClick={onRetry} size="sm" variant="outline">
                  <RefreshCw className="w-4 h-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          )}

          {/* View Transcription Button (for voice cloning step) */}
          {showTranscriptionButton && (
            <div className="mt-3">
              <Button
                onClick={() => setShowTranscription(!showTranscription)}
                size="sm"
                variant="outline"
                className="w-full"
              >
                <FileText className="w-4 h-4 mr-2" />
                {showTranscription ? 'Hide Transcribed Text' : 'View Transcribed Text'}
              </Button>
              
              {showTranscription && transcriptionText && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-4 bg-gray-50 rounded-lg border border-gray-200 max-h-64 overflow-y-auto"
                >
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{transcriptionText}</p>
                </motion.div>
              )}
            </div>
          )}

          {/* Result Details (expandable) */}
          {status === 'complete' && result && Object.keys(result).length > 0 && (
            <div className="mt-3">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                {isExpanded ? (
                  <>
                    <ChevronUp className="w-4 h-4" />
                    Hide details
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4" />
                    View details
                  </>
                )}
              </button>

              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 p-4 bg-white rounded-lg border border-gray-200"
                >
                  <dl className="space-y-2">
                    {Object.entries(result).map(([key, value]) => (
                      <div key={key} className="flex justify-between text-sm">
                        <dt className="text-gray-600 capitalize">{key.replace(/_/g, ' ')}:</dt>
                        <dd className="text-gray-900 font-medium">
                          {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </motion.div>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

