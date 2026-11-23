/**
 * Analytics utilities: GA4 + Meta Pixel (both optional, env-driven)
 */

declare global {
  interface Window {
    gtag?: (command: string, ...args: unknown[]) => void;
    fbq?: (command: string, ...args: unknown[]) => void;
  }
}

/** Track a page view for analytics */
export function trackPageView(path: string): void {
  if (typeof window === 'undefined') return;
  const gaId = process.env.NEXT_PUBLIC_GA_TRACKING_ID;
  if (gaId && window.gtag) {
    window.gtag('config', gaId, { page_path: path });
  }
}

type EventParams = Record<string, string | number | boolean | undefined>;

/**
 * Fire a funnel event to GA4 (and Meta Pixel when a standard event is mapped).
 * Never throws; no personal data should be passed in params.
 */
export function trackEvent(
  name: string,
  params: EventParams = {},
  meta?: { standard: string; eventId?: string }
): void {
  if (typeof window === 'undefined') return;
  try {
    window.gtag?.('event', name, params);
    if (meta && window.fbq) {
      window.fbq('track', meta.standard, params, meta.eventId ? { eventID: meta.eventId } : undefined);
    }
  } catch {
    // analytics must never break the app
  }
}

/** Remember first-touch UTM / referrer so signups can be attributed later. */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return;
  try {
    if (window.localStorage.getItem('vv_first_touch')) return;
    const q = new URLSearchParams(window.location.search);
    const data: Record<string, string> = {};
    ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
      const v = q.get(k);
      if (v) data[k] = v.slice(0, 100);
    });
    if (document.referrer) data.referrer = document.referrer.slice(0, 200);
    if (Object.keys(data).length) window.localStorage.setItem('vv_first_touch', JSON.stringify(data));
  } catch {
    // storage may be unavailable
  }
}

/** The saved first-touch UTM tags / referrer (only present if the visitor accepted tracking). */
export function getAttribution(): Record<string, string> | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const saved = window.localStorage.getItem('vv_first_touch');
    const parsed = saved ? JSON.parse(saved) : null;
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
