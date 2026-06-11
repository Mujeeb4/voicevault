'use client';

/**
 * Analytics Wrapper Component
 * Client component wrapper for Analytics to prevent render errors
 * Following .cursorrules patterns
 */

import { Analytics } from './Analytics';

export const AnalyticsWrapper: React.FC = () => {
  // Analytics component handles its own rendering and pathname tracking
  return <Analytics />;
};

