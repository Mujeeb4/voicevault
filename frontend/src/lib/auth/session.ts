/**
 * Session state for the browser, and the idle timeout.
 *
 * The sign-in tokens themselves are httpOnly cookies set by the API: page scripts can't
 * read them, so an injected script can't steal a session. All that is kept here is a
 * "signed in" flag, used to decide whether to load the profile on startup.
 */

export const SESSION_CHANGED_EVENT = 'voicevault:session-changed';
export const SIGNED_IN_KEY = 'voicevault_signed_in';
const LAST_ACTIVITY_KEY = 'voicevault_last_activity';
// Tokens were kept in localStorage under this key before; it is removed if still present
const LEGACY_TOKENS_KEY = 'voicevault_session';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

function notify(): void {
  window.dispatchEvent(new Event(SESSION_CHANGED_EVENT));
}

/** Remember that this browser has a session (the cookies hold the actual credentials). */
export function markSignedIn(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(SIGNED_IN_KEY, '1');
    localStorage.removeItem(LEGACY_TOKENS_KEY);
    updateLastActivity();
  } catch {
    // Storage unavailable: the session still works through cookies
  }
  notify();
}

export function markSignedOut(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(SIGNED_IN_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(LEGACY_TOKENS_KEY);
  } catch {
    // Ignore
  }
  notify();
}

export function isSignedIn(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    // Sessions stored the old way can't be reused: their tokens are no longer accepted
    if (localStorage.getItem(LEGACY_TOKENS_KEY)) {
      localStorage.removeItem(LEGACY_TOKENS_KEY);
      return false;
    }
    return localStorage.getItem(SIGNED_IN_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * Update last activity timestamp
 */
export function updateLastActivity(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
  } catch {
    // Ignore
  }
}

/**
 * Check if session has been idle longer than timeout
 */
export function isSessionIdle(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const lastActivity = localStorage.getItem(LAST_ACTIVITY_KEY);
    if (!lastActivity) return false; // No activity tracked, not idle
    const elapsed = Date.now() - parseInt(lastActivity, 10);
    return elapsed > IDLE_TIMEOUT_MS;
  } catch {
    return false;
  }
}
