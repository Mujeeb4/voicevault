/**
 * Processing Status Monitor Component
 * Main component with polling and state management
 * Following .cursorrules patterns
 */

'use client';

import { useEffect } from 'react';
import { Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { useProcessingStatus, useRetryStep, useTriggerStep } from '@/lib/hooks/useProcessingStatus';
import { useAuthStore } from '@/store/auth';
import { ProcessingTimeline } from './ProcessingTimeline';
import { Button } from '@/components/ui/button';

interface ProcessingStatusMonitorProps {
  userId: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
  onComplete?: () => void;
}

export function ProcessingStatusMonitor({
  userId,
  autoRefresh = true,
  refreshInterval = 5000,
  onComplete,
}: ProcessingStatusMonitorProps) {
  const { data: status, isLoading, error, refetch } = useProcessingStatus(
    userId,
    autoRefresh,
    refreshInterval
  );

  const retryStepMutation = useRetryStep();
  const triggerStepMutation = useTriggerStep();
  const refreshUser = useAuthStore((state) => state.refreshUser);

  // Check if all steps are complete (fallback for when overall_status isn't updated)
  const allStepsComplete =
    status?.steps?.transcription?.status === 'complete' &&
    status?.steps?.personality_analysis?.status === 'complete' &&
    status?.steps?.voice_cloning?.status === 'complete';

  // Call onComplete when processing finishes
  useEffect(() => {
    const isComplete = status?.overall_status === 'complete' || allStepsComplete;
    if (isComplete && onComplete) {
      // Refresh user data in auth store so dashboard shows correct status
      refreshUser();
      onComplete();
    }
  }, [status?.overall_status, allStepsComplete, onComplete, refreshUser]);

  // Handle retry step
  const handleRetryStep = async (step: 'transcribe' | 'personality' | 'voice-clone') => {
    try {
      await retryStepMutation.mutateAsync({ userId, step });
      toast.success(`Retrying ${step} step...`);
    } catch {
      toast.error(`Failed to retry ${step} step`);
    }
  };

  // Handle manual trigger step
  const handleTriggerStep = async (step: 'transcribe' | 'personality' | 'voice-clone') => {
    try {
      await triggerStepMutation.mutateAsync({ userId, step });
      toast.success(`Starting ${step} step...`);
    } catch {
      toast.error(`Failed to start ${step} step`);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="journey-card flex flex-col items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary-600 mb-4" />
        <p className="text-muted-foreground">Loading processing status...</p>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="journey-card flex flex-col items-center justify-center py-12">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-error-50">
          <AlertCircle className="w-8 h-8 text-error-500" />
        </div>
        <h3 className="mb-2 text-lg font-semibold text-foreground">Failed to Load Status</h3>
        <p className="mb-4 max-w-md text-center text-muted-foreground">
          {error instanceof Error ? error.message : 'An error occurred while fetching status'}
        </p>
        <Button onClick={() => refetch()} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try Again
        </Button>
      </div>
    );
  }

  // No data state
  if (!status) {
    return (
      <div className="journey-card flex flex-col items-center justify-center py-12">
        <AlertCircle className="w-12 h-12 text-gray-400 mb-4" />
        <p className="text-muted-foreground">No processing status found</p>
      </div>
    );
  }

  // Main content - show timeline
  return (
    <div className="space-y-6">
      {/* Status Info */}
      <div className="journey-card p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Last Updated</p>
            <p className="text-lg font-semibold text-foreground">
              {status?.updated_at ? new Date(status.updated_at).toLocaleString() : 'N/A'}
            </p>
          </div>
          <Button onClick={() => refetch()} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Timeline */}
      <ProcessingTimeline
        status={status}
        onRetryStep={handleRetryStep}
        onTriggerStep={handleTriggerStep}
        userId={userId}
      />
    </div>
  );
}
