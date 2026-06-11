'use client';

/**
 * Admin Processing Monitor Page
 * Monitor all AI processing jobs
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { useAdminStore } from '@/store/admin';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Play, RefreshCw, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import type { ProcessingStatus as ProcessingStatusType } from '@/types';

function AdminProcessingContent() {
  const { processingJobs, isLoadingProcessing, loadProcessingJobs, triggerFullPipeline, batchProcessPending, batchRetryFailed } = useAdminStore();

  const [statusFilter, setStatusFilter] = useState<'all' | ProcessingStatusType>('all');

  useEffect(() => {
    loadProcessingJobs({ status: statusFilter === 'all' ? undefined : statusFilter });

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      loadProcessingJobs({ status: statusFilter === 'all' ? undefined : statusFilter });
    }, 10000);

    return () => clearInterval(interval);
  }, [loadProcessingJobs, statusFilter]);

  const handleTriggerPipeline = async (userId: string) => {
    try {
      await triggerFullPipeline(userId);
      await loadProcessingJobs();
    } catch {
      // Error handled in store
    }
  };

  const handleBatchProcessPending = async () => {
    if (confirm('Trigger processing for all pending users?')) {
      try {
        await batchProcessPending();
        await loadProcessingJobs();
      } catch {
        // Error handled in store
      }
    }
  };

  const handleBatchRetryFailed = async () => {
    if (confirm('Retry all failed processing jobs?')) {
      try {
        await batchRetryFailed();
        await loadProcessingJobs();
      } catch {
        // Error handled in store
      }
    }
  };

  const getStatusBadge = (status: ProcessingStatusType) => {
    const variants: Record<ProcessingStatusType, { variant: 'default' | 'secondary' | 'error' | 'outline'; className: string }> = {
      pending: { variant: 'secondary', className: '' },
      in_progress: { variant: 'default', className: 'bg-primary-500' },
      complete: { variant: 'default', className: 'bg-green-500' },
      failed: { variant: 'error', className: '' },
      recorded_and_uploaded: { variant: 'default', className: 'bg-purple-500' },
    };

    const config = variants[status] || variants.pending;

    return (
      <Badge variant={config.variant} className={config.className}>
        {status.replace('_', ' ')}
      </Badge>
    );
  };

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Processing Monitor</h1>
          <p className="text-muted-foreground mt-1">Monitor AI processing jobs</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleBatchProcessPending} variant="outline" size="sm">
            <Play className="mr-2 h-4 w-4" />
            Process Pending
          </Button>
          <Button onClick={handleBatchRetryFailed} variant="outline" size="sm">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry Failed
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="complete">Complete</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
        <p className="text-sm text-muted-foreground self-center">
          Auto-refreshing every 10 seconds
        </p>
      </div>

      {/* Processing Jobs Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Started</TableHead>
              <TableHead>Completed</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingProcessing ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-2">Loading processing jobs...</p>
                </TableCell>
              </TableRow>
            ) : processingJobs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  No processing jobs found
                </TableCell>
              </TableRow>
            ) : (
              processingJobs.map((job) => (
                <TableRow key={job.user_id}>
                  <TableCell className="font-medium">{job.user_name}</TableCell>
                  <TableCell>{job.user_email}</TableCell>
                  <TableCell>{getStatusBadge(job.status)}</TableCell>
                  <TableCell>
                    {job.started_at ? format(new Date(job.started_at), 'MMM d, h:mm a') : '-'}
                  </TableCell>
                  <TableCell>
                    {job.completed_at ? format(new Date(job.completed_at), 'MMM d, h:mm a') : '-'}
                  </TableCell>
                  <TableCell>
                    {job.status === 'failed' ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTriggerPipeline(job.user_id)}
                        title="Retry"
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    ) : job.status === 'pending' ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleTriggerPipeline(job.user_id)}
                        title="Trigger"
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    ) : job.status === 'in_progress' ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : null}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Error Notice */}
      {processingJobs.some((j) => j.status === 'failed') && (
        <div className="mt-4 flex items-start gap-2 p-4 border border-destructive rounded-lg bg-destructive/10">
          <AlertCircle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-destructive">Failed Jobs Detected</p>
            <p className="text-sm text-muted-foreground">
              Some processing jobs have failed. Click the retry button to trigger them again, or use &quot;Retry Failed&quot; to
              process all failed jobs.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminProcessingPage() {
  return (
    <AdminRoute>
      <AdminProcessingContent />
    </AdminRoute>
  );
}

