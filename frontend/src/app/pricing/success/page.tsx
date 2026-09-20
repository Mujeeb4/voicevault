'use client';

/**
 * Payment Success Page
 * Displayed after successful Stripe checkout
 */

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { paymentsApi } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import { CheckCircle2, Loader2, ArrowRight, Mic, AlertCircle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { getApiErrorMessage } from '@/lib/utils';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, isLoading, checkAuth, refreshUser, logout } = useAuthStore();
  const sessionId = searchParams.get('session_id');
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
  const [verificationError, setVerificationError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);

  const switchAccountForPayment = () => {
    if (!sessionId) {
      router.push('/pricing');
      return;
    }

    logout();
    const safeReturnPath = `/pricing/success?session_id=${encodeURIComponent(sessionId)}`;
    router.push(`/login?redirect=${encodeURIComponent(safeReturnPath)}`);
  };

  useEffect(() => {
    let isMounted = true;

    checkAuth().finally(() => {
      if (isMounted) setHasCheckedAuth(true);
    });

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    if (!hasCheckedAuth || isLoading) return;

    if (!sessionId) {
      setCanRetry(false);
      setVerificationError(
        'This payment return link is missing its verification code. No Premium access has been claimed.'
      );
      setIsVerifying(false);
      return;
    }

    if (!isAuthenticated) {
      const safeReturnPath = `/pricing/success?session_id=${encodeURIComponent(sessionId)}`;
      router.replace(`/login?redirect=${encodeURIComponent(safeReturnPath)}`);
      return;
    }

    let redirectTimer: number | undefined;

    const verifyPayment = async () => {
      try {
        const result = await paymentsApi.confirmCheckoutSession(sessionId);
        if (!result.payment_completed && !result.is_premium) {
          setVerificationError(
            'Payment is not marked complete yet. If you just paid, wait a moment and try verification again.'
          );
          setIsVerifying(false);
          return;
        }

        await refreshUser();
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
        setIsVerifying(false);
        redirectTimer = window.setTimeout(() => router.replace('/dashboard'), 1200);
      } catch (error: unknown) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        const message = getApiErrorMessage(error, 'Payment verification failed.');

        if (status === 403) {
          setCanRetry(false);
          setVerificationError(
            'This payment belongs to a different VoiceVault account. Sign in with the account that completed checkout.'
          );
        } else if (status === 401) {
          const safeReturnPath = `/pricing/success?session_id=${encodeURIComponent(sessionId)}`;
          router.replace(`/login?redirect=${encodeURIComponent(safeReturnPath)}`);
          return;
        } else {
          setVerificationError(`${message} Please try again or return to your dashboard.`);
        }
        setIsVerifying(false);
      }
    };

    verifyPayment();

    return () => {
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [hasCheckedAuth, isAuthenticated, isLoading, refreshUser, router, sessionId]);

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <main className="mx-auto flex max-w-md flex-col items-center justify-center px-4 py-16">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex w-full flex-col items-center gap-4 rounded-xl border border-border bg-card p-8 shadow-sm"
          >
            <Loader2 className="h-10 w-10 animate-spin text-primary" strokeWidth={2} />
            <p className="text-sm text-muted-foreground">Verifying payment...</p>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <OnboardingHeader />

      <main className="relative mx-auto max-w-lg px-4 py-12 sm:py-16 md:py-20">
        <motion.div
          initial="initial"
          animate="animate"
          variants={{
            animate: {
              transition: { staggerChildren: 0.1, delayChildren: 0.1 },
            },
          }}
          className="space-y-8"
        >
          <motion.div
            variants={fadeInUp}
            transition={{ duration: 0.5 }}
            className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8"
          >
            <motion.div
              className="mb-5 flex justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.2 }}
            >
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-full ${
                  verificationError ? 'bg-destructive/10' : 'bg-primary/10'
                }`}
              >
                {verificationError ? (
                  <AlertCircle className="h-9 w-9 text-destructive" strokeWidth={2} />
                ) : (
                  <CheckCircle2 className="h-9 w-9 text-primary" strokeWidth={2} />
                )}
              </div>
            </motion.div>
            <div className="text-center">
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {verificationError ? (
                  'We could not verify this payment yet.'
                ) : (
                  <>
                    Welcome to <span className="text-primary">VoiceVault Premium.</span>
                  </>
                )}
              </h1>
              <p className="mt-2 text-muted-foreground sm:text-lg">
                {verificationError
                  ? verificationError
                  : 'Your full memory vault, voice cloning, and family access features are now unlocked. Taking you to your dashboard...'}
              </p>
            </div>

            {!verificationError && (
              <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 px-5 py-4">
                <h3 className="font-sans text-sm font-medium text-foreground">
                  Give My Family My Voice
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Continue building your vault with 30 guided questions plus an optional reflection,
                  Premium voice cloning, and generous monthly fair-use limits for family
                  conversations.
                </p>
              </div>
            )}

            <div className="space-y-3 pt-2">
              {verificationError ? (
                canRetry ? (
                  <Button
                    onClick={() => window.location.reload()}
                    size="lg"
                    className="h-12 w-full rounded-xl"
                  >
                    Try verification again
                  </Button>
                ) : (
                  <Button
                    onClick={switchAccountForPayment}
                    size="lg"
                    className="h-12 w-full rounded-xl"
                  >
                    {sessionId ? 'Switch account' : 'Return to pricing'}
                  </Button>
                )
              ) : (
                <motion.div
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.99 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 17 }}
                >
                  <Button
                    onClick={() => router.push('/record')}
                    size="lg"
                    className="h-12 w-full gap-2 rounded-xl shadow-lg shadow-primary/25 transition-shadow hover:shadow-xl hover:shadow-primary/30"
                  >
                    <Mic className="h-5 w-5" strokeWidth={2} />
                    Continue Building My Vault
                    <ArrowRight className="h-4 w-4" strokeWidth={2} />
                  </Button>
                </motion.div>
              )}
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                size="lg"
                className="h-11 w-full rounded-xl"
              >
                Go to Dashboard
              </Button>
            </div>

            {!verificationError && (
              <p className="pt-2 text-center text-sm text-muted-foreground">
                Premium access is now attached to this voice vault.
              </p>
            )}
          </motion.div>

          <motion.p variants={fadeInUp} className="text-center text-sm text-muted-foreground">
            <Link href="/" className="transition-colors hover:text-primary">
              Home
            </Link>
            {' · '}
            <Link href="/#how-it-works" className="transition-colors hover:text-primary">
              How it works
            </Link>
          </motion.p>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
