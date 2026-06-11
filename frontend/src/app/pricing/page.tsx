'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { paymentsApi, Package } from '@/lib/api/payments';
import { Button } from '@/components/ui/button';
import { Loader2, Check, ArrowRight, Lock, Mic, MessageSquare, Shield, Zap, Users, Star } from 'lucide-react';
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
      '30+ guided questions',
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
  { icon: Mic, label: 'Voice Cloning', desc: 'Family hears you in your own voice' },
  { icon: Zap, label: 'AI Personality', desc: 'Learns your unique way of speaking' },
  { icon: Users, label: '10 Members', desc: 'Whole family stays connected' },
  { icon: Shield, label: 'Lifetime Access', desc: 'One-time payment, forever yours' },
];

export default function PricingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, user } = useAuthStore();
  const [packages, setPackages] = useState<Package[]>(defaultPlans);
  const [isLoading, setIsLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
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
      router.push('/signup');
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
      <div className="min-h-screen bg-background">
        <OnboardingHeader />
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-5">
          <Loader2 className="h-9 w-9 animate-spin text-primary" strokeWidth={1.75} />
          <p className="text-sm text-muted-foreground">Loading pricing...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />

      <main>
        {/* ─── HERO ──────────────────────────────────────────── */}
        <section className="relative overflow-hidden py-14 sm:py-16 md:py-20">
          <div
            className="pointer-events-none absolute inset-0"
            style={{ background: 'linear-gradient(180deg, hsl(var(--primary) / 0.08), transparent 58%)' }}
            aria-hidden
          />
          <div
            className="absolute top-0 left-0 right-0 h-px"
            style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.3), transparent)' }}
          />

          <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            >
              <p className="mb-4 text-[11px] font-semibold uppercase text-primary/80">
                Pricing
              </p>
              <h1 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
                Preserve a Legacy.{' '}
                <span className="text-gradient-amber italic">Start for Free.</span>
              </h1>
              <p className="mt-4 text-base text-muted-foreground sm:text-lg">
                Give your family a meaningful first experience free. Upgrade once to unlock the full,
                living memory vault — complete with voice cloning.
              </p>
            </motion.div>
          </div>
        </section>

        {/* ─── PLAN CARDS ────────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-10 sm:px-6">
          <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
            {plans.map((plan, i) => {
              const premium = plan.tier === 'premium';
              return (
                <motion.div
                  key={plan.tier}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div
                    className={`relative h-full overflow-hidden rounded-lg border transition-all duration-300 ${
                      premium
                        ? 'border-primary/30 bg-card/60 hover:border-primary/50'
                        : 'border-border bg-card/35 hover:border-primary/25 hover:bg-muted/40'
                    }`}
                  >
                    {premium && (
                      <div
                        className="pointer-events-none absolute inset-0"
                        style={{ background: 'linear-gradient(180deg, hsl(var(--primary) / 0.08), transparent 62%)' }}
                        aria-hidden
                      />
                    )}

                    {/* Top accent line */}
                    {premium && (
                      <div
                        className="absolute top-0 left-0 right-0 h-px"
                        style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.6), transparent)' }}
                      />
                    )}

                    <div className="relative p-6 sm:p-8">
                      {/* Plan header */}
                      <div className="flex items-start justify-between gap-3 mb-6">
                        <div className="flex items-center gap-3">
                          <div className={`flex h-11 w-11 items-center justify-center rounded-lg ${premium ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                            {premium ? <Mic className="h-5 w-5" strokeWidth={1.75} /> : <MessageSquare className="h-5 w-5" strokeWidth={1.75} />}
                          </div>
                          <div>
                            <h2 className="font-heading text-lg font-bold text-foreground">{plan.name}</h2>
                            {premium && (
                              <div className="mt-0.5 flex items-center gap-1">
                                {[1,2,3].map(i => <Star key={i} className="h-3 w-3 fill-primary/70 text-primary/70" strokeWidth={0} />)}
                                <span className="text-[11px] text-primary/70 font-medium ml-0.5">Most popular</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${premium ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {premium ? 'Best Value' : 'Free Forever'}
                        </span>
                      </div>

                      {/* Price */}
                      <div className="mb-6">
                        <div className="flex items-baseline gap-2">
                          <span className={`font-heading text-5xl font-bold ${premium ? 'text-gradient-amber' : 'text-foreground'}`}>
                            {plan.price_display}
                          </span>
                          <span className="text-sm text-muted-foreground">{premium ? 'one-time' : 'forever free'}</span>
                        </div>
                        {premium && (
                          <p className="mt-1.5 text-sm text-muted-foreground">
                            Lifetime access · No subscriptions · No surprises
                          </p>
                        )}
                      </div>

                      {/* Premium highlights grid */}
                      {premium && (
                        <div className="mb-6 grid grid-cols-2 gap-2.5">
                          {premiumHighlights.map(({ icon: Icon, label, desc }) => (
                            <div key={label} className="flex items-start gap-2.5 rounded-lg border border-border bg-background/35 p-3">
                              <Icon className="h-4 w-4 mt-0.5 shrink-0 text-primary" strokeWidth={1.75} />
                              <div>
                                <p className="text-[12px] font-semibold text-foreground">{label}</p>
                                <p className="text-[11px] text-muted-foreground/70 mt-0.5">{desc}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Feature list */}
                      <ul className="mb-6 space-y-2.5">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-3 text-sm">
                            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${premium ? 'text-primary' : 'text-teal-500/70'}`} strokeWidth={2.5} />
                            <span className={premium ? 'text-foreground/90' : 'text-muted-foreground'}>{feature}</span>
                          </li>
                        ))}
                      </ul>

                      {/* CTA Button */}
                      <Button
                        onClick={premium ? handleUnlockPremium : handleStartFree}
                        disabled={premium && checkoutLoading}
                        className={`h-12 w-full gap-2 rounded-lg text-sm font-semibold transition-all duration-300 ${
                          premium
                            ? 'shimmer-btn glow-amber-sm text-primary-foreground shadow-none hover:scale-[1.02]'
                            : 'border border-border bg-card/60 text-foreground hover:border-primary/30 hover:bg-muted/70'
                        }`}
                      >
                        {premium && checkoutLoading ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Redirecting...
                          </>
                        ) : premium ? (
                          <>
                            <Lock className="h-4 w-4" />
                            Unlock Premium — {plan.price_display}
                          </>
                        ) : (
                          <>
                            Start Free Today
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </section>

        {/* ─── TRUST SECTION ─────────────────────────────────── */}
        <section className="mx-auto max-w-5xl px-4 pb-16 sm:px-6 sm:pb-20">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="rounded-lg border border-border bg-card/50 p-6 sm:p-7"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-6">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-primary/12 text-primary">
                <Shield className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="font-heading text-base font-semibold text-foreground sm:text-lg">
                  You have created something meaningful.
                </h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Upgrade to VoiceVault Premium to unlock the full memory vault, complete voice cloning,
                  and allow your family to hear these stories in your own voice — forever.
                </p>
              </div>
              <Button
                asChild
                variant="ghost"
                className="h-10 shrink-0 rounded-lg border border-border bg-card/60 px-5 text-sm font-medium hover:border-primary/30 hover:bg-muted/70"
              >
                <Link href="/">Learn More</Link>
              </Button>
            </div>
          </motion.div>

          <div className="mt-6 text-center text-sm text-muted-foreground/60">
            <Link href="/" className="transition-colors hover:text-muted-foreground">Home</Link>
            {' · '}
            <Link href="/#how-it-works" className="transition-colors hover:text-muted-foreground">How it works</Link>
            {' · '}
            <Link href="/terms" className="transition-colors hover:text-muted-foreground">Terms</Link>
            {' · '}
            <Link href="/privacy" className="transition-colors hover:text-muted-foreground">Privacy</Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
