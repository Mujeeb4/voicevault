/** Same-origin Django API client with a shared refresh operation for concurrent requests. */
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import * as session from '@/lib/auth/session';

export const API_BASE_URL = '/api';
const publicAuthPaths = ['/users/login/', '/users/signup/', '/users/refresh/', '/users/verify-email/', '/users/resend-verification/', '/users/logout/', '/users/password-reset/'];
const isPublicAuth = (url?: string) => publicAuthPaths.some((path) => url?.startsWith(path));
let refreshOperation: Promise<string> | null = null;

export function refreshAccessToken(): Promise<string> {
  if (refreshOperation) return refreshOperation;
  const refresh = session.getRefreshToken();
  if (!refresh) return Promise.reject(new Error('Please sign in again.'));

  refreshOperation = axios.post<{ access: string; refresh: string }>(`${API_BASE_URL}/users/refresh/`, { refresh })
    .then(({ data }) => {
      // An in-flight refresh must not restore a session after logout/account switching.
      if (session.getRefreshToken() !== refresh) throw new Error('Your session changed. Please sign in again.');
      session.setTokens({ ...data, expiresAt: session.decodeTokenExpiry(data.access) ?? undefined });
      return data.access;
    })
    .catch((error: unknown) => {
      if (axios.isAxiosError(error) && [400, 401, 404].includes(error.response?.status ?? 0)) {
        session.clearTokens();
      }
      throw error;
    })
    .finally(() => { refreshOperation = null; });
  return refreshOperation;
}

/** Also used by fetch-based streaming, so chat refreshes credentials like ordinary requests. */
export async function getValidAccessToken(): Promise<string | null> {
  const token = session.getAccessToken();
  if (token && session.isTokenExpired()) return refreshAccessToken();
  return token;
}

const client: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  if (!isPublicAuth(config.url)) {
    const token = await getValidAccessToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) return Promise.reject(error);
    const config = error.config as (InternalAxiosRequestConfig & { _authRetried?: boolean }) | undefined;
    if (error.response?.status !== 401 || !config || isPublicAuth(config.url)) return Promise.reject(error);
    if (config._authRetried || !session.getRefreshToken()) {
      session.clearTokens();
      return Promise.reject(error);
    }
    config._authRetried = true;
    const token = await refreshAccessToken();
    config.headers.Authorization = `Bearer ${token}`;
    return client.request(config);
  }
);

export default client;
