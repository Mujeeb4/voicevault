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
      color: 'border-border bg-card/68',
    },
    in_progress: {
      icon: <Loader2 className="w-5 h-5 text-primary-600 animate-spin" />,
      badge: <Badge variant="default">In Progress</Badge>,
      color: 'border-primary/40 bg-primary/10',
    },
    complete: {
      icon: <CheckCircle2 className="w-5 h-5 text-success-500" />,
      badge: <Badge variant="success">Complete</Badge>,
      color: 'border-success-500/30 bg-success-500/10',
    },
    failed: {
      icon: <AlertCircle className="w-5 h-5 text-error-500" />,
      badge: <Badge variant="error">Failed</Badge>,
      color: 'border-error-500/30 bg-error-500/10',
    },
    recorded_and_uploaded: {
      icon: <CheckCircle2 className="w-5 h-5 text-success-500" />,
      badge: <Badge variant="success">Recorded</Badge>,
      color: 'border-success-500/30 bg-success-500/10',
    },
  };

  const config = statusConfig[status as keyof typeof statusConfig] ?? statusConfig.pending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`rounded-lg border p-5 transition-all sm:p-6 ${config.color}`}
    >
      {/* Header */}
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border bg-background/55">
            {icon}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-foreground">{title}</h3>
            <div className="flex items-center gap-2">
              {config.badge}
              {config.icon}
            </div>
          </div>

          <p className="mb-3 text-sm text-muted-foreground">{description}</p>

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
            <div className="mt-3 rounded-lg border border-error-500/25 bg-error-500/10 p-3">
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
                  className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-border bg-muted/35 p-4"
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
                  className="mt-3 rounded-lg border border-border bg-background/45 p-4"
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
