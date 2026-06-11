'use client';

/**
 * Analytics Component
 * Loads Google Analytics (optional)
 * Following .cursorrules patterns
 */

import React, { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { trackPageView } from '@/lib/analytics';

export const Analytics: React.FC = () => {
  const pathname = usePathname();
  const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;

  // Track page views in useEffect to avoid render issues
  useEffect(() => {
    if (gaId && pathname && typeof window !== 'undefined') {
      // Use setTimeout to ensure this runs after render
      const timeoutId = setTimeout(() => {
        trackPageView(pathname);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [pathname, gaId]);

  if (!gaId) {
    return null;
  }

  return (
    <>
      <Script
        strategy="afterInteractive"
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
      />
      <Script
        id="google-analytics"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${gaId}', {
              page_path: window.location.pathname,
            });
          `,
        }}
      />
    </>
  );
};

