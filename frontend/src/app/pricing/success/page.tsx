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
import { CheckCircle2, Loader2, ArrowRight, Mic } from 'lucide-react';
import confetti from 'canvas-confetti';
import { OnboardingHeader, SiteFooter } from '@/components/layout';

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
};

export default function PaymentSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  const [verificationError, setVerificationError] = useState<string | null>(null);

  useEffect(() => {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
    });

    let redirectTimer: number | undefined;

    const verifyPayment = async () => {
      try {
        const sessionId = searchParams.get('session_id');
        if (sessionId) {
          const result = await paymentsApi.confirmCheckoutSession(sessionId);
          if (!result.payment_completed && !result.is_premium) {
            setVerificationError('Payment is not marked complete yet. If you just paid, wait a moment and refresh.');
            setIsVerifying(false);
            return;
          }
        }

        await refreshUser();
        setIsVerifying(false);
        redirectTimer = window.setTimeout(() => router.replace('/dashboard'), 1200);
      } catch {
        console.error('Failed to verify payment');
        setVerificationError('Payment verification failed. Please refresh or go to your dashboard.');
        setIsVerifying(false);
      }
    };

    verifyPayment();

    return () => {
      if (redirectTimer) {
        window.clearTimeout(redirectTimer);
      }
    };
  }, [refreshUser, router, searchParams]);

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
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle2 className="h-9 w-9 text-primary" strokeWidth={2} />
              </div>
            </motion.div>
            <div className="text-center">
              <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Welcome to <span className="text-primary">VoiceVault Premium.</span>
              </h1>
              <p className="mt-2 text-muted-foreground sm:text-lg">
                {verificationError
                  ? verificationError
                  : 'Your full memory vault, voice cloning, and family access features are now unlocked. Taking you to your dashboard...'}
              </p>
            </div>

            <div className="mt-6 rounded-lg border border-border/60 bg-muted/20 px-5 py-4">
              <h3 className="font-sans text-sm font-medium text-foreground">Give My Family My Voice</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Continue building your vault with 30+ guided questions, Premium voice cloning, and generous monthly
                fair-use limits for family conversations.
              </p>
            </div>

            <div className="space-y-3 pt-2">
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
              <Button
                onClick={() => router.push('/dashboard')}
                variant="outline"
                size="lg"
                className="h-11 w-full rounded-xl"
              >
                Go to Dashboard
              </Button>
            </div>

            <p className="pt-2 text-center text-sm text-muted-foreground">
              You&apos;ve given your family something no photo or video ever could. A confirmation has been sent to
              your inbox.
            </p>
          </motion.div>

          <motion.p
            variants={fadeInUp}
            className="text-center text-sm text-muted-foreground"
          >
            <Link href="/" className="transition-colors hover:text-primary">Home</Link>
            {' · '}
            <Link href="/#how-it-works" className="transition-colors hover:text-primary">How it works</Link>
          </motion.p>
        </motion.div>
      </main>

      <SiteFooter />
    </div>
  );
}
