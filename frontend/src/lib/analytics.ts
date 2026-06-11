/**
 * Analytics utilities for tracking page views
 */

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
  }
}

/**
 * Track a page view for analytics
 */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;
  const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
  if (gaId && window.gtag) {
    window.gtag('config', gaId, { page_path: path });
  }
}
