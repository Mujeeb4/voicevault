/**
 * API client with auth token injection
 */
import axios, { AxiosInstance } from 'axios';
import * as session from '@/lib/auth/session';

// Resolve API base URL in a way that keeps backend origin hidden by default.
const rawEnvBase = (process.env.NEXT_PUBLIC_API_URL || '').trim();

const resolvedBaseURL = rawEnvBase || '/api';

const client: AxiosInstance = axios.create({
  baseURL: resolvedBaseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

client.interceptors.request.use((config) => {
  const token = session.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      session.clearTokens();
    }
    return Promise.reject(error);
  }
);

export default client;
