'use client';

/**
 * Analytics Component
 * Loads Google Analytics (optional)
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { trackPageView, captureAttribution } from '@/lib/analytics';

export const Analytics: React.FC = () => {
  const pathname = usePathname();
  const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
  const pixelId = process.env.NEXT_PUBLIC_META_PIXEL_ID;
  const [consent, setConsent] = useState<'granted' | 'denied' | 'unset' | 'loading'>('loading');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('vv_consent');
      setConsent(saved === 'granted' || saved === 'denied' ? saved : 'unset');
    } catch {
      setConsent('unset');
    }
  }, []);

  const choose = (value: 'granted' | 'denied') => {
    try {
      window.localStorage.setItem('vv_consent', value);
    } catch {
      // storage unavailable; choice lasts for this page view only
    }
    setConsent(value);
  };

  useEffect(() => {
    if (consent === 'granted') captureAttribution();
  }, [consent]);

  useEffect(() => {
    if (consent === 'granted' && pixelId && pathname && typeof window !== 'undefined' && window.fbq) {
      window.fbq('track', 'PageView');
    }
  }, [pathname, pixelId, consent]);

  // Track page views in useEffect to avoid render issues
  useEffect(() => {
    if (consent === 'granted' && gaId && pathname && typeof window !== 'undefined') {
      // Use setTimeout to ensure this runs after render
      const timeoutId = setTimeout(() => {
        trackPageView(pathname);
      }, 0);
      return () => clearTimeout(timeoutId);
    }
    return undefined;
  }, [pathname, gaId, consent]);

  if (!gaId && !pixelId) {
    return null;
  }

  const banner =
    consent === 'unset' ? (
      <div
        role="dialog"
        aria-label="Cookie preferences"
        className="fixed inset-x-3 bottom-3 z-50 mx-auto max-w-xl rounded-xl border border-neutral-200 bg-white p-4 text-sm text-neutral-800 shadow-lg"
      >
        <p>
          We use analytics and advertising cookies to understand how people find VoiceVault and to
          measure our ads. Nothing is loaded unless you accept.{' '}
          <Link href="/privacy" className="underline">
            Privacy policy
          </Link>
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => choose('granted')}
            className="rounded-lg bg-neutral-900 px-4 py-2 font-medium text-white"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => choose('denied')}
            className="rounded-lg border border-neutral-300 px-4 py-2 font-medium"
          >
            Decline
          </button>
        </div>
      </div>
    ) : null;

  if (consent !== 'granted') {
    return banner;
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

