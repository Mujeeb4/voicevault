import type { User } from '@/types';

/**
 * True when the account has Premium. Mirrors the server's `has_premium_access`: any one of
 * these flags is enough (`lifetime_access` is the one granted by an administrator).
 */
export function hasPremiumAccess(
  user: Pick<User, 'is_premium' | 'payment_completed' | 'plan_type' | 'lifetime_access'> | null | undefined
): boolean {
  return !!(
    user?.is_premium ||
    user?.payment_completed ||
    user?.lifetime_access ||
    user?.plan_type === 'premium'
  );
}
