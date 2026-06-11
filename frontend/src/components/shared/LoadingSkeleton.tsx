'use client';

/**
 * Loading Skeleton Components
 * Reusable loading states for better UX
 * Following .cursorrules patterns
 */

import React from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

/**
 * Table Row Skeleton
 */
export const TableRowSkeleton: React.FC<{ columns?: number }> = ({ columns = 5 }) => {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: columns }).map((_, j) => (
            <td key={j} className="p-4">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

/**
 * Card Skeleton
 */
export const CardSkeleton: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <Card className={cn('', className)}>
      <CardHeader>
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-1/2 mt-2" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-5/6" />
      </CardContent>
    </Card>
  );
};

/**
 * Stats Card Skeleton
 */
export const StatsCardSkeleton: React.FC = () => {
  return (
    <Card>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-8 rounded-full" />
        </div>
        <Skeleton className="h-8 w-16" />
      </div>
    </Card>
  );
};

/**
 * Question Card Skeleton
 */
export const QuestionCardSkeleton: React.FC = () => {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </CardHeader>
      <CardContent>
        <Skeleton className="h-4 w-full mb-2" />
        <Skeleton className="h-4 w-3/4 mb-4" />
        <Skeleton className="h-4 w-1/2" />
      </CardContent>
    </Card>
  );
};

/**
 * Chat Message Skeleton
 */
export const ChatMessageSkeleton: React.FC = () => {
  return (
    <div className="flex gap-3 p-4">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </div>
  );
};

/**
 * Dashboard Skeleton
 */
export const DashboardSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <StatsCardSkeleton key={i} />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
};

/**
 * Recording Step Skeleton
 */
export const RecordingStepSkeleton: React.FC = () => {
  return (
    <div className="flex flex-col items-center space-y-8">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full mb-4" />
          <Skeleton className="h-12 w-32 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
};

