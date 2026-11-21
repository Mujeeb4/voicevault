/**
 * Same-origin Django API client.
 *
 * Credentials are httpOnly cookies the browser sends automatically. Every request carries
 * X-Requested-With, which the API requires for cookie-authenticated writes (a cross-site
 * page can't add it). An expired session is refreshed once, shared by concurrent requests.
 */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as session from '@/lib/auth/session';

export const API_BASE_URL = '/api';
export const CSRF_HEADERS = { 'X-Requested-With': 'XMLHttpRequest' } as const;

const publicAuthPaths = ['/users/login/', '/users/signup/', '/users/refresh/', '/users/verify-email/', '/users/resend-verification/', '/users/logout/', '/users/password-reset/'];
const isPublicAuth = (url?: string) => publicAuthPaths.some((path) => url?.startsWith(path));
let refreshOperation: Promise<void> | null = null;

/** Get fresh session cookies. Rejects (and marks the session signed out) if that's not possible. */
export function refreshSession(): Promise<void> {
  if (refreshOperation) return refreshOperation;
  refreshOperation = axios.post(`${API_BASE_URL}/users/refresh/`, {}, { headers: CSRF_HEADERS, withCredentials: true })
    .then(() => undefined)
    .catch((error: unknown) => {
      // Another tab refreshed a moment ago; its new cookies are already in place
      if (axios.isAxiosError(error) && error.response?.status === 409) return;
      if (axios.isAxiosError(error) && [400, 401, 403, 404].includes(error.response?.status ?? 0)) {
        session.markSignedOut();
      }
      throw error;
    })
    .finally(() => { refreshOperation = null; });
  return refreshOperation;
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', ...CSRF_HEADERS },
});

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const config = error.config as (InternalAxiosRequestConfig & { _authRetried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !config || isPublicAuth(config.url)) return Promise.reject(error);
    if (config._authRetried || !session.isSignedIn()) {
      session.markSignedOut();
      return Promise.reject(error);
    }
    config._authRetried = true;
    await refreshSession();
    return client.request(config);
  }
);

export default client;
