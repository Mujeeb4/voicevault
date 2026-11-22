/**
 * Where to send someone after they sign in, kept across the signup → verify email → sign in
 * round trip (e.g. "Unlock Premium" sends a new visitor to signup, and they should come back
 * to /pricing, not land on the dashboard). Same-site paths only.
 */
import { safeRedirectPath } from '@/lib/utils';

const KEY = 'voicevault_after_sign_in';

export function rememberAfterSignIn(path: string | null): void {
  if (typeof window === 'undefined' || !path) return;
  const safe = safeRedirectPath(path, '');
  if (!safe) return;
  try {
    localStorage.setItem(KEY, safe);
  } catch {
    // Storage unavailable: they land on the dashboard instead
  }
}

/** The remembered path (cleared once read), or the fallback. */
export function takeAfterSignIn(fallback: string): string {
  if (typeof window === 'undefined') return fallback;
  try {
    const stored = localStorage.getItem(KEY);
    localStorage.removeItem(KEY);
    return safeRedirectPath(stored, fallback);
  } catch {
    return fallback;
  }
}
