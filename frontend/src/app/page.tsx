'use client';

import { useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { ArrowRight, Mic, Brain, Users, Shield, ChevronRight, Star, Play, CheckCircle } from 'lucide-react';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { SoundWave } from '@/components/home/SoundWave';

const HeroBackground = dynamic(
  () => import('@/components/home/HeroBackground').then((mod) => mod.HeroBackground),
  { ssr: false }
);

const featureData = [
  {
    icon: Mic,
    label: 'For Your Children',
    title: 'Your children will still hear your advice.',
    description: 'Answer guided questions about life, love, and lessons learned. Your wisdom stays close when they need it most.',
    accent: 'amber' as const,
    number: '01',
  },
  {
    icon: Brain,
    label: 'For Your Grandkids',
    title: 'Your grandchildren will know your stories.',
    description: 'AI learns your personality, humor, and way of speaking. Future generations connect with the real you.',
    accent: 'teal' as const,
    number: '02',
  },
  {
    icon: Users,
    label: 'For Your Partner',
    title: 'Your spouse will still hear you say "I love you."',
    description: 'Preserve intimate moments, pet names, inside jokes, and the warmth only you could offer.',
    accent: 'purple' as const,
    number: '03',
  },
  {
    icon: Shield,
    label: 'Forever',
    title: "Your wisdom won't disappear. Your laughter won't fade into memory.",
    description: 'One recording session creates a living legacy that speaks, answers, and loves — in your own voice.',
    accent: 'amber' as const,
    number: '04',
  },
];

const bannerLines = [
  "They'll hear you say I love you. Forever.",
  "Your story deserves more than silence.",
  "One hour now. Forever for them.",
  "Don't wait until it's too late.",
  "Give them what they'll cherish most — you.",
  "Your laughter. Your wisdom. Your voice. Preserved.",
  "Preserve it before it becomes a memory.",
  "Leave a legacy that speaks.",
];

const steps = [
  { number: '01', title: 'Record Your Voice', description: 'Answer 30+ guided questions about your life, values, and memories in your own words.', icon: Mic, color: 'amber' },
  { number: '02', title: 'AI Learns You', description: 'Our AI studies your voice patterns, personality, and stories to build your living memory.', icon: Brain, color: 'teal' },
  { number: '03', title: 'Family Hears You', description: 'Your loved ones chat with your AI — in your voice — anytime they need guidance or comfort.', icon: Users, color: 'purple' },
];

const testimonials = [
  { name: 'Michael R.', initials: 'MR', role: 'Father of 3', body: 'I lost my dad young. VoiceVault gave me the chance to give my own children what I never had. This isn\'t just an app. It\'s a gift.', date: 'Jan 15, 2025' },
  { name: 'Patricia L.', initials: 'PL', role: 'Grandmother', body: 'I\'ve been wanting to pass down our family history for years. Now when my grandkids ask questions, they can hear me in my own voice. It feels like I\'m really there.', date: 'Feb 3, 2025' },
  { name: 'David & Sarah K.', initials: 'DS', role: 'Married couple', body: 'We both recorded our voices for our spouse. Knowing we can still say \'I love you\' in our real voices one day brings us so much peace.', date: 'Feb 8, 2025' },
  { name: 'Jennifer M.', initials: 'JM', role: 'Widow', body: 'My husband passed last year. What I miss most is his voice. For anyone who still has time—please do this. Your family will thank you forever.', date: 'Feb 12, 2025' },
  { name: 'Robert T.', initials: 'RT', role: 'Retired teacher', body: 'Recording wasn\'t just checking a box. Now my wisdom, my values, and my voice are preserved. I feel like I\'ve done something that matters.', date: 'Feb 18, 2025' },
  { name: 'Linda H.', initials: 'LH', role: 'Grandmother', body: 'My daughter moved abroad. VoiceVault lets her children hear their grandma whenever they want. We feel closer than ever.', date: 'Feb 5, 2025' },
  { name: 'James W.', initials: 'JW', role: 'Father', body: 'I\'ve always been bad at expressing myself. The questions guided me. Now my kids will finally understand who I am.', date: 'Feb 9, 2025' },
  { name: 'Maria S.', initials: 'MS', role: 'Mother', body: 'I have a health scare. Knowing my voice will be there for my teenagers no matter what—I sleep better at night.', date: 'Feb 14, 2025' },
  { name: 'Thomas B.', initials: 'TB', role: 'Grandfather', body: 'Took less than an hour. The result feels like a lifetime. My grandchildren will know exactly how their grandpa sounds.', date: 'Feb 16, 2025' },
  { name: 'Susan P.', initials: 'SP', role: 'Wife', body: 'My husband and I recorded together. Our kids cried when they first heard us. They said it felt like we were in the room.', date: 'Feb 20, 2025' },
];

const trustItems = [
  '256-bit encryption',
  'Private & secure',
  'Lifetime access',
  '30-day guarantee',
];

const fadeUp = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] },
};

