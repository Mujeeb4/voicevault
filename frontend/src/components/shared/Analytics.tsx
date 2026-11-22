'use client';

/**
 * Analytics Component
 * Loads Google Analytics (optional)
 * Following .cursorrules patterns
 */

import React, { useEffect } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { trackPageView, captureAttribution } from '@/lib/analytics';

export const Analytics: React.FC = () => {
  const pathname = usePathname();
  const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;

  useEffect(() => {
    captureAttribution();
  }, []);

  useEffect(() => {
    if (pixelId && pathname && typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname, pixelId]);

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

  if (!gaId && !pixelId) {
    return null;
  }

  return (
    <>
      {gaId && (
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
      )}
      {pixelId && (
        <Script
          id="meta-pixel"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
            !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `,
          }}
        />
      )}
    </>
  );
};

