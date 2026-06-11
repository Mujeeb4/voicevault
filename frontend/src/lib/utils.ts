import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merge Tailwind CSS classes with clsx
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Extract error message from axios or similar API error
 */
export function getApiErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (!err || typeof err !== 'object' || !('response' in err)) return fallback;
  const data = (err as { response?: { data?: { error?: string; detail?: string } } }).response?.data;
  return data?.error ?? data?.detail ?? fallback;
}
