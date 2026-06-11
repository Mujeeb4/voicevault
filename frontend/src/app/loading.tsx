/**
 * Global Loading Page (Next.js App Router)
 * Shows while page is loading
 * Following .cursorrules patterns
 */

import React from 'react';
import { DashboardSkeleton } from '@/components/shared/LoadingSkeleton';

export default function Loading() {
  return <DashboardSkeleton />;
}

