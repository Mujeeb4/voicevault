/**
 * Session management for authentication tokens and idle timeout
 */

const STORAGE_KEY = 'voicevault_session';
const LAST_ACTIVITY_KEY = 'voicevault_last_activity';
const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export interface StoredTokens {
  access: string;
  refresh: string;
  expiresAt?: number;
}

/**
 * Decode JWT payload and return expiry timestamp (ms)
 */
export function decodeTokenExpiry(accessToken: string): number | null {
  try {
    const payload = accessToken.split('.')[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));
    return decoded.exp ? decoded.exp * 1000 : null;
  } catch {
    return null;
  }
}

/**
 * Store auth tokens (and optionally update API client)
 */
export function setTokens(tokens: StoredTokens): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tokens));
    updateLastActivity();
  } catch {
    console.error('Failed to store tokens');
  }
}

/**
 * Clear stored tokens
 */
export function clearTokens(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  } catch {
    console.error('Failed to clear tokens');
  }
}

/**
 * Get access token from storage
 */
export function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const { access } = JSON.parse(stored) as StoredTokens;
    return access || null;
  } catch {
    return null;
  }
}

/**
 * Get refresh token from storage
 */
export function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const { refresh } = JSON.parse(stored) as StoredTokens;
    return refresh || null;
  } catch {
    return null;
  }
}

/**
 * Check if access token is expired (with 60s buffer)
 */
export function isTokenExpired(): boolean {
  const token = getAccessToken();
  if (!token) return true;
  const expiresAt = decodeTokenExpiry(token);
  if (!expiresAt) return false; // No expiry claim, assume valid
  return Date.now() >= expiresAt - 60000; // 60s buffer
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
