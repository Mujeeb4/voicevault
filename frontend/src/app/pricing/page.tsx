'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { paymentsApi, Package } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import {
  Loader2,
  Check,
  Minus,
  ArrowRight,
  Lock,
  Mic,
  MessageSquare,
  Shield,
  Zap,
  Users,
} from 'lucide-react';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { toast } from 'sonner';
import { getApiErrorMessage } from '@/lib/utils';

const defaultPlans: Package[] = [
  {
    tier: 'free',
    name: 'Memory Starter',
    price_cents: 0,
    price_display: '$0',
    features: [
      '5 guided questions',
      '15 minutes of recordings',
      'Basic AI personality',
      '5 family chat messages',
      '1 family invitation',
      'Text-only chat',
      'No voice cloning',
    ],
  },
  {
    tier: 'premium',
    name: 'VoiceVault Premium',
    price_cents: 14999,
    price_display: '$149.99',
    highlighted: true,
    features: [
      '30 guided questions + optional reflection',
      'Up to 5 hours of memories',
      'Advanced AI personality',
      'Voice cloning included',
      '200 voice responses/month',
      '1,000 text messages/month',
      'Up to 10 family members',
      'Biography PDF export',
    ],
  },
];

const premiumHighlights = [
  { icon: Mic, label: 'Voice cloning', desc: 'Family hears you in your own voice' },
  { icon: Zap, label: 'AI personality', desc: 'Learns your unique way of speaking' },
  { icon: Users, label: '10 family members', desc: 'Whole family stays connected' },
  { icon: Shield, label: 'Lifetime access', desc: 'One-time payment, forever yours' },
];

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [packages, setPackages] = useState<Package[]>(defaultPlans);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const isPremium = !!(
    user?.is_premium ||
    user?.payment_completed ||
    user?.plan_type === 'premium'
  );
  const canceled = searchParams.get('canceled') === 'true';

  useEffect(() => {
    if (canceled) {
      toast.error('Payment was canceled. You can try again when ready.');
    }
  }, [canceled]);

  useEffect(() => {
    paymentsApi
      .getPackages()
      .then((response) => setPackages(response.packages.length ? response.packages : defaultPlans))
      .catch(() => setPackages(defaultPlans))
      .finally(() => setIsLoading(false));
  }, []);

  const plans = useMemo(() => {
    const byTier = new Map(defaultPlans.map((plan) => [plan.tier, plan]));
    for (const plan of packages) byTier.set(plan.tier, plan);
    return [byTier.get('free')!, byTier.get('premium')!];
  }, [packages]);

  const handleStartFree = () => {
    router.push(isAuthenticated ? '/dashboard' : '/signup');
  };

  const handleUnlockPremium = () => {
    if (!isAuthenticated) {
      router.push('/signup?next=/pricing');
      return;
    }
    if (isPremium) {
      toast.info('VoiceVault Premium is already active.');
      router.push('/dashboard');
      return;
    }

    setCheckoutLoading(true);
    paymentsApi
      .createCheckoutSession()
      .then((response) => {
        if (response.checkout_url) {
          window.location.assign(response.checkout_url);
        } else {
          toast.error('Unable to start checkout. Please try again.');
          setCheckoutLoading(false);
        }
      })
      .catch((err: unknown) => {
        toast.error(getApiErrorMessage(err, 'Failed to start checkout'));
        setCheckoutLoading(false);
      });
  };

  if (isLoading) {
    return (
      <div className="min-h-dvh bg-background">
        <OnboardingHeader />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
          <Loader2 className="h-9 w-9 animate-spin text-primary" strokeWidth={1.75} />
          <p className="text-sm text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <OnboardingHeader />

      <main>
        <section className="border-b border-border bg-gradient-to-b from-accent/60 to-background py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
            <p className="eyebrow mb-3">Pricing</p>
            <h1 className="font-heading tracking-tight text-4xl font-semibold text-foreground text-balance sm:text-5xl">
              Start free. Pay once to keep it forever.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Try VoiceVault at no cost. Upgrade once to unlock your full voice, with no subscription.
            </p>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {plans.map((plan) => {
              const premium = plan.tier === 'premium';
              return (
                <div
                  key={plan.tier}
                  className={`flex h-full min-w-0 flex-col rounded-2xl bg-card p-5 sm:p-8 ${
                    premium ? 'border-2 border-primary shadow-sm' : 'border border-border'
                  }`}
                >
                  <div className="mb-6 flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-11 w-11 items-center justify-center rounded-xl ${
                          premium ? 'bg-accent text-primary' : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {premium ? <Mic className="h-5 w-5" /> : <MessageSquare className="h-5 w-5" />}
                      </span>
                      <h2 className="text-lg font-semibold text-foreground">{plan.name}</h2>
                    </div>
                    {premium && (
                      <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                        Recommended
                      </span>
                    )}
                  </div>

                  <div className="mb-6">
                    <div className="flex items-baseline gap-2">
                      <span className="text-5xl font-semibold text-foreground">{plan.price_display}</span>
                      <span className="text-sm text-muted-foreground">{premium ? 'one time' : 'free'}</span>
                    </div>
                    {premium && (
                      <p className="mt-2 text-sm text-muted-foreground">Lifetime access. No subscription.</p>
                    )}
                  </div>

                  {premium && (
                    <div className="mb-6 grid grid-cols-1 gap-3 min-[400px]:grid-cols-2">
                      {premiumHighlights.map(({ icon: Icon, label, desc }) => (
                        <div key={label} className="flex items-start gap-2.5 rounded-xl bg-muted p-3">
                          <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={1.75} />
                          <div>
                            <p className="text-sm font-semibold text-foreground">{label}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <ul className="mb-8 flex-1 space-y-3">
                    {plan.features.map((feature) => {
                      const excluded = /^(no |text-only)/i.test(feature);
                      return (
                        <li key={feature} className="flex items-start gap-3 text-sm">
                          {excluded ? (
                            <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={2.5} aria-hidden />
                          ) : (
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" strokeWidth={2.5} aria-hidden />
                          )}
                          <span className={excluded ? 'text-muted-foreground' : 'text-foreground/90'}>
                            {excluded && <span className="sr-only">Not included: </span>}
                            {feature}
                          </span>
                        </li>
                      );
                    })}
                  </ul>

                  <Button
                    onClick={premium ? handleUnlockPremium : handleStartFree}
                    disabled={(premium && (checkoutLoading || isPremium)) || (!premium && isAuthenticated)}
                    variant={premium ? 'default' : 'outline'}
                    size="lg"
                    className="w-full"
                  >
                    {premium && checkoutLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Redirecting...
                      </>
                    ) : premium && isPremium ? (
                      <>
                        <Check className="h-4 w-4" />
                        Premium active
                      </>
                    ) : premium ? (
                      <>
                        <Lock className="h-4 w-4" />
                        Unlock Premium for {plan.price_display}
                      </>
                    ) : (
                      <>
                        {isPremium ? 'Included with Premium' : isAuthenticated ? 'Current plan' : 'Create free account'}
                        {isPremium ? <Check className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      </>
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-12 sm:px-6">
          <div className="mb-6 text-center">
            <p className="eyebrow">Compare plans</p>
            <h2 className="mt-2 text-2xl font-semibold text-foreground sm:text-3xl">
              What you get with each plan
            </h2>
          </div>
          <div className="surface overflow-hidden">
            <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2 border-b border-border bg-secondary/50 px-3 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-6">
              <span>Feature</span>
              <span>Memory Starter</span>
              <span className="text-primary">Premium</span>
            </div>
            {[
              ['Guided questions', '5', 'All 30'],
              ['Recording time', '15 minutes', 'Up to 5 hours'],
              ['Cloned voice', 'Not included', 'Included'],
              ['Family chat', '5 messages', '1,000 messages / month'],
              ['Family members', '1 invitation', 'Up to 10'],
              ['Encrypted, private storage', 'Included', 'Included'],
              ['Price', 'Free', 'One-time payment'],
            ].map(([label, free, premium]) => (
              <div
                key={label}
                className="grid grid-cols-[1.2fr_1fr_1fr] items-center gap-2 border-b border-border px-3 py-3 text-xs sm:text-sm last:border-b-0 sm:px-6"
              >
                <span className="font-medium text-foreground">{label}</span>
                <span className="text-muted-foreground">{free}</span>
                <span className="font-medium text-foreground">{premium}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-4 pb-20 sm:px-6">
          <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:gap-6 sm:p-7">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">
              <Shield className="h-6 w-6" strokeWidth={1.75} />
            </span>
            <div className="flex-1">
              <h3 className="text-base font-semibold text-foreground sm:text-lg">
                {isPremium
                  ? 'Your complete VoiceVault is active.'
                  : isAuthenticated
                    ? 'Your free vault is active.'
                    : '30-day guarantee on Premium.'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {isPremium
                  ? 'Go back to your home page to keep recording and sharing.'
                  : 'Premium is an optional one-time upgrade for voice cloning, all 30 questions and more family members.'}
              </p>
            </div>
            <Button asChild variant="outline" className="shrink-0">
              <Link href={isAuthenticated ? '/dashboard' : '/#how-it-works'}>
                {isAuthenticated ? 'Back to home' : 'How it works'}
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
