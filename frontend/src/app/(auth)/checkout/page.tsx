'use client';

/**
 * Checkout Page — Mobile-first, one-time Premium plan
 * Redirects to Stripe checkout
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { paymentsApi } from '@/lib/api/payments';
import { OnboardingHeader } from '@/components/layout';
import { Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

export default function CheckoutPage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading, checkAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [hasStartedCheckout, setHasStartedCheckout] = useState(false);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    let isMounted = true;

    checkAuth().finally(() => {
      if (isMounted) {
        setHasCheckedAuth(true);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    if (!hasCheckedAuth || isLoading) return;

    if (!isAuthenticated) {
      router.push('/login?redirect=/checkout');
      return;
    }

    if (user?.is_premium || user?.payment_completed || user?.plan_type === 'premium') {
      toast.info('You have already purchased!');
      router.push('/dashboard');
      return;
    }

    if (hasStartedCheckout) return;
    setHasStartedCheckout(true);

    const startCheckout = async () => {
      try {
        setError(null);
        const response = await paymentsApi.createCheckoutSession();
        if (response.checkout_url) {
          window.location.href = response.checkout_url;
        } else {
          setError('Invalid checkout response');
        }
      } catch (err: unknown) {
        const msg = getApiErrorMessage(err, 'Failed to start checkout');
        setError(msg);
        toast.error(msg);
      }
    };

    startCheckout();
  }, [
    hasCheckedAuth,
    isAuthenticated,
    user?.is_premium,
    user?.payment_completed,
    user?.plan_type,
    isLoading,
    router,
    hasStartedCheckout,
  ]);

  if (error) {
    return (
      <div className="min-h-dvh bg-background">
        <OnboardingHeader />
        <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16">
          <motion.div
            className="w-full rounded-2xl border border-border bg-white p-6 shadow-sm"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="rounded-full bg-destructive/10 p-3">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <h1 className="font-sans text-xl font-semibold text-foreground">
                Unable to start checkout
              </h1>
              <p className="text-muted-foreground">{error}</p>
              <Link
                href="/pricing"
                className="rounded-lg bg-primary-600 px-6 py-2.5 text-sm font-semibold text-primary-50 transition-all hover:bg-primary-700 hover:shadow-md"
              >
                Protect My Memories Now
              </Link>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <OnboardingHeader />
      <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16">
        <motion.div
          className="w-full rounded-2xl border border-border bg-white p-8 shadow-sm"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-primary-600" />
            <h1 className="font-sans text-lg font-semibold text-foreground">
              Redirecting to secure checkout
            </h1>
            <p className="text-sm text-muted-foreground">
              You&apos;re making sure your voice never disappears.
            </p>
            <p className="text-xs text-muted-foreground">
              You&apos;ll continue automatically when your secure checkout is ready.
            </p>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