const accentColorMap = {
  amber: { bg: 'bg-primary/12', text: 'text-primary', border: 'border-primary/20', bar: 'bg-primary' },
  teal: { bg: 'bg-teal-500/12', text: 'text-teal-400', border: 'border-teal-500/20', bar: 'bg-teal-500' },
  purple: { bg: 'bg-purple-500/12', text: 'text-purple-400', border: 'border-purple-500/20', bar: 'bg-purple-500' },
};

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />

      {/* ─── HERO ────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden py-14 sm:py-18 md:py-24">
        <HeroBackground />

        <div className="relative z-10 mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-4xl text-center"
          >
            {/* Eyebrow badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/8 px-4 py-1.5"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping-slow absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
              </span>
              <span className="text-[12px] font-semibold text-primary">AI Voice Preservation Technology</span>
            </motion.div>

            {/* Main heading */}
            <h1 className="font-heading text-4xl font-bold leading-[1.08] text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
              One Day, Your Voice
              <br />
              Will Be
              <br />
              <span className="text-gradient-amber italic">the Thing They Miss Most.</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">
              Give your family something no photo or video ever could — a living memory that speaks back,
              tells stories, and says <em className="text-foreground/80 not-italic font-medium">&ldquo;I love you&rdquo;</em> in your own voice. Forever.
            </p>

            {/* CTAs */}
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
              <Button asChild size="lg" className="shimmer-btn glow-amber-sm h-12 gap-2 rounded-lg px-8 text-sm font-semibold text-primary-foreground shadow-none transition-all duration-300 hover:scale-[1.04] sm:h-14 sm:px-10 sm:text-base">
                <Link href="/pricing">
                  Preserve My Voice
                  <ArrowRight className="h-4 w-4" strokeWidth={2.5} />
                </Link>
              </Button>
              <Button asChild variant="ghost" size="lg" className="h-12 gap-2 rounded-lg border border-border bg-card/50 px-8 text-sm font-medium text-muted-foreground backdrop-blur-sm transition-all duration-200 hover:border-primary/30 hover:bg-muted/70 hover:text-foreground sm:h-14 sm:px-8">
                <Link href="/login">
                  <Play className="h-4 w-4 fill-current" strokeWidth={0} />
                  Sign In
                </Link>
              </Button>
            </div>

            {/* Trust badges */}
            <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
              {trustItems.map((item) => (
                <span key={item} className="flex items-center gap-1.5 text-[12px] text-muted-foreground/70">
                  <CheckCircle className="h-3.5 w-3.5 text-teal-500/80" strokeWidth={2} />
                  {item}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Sound wave visualization */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="mt-12 flex flex-col items-center gap-3"
          >
            <p className="text-[11px] font-semibold uppercase text-muted-foreground/60">Your voice, preserved forever</p>
            <SoundWave barCount={36} className="h-14 sm:h-16" />
          </motion.div>
        </div>
      </section>

      {/* ─── MARQUEE BANNER ──────────────────────────────────────── */}
      <section
        className="relative border-y py-3"
        aria-label="Why preserve"
        style={{ borderColor: 'hsl(38 95% 55% / 0.12)' }}
      >
        <div
          className="absolute inset-0"
          style={{ background: 'linear-gradient(180deg, hsl(38 95% 55% / 0.04) 0%, transparent 100%)' }}
          aria-hidden
        />
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-r from-background to-transparent" aria-hidden />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-10 w-10 bg-gradient-to-l from-background to-transparent" aria-hidden />
        <div className="overflow-hidden">
          <div className="flex w-max animate-banner-marquee items-center gap-x-10">
            {[...bannerLines, ...bannerLines].flatMap((line, i) => [
              <span key={`banner-${i}`} className="whitespace-nowrap text-[12px] font-medium text-primary/70 sm:text-[13px]">
                {line}
              </span>,
              <span key={`sep-${i}`} className="h-1 w-1 shrink-0 rounded-full bg-primary/20" aria-hidden />,
            ])}
          </div>
        </div>
      </section>

      {/* ─── WHAT YOU'RE PRESERVING ──────────────────────────────── */}
      <section className="py-16 sm:py-20 md:py-24" aria-label="What you preserve">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mb-10 sm:mb-12">
            <p className="text-[11px] font-semibold uppercase text-primary/80">
              What you preserve
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              A Gift That Speaks
              <span className="text-gradient-amber italic"> Across Time</span>
            </h2>
            <p className="mt-3 max-w-xl text-base text-muted-foreground">
              Your voice carries decades of love, laughter, and wisdom. Don&apos;t let it disappear.
            </p>
          </motion.div>

          <ExpandableFeatureCards />
        </div>
      </section>

      {/* ─── HOW IT WORKS ────────────────────────────────────────── */}
      <section
        id="how-it-works"
        className="relative py-16 sm:py-20 md:py-24"
        style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--surface-raised)) 50%, hsl(var(--background)) 100%)' }}
      >
        {/* Section top separator */}
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.18), hsl(var(--secondary) / 0.14), transparent)' }}
        />
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--secondary) / 0.14), hsl(var(--primary) / 0.1), transparent)' }}
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mb-12 sm:mb-14">
            <p className="text-[11px] font-semibold uppercase text-primary/80">
              How it works
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl md:text-5xl">
              Don&apos;t Let Your Story{' '}
              <span className="text-gradient-amber italic">End With You.</span>
            </h2>
            <p className="mt-3 max-w-lg text-base text-muted-foreground">
              Three simple steps. One hour of your time. A lifetime gift for everyone you love.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-6 lg:gap-8">
            {steps.map((step, i) => {
              const Icon = step.icon;
              const colors = accentColorMap[step.color as keyof typeof accentColorMap];
              return (
                <motion.div
                  key={step.number}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                >
                  <div className="group relative h-full rounded-lg border border-border bg-card/50 p-6 transition-all duration-300 hover:border-primary/30 hover:bg-muted/40 sm:p-7">
                    {/* Step number — large background art */}
                    <div className="absolute right-5 top-4 font-heading text-[72px] font-bold leading-none text-white/[0.03] select-none">
                      {step.number}
                    </div>

                    {/* Icon */}
                    <div className={`mb-5 flex h-12 w-12 items-center justify-center rounded-lg ${colors.bg} ${colors.text} transition-colors duration-300 group-hover:scale-110`}>
                      <Icon className="h-6 w-6" strokeWidth={1.75} />
                    </div>

                    {/* Step label */}
                    <p className={`mb-2 text-[11px] font-semibold uppercase ${colors.text}`}>
                      Step {step.number}
                    </p>

                    <h3 className="font-heading text-xl font-semibold text-foreground sm:text-2xl">
                      {step.title}
                    </h3>
                    <p className="mt-2.5 text-sm leading-relaxed text-muted-foreground sm:text-base">
                      {step.description}
                    </p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── EMOTIONAL CTA BANNER ────────────────────────────────── */}
      <section className="relative overflow-hidden py-16 sm:py-20 md:py-24" aria-label="Preserve your voice">
        {/* Background */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary) / 0.08), transparent 44%, hsl(var(--secondary) / 0.06))',
          }}
          aria-hidden
        />

        <div className="relative z-10 mx-auto max-w-3xl px-4 text-center sm:px-6">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-lg bg-primary/15 ring-1 ring-primary/30">
              <Mic className="h-7 w-7 text-primary" strokeWidth={1.75} />
            </div>

            <h2 className="font-heading text-3xl font-bold leading-tight text-foreground sm:text-4xl md:text-5xl">
              Your voice is{' '}
              <span className="text-gradient-amber italic">irreplaceable.</span>
            </h2>

            <p className="mx-auto mt-5 max-w-xl text-lg text-muted-foreground">
              Don&apos;t let it become a memory they can&apos;t hear.{' '}
              <strong className="font-semibold text-foreground/90">One hour today</strong> gives your family a
              living legacy — forever.
            </p>

            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="shimmer-btn glow-amber h-14 gap-2.5 rounded-lg px-10 text-base font-semibold text-primary-foreground shadow-none transition-all duration-300 hover:scale-[1.04]"
              >
                <Link href="/pricing">
                  Preserve My Voice — Starts at $99
                  <ArrowRight className="h-5 w-5" strokeWidth={2.5} />
                </Link>
              </Button>
            </div>

            <p className="mt-4 text-sm text-muted-foreground/60">
              One-time payment · Lifetime access · 30-day guarantee
            </p>
          </motion.div>
        </div>
      </section>

      {/* ─── TESTIMONIALS ────────────────────────────────────────── */}
      <section
        className="relative py-16 sm:py-20 md:py-24"
        aria-label="Testimonials"
        style={{ background: 'linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--surface-raised)) 50%, hsl(var(--background)) 100%)' }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{ background: 'linear-gradient(90deg, transparent, hsl(var(--accent) / 0.18), hsl(var(--primary) / 0.18), transparent)' }}
        />

        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <motion.div {...fadeUp} className="mb-10">
            <p className="text-[11px] font-semibold uppercase text-primary/80">
              Testimonials
            </p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-foreground sm:text-4xl">
              What <span className="text-gradient-amber">Families</span> Say
            </h2>
          </motion.div>

          <div className="relative">
            <div className="pointer-events-none absolute left-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-r from-[hsl(var(--surface-raised))] to-transparent sm:w-16" aria-hidden />
            <div className="pointer-events-none absolute right-0 top-0 bottom-0 z-20 w-12 bg-gradient-to-l from-[hsl(var(--surface-raised))] to-transparent sm:w-16" aria-hidden />
            <div className="overflow-hidden">
              <div className="flex w-max gap-3 animate-testimonials-scroll">
                {[...testimonials, ...testimonials].map((t, i) => (
                  <TestimonialCard key={`${t.name}-${i}`} t={t} />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   EXPANDABLE FEATURE CARDS
══════════════════════════════════════════════════════════════════ */
function ExpandableFeatureCards() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0);

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:gap-2.5 lg:h-56">
      {featureData.map((card, idx) => {
        const isExpanded = expandedIndex === idx;
        const colors = accentColorMap[card.accent];
        const Icon = card.icon;

        return (
          <motion.article
            key={card.label}
            layout
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className={`group relative overflow-hidden rounded-lg border cursor-pointer transition-all duration-300 ${
              isExpanded
                ? `border-primary/25 bg-card/60 lg:flex-[2.5] lg:min-w-[280px]`
                : 'border-border bg-card/35 hover:bg-muted/45 hover:border-primary/25 lg:flex-1 lg:min-w-[90px]'
            }`}
            onClick={() => setExpandedIndex(isExpanded ? null : idx)}
            role="button"
            aria-expanded={isExpanded}
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpandedIndex(isExpanded ? null : idx); }}}
          >
            {/* Accent bar */}
            <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${colors.bar} ${isExpanded ? 'opacity-60' : 'opacity-20'} transition-opacity duration-300`} />

            {/* Background glow when expanded */}
            {isExpanded && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{ background: `linear-gradient(90deg, ${card.accent === 'amber' ? 'hsl(var(--primary) / 0.07)' : card.accent === 'teal' ? 'hsl(var(--secondary) / 0.07)' : 'hsl(var(--accent) / 0.08)'}, transparent 72%)` }}
                aria-hidden
              />
            )}

            <div className={`relative p-4 sm:p-5 ${isExpanded ? 'pr-10' : ''}`}>
              {/* Number + icon row */}
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-[10px] font-mono font-semibold tabular-nums ${colors.text} opacity-60`}>
                  {card.number}
                </span>
                <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${colors.bg} ${colors.text} transition-transform duration-300 ${isExpanded ? 'scale-110' : 'group-hover:scale-105'}`}>
                  <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
                </div>
              </div>

              {/* Label */}
              <p className="font-heading text-sm font-semibold text-foreground lg:text-base">{card.label}</p>

              {/* Expanded content */}
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="mt-2"
                >
                  <p className="text-sm leading-relaxed text-muted-foreground">{card.title}</p>
                  <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground/70">{card.description}</p>
                </motion.div>
              )}
            </div>

            {/* Expand chevron */}
            <div className={`absolute right-3 top-4 flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200 ${isExpanded ? 'bg-muted text-foreground' : 'bg-muted/55 text-muted-foreground group-hover:text-foreground'}`}>
              <motion.span
                animate={{ rotate: isExpanded ? 90 : 0 }}
                transition={{ duration: 0.22, ease: 'easeInOut' }}
                className="inline-flex"
              >
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </motion.span>
            </div>
          </motion.article>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   TESTIMONIAL CARD
══════════════════════════════════════════════════════════════════ */
const avatarGradients = [
  'from-amber-500/30 to-orange-600/20',
  'from-teal-500/30 to-emerald-600/20',
  'from-purple-500/30 to-indigo-600/20',
  'from-rose-500/30 to-pink-600/20',
  'from-blue-500/30 to-cyan-600/20',
];

function TestimonialCard({ t, idx = 0 }: { t: (typeof testimonials)[0]; idx?: number }) {
  const gradIdx = idx % avatarGradients.length;
  return (
    <article className="flex w-[260px] shrink-0 flex-col gap-3 rounded-lg border border-border bg-card/55 px-4 py-4 transition-all duration-200 hover:border-primary/25 hover:bg-muted/40 sm:w-[290px]">
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br ${avatarGradients[gradIdx]} text-[11px] font-bold text-foreground ring-1 ring-border`}>
            {t.initials}
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground leading-tight">{t.name}</p>
            <p className="text-[11px] text-muted-foreground/60 leading-tight mt-0.5">{t.role}</p>
          </div>
        </div>
        <div className="flex gap-0.5" aria-label="5 stars">
          {[1, 2, 3, 4, 5].map((i) => (
            <Star key={i} className="h-3 w-3 fill-primary/60 text-primary/60" strokeWidth={0} />
          ))}
        </div>
      </div>

      {/* Quote */}
      <p className="text-sm leading-[1.65] text-muted-foreground line-clamp-4">{t.body}</p>

      {/* Date */}
      <span className="text-[10px] text-muted-foreground/40 mt-auto">{t.date}</span>
    </article>
  );
}
