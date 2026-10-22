'use client';

import { StickyCta } from '@/components/home/StickyCta';
import { VoiceSample } from '@/components/home/VoiceSample';
import { FamilyStories } from '@/components/home/FamilyStories';
import Link from 'next/link';
import {
  ArrowRight,
  Mic,
  Brain,
  Users,
  ShieldCheck,
  Lock,
  Infinity as InfinityIcon,
  BadgeCheck,
  Play,
  Check,
  X,
  ChevronDown,
  AudioLines,
  MessageSquare,
  ListChecks,
  UserCheck,
  Trash2,
} from 'lucide-react';
import { OnboardingHeader, SiteFooter } from '@/components/layout';
import { ProgressRing } from '@/components/ui/progress-ring';
import { useAuthStore } from '@/store/auth';

const trustBar = [
  { icon: Lock, label: '256-bit encryption' },
  { icon: ShieldCheck, label: 'Private by default' },
  { icon: InfinityIcon, label: 'Lifetime access' },
  { icon: BadgeCheck, label: '30-day guarantee' },
];

const steps = [
  {
    icon: Mic,
    title: 'Record',
    body: 'Answer 30 guided questions about your life, values and memories. Pause any time and pick up where you left off.',
  },
  {
    icon: Brain,
    title: 'Build',
    body: 'VoiceVault learns how you speak and what matters to you, and prepares a voice that sounds like yours.',
  },
  {
    icon: Users,
    title: 'Share',
    body: 'Invite the people you choose. They can ask questions and hear answers in your voice, whenever they need.',
  },
];

const comparison = [
  { feature: 'Answers new questions', vv: true, photos: false, voicemail: false },
  { feature: 'Sounds like you', vv: true, photos: false, voicemail: true },
  { feature: 'Shares your stories and advice', vv: true, photos: false, voicemail: false },
  { feature: 'You choose who has access', vv: true, photos: true, voicemail: true },
];

const faqs = [
  {
    q: 'How long does recording take?',
    a: 'Most people finish in about an hour. You can stop at any point and continue later, and your answers are saved as you go.',
  },
  {
    q: 'Who can talk to my AI?',
    a: 'Only the family members you invite. You can see who has access and remove anyone from the Family page.',
  },
  {
    q: 'What do I get for free?',
    a: 'The free plan lets you try the experience with 5 guided questions and text chat. Voice cloning and the full 30 questions are part of Premium.',
  },
  { q: 'Is Premium a subscription?', a: 'No. Premium is a single payment for lifetime access.' },
  { q: 'Can I get a refund?', a: 'Yes. There is a 30-day guarantee on Premium.' },
];

const bars = [30, 55, 40, 75, 50, 90, 60, 80, 45, 70, 35, 60, 85, 50, 65, 40, 55, 30, 70, 45, 60, 35];

function Check2({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-accent text-primary">
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      <span className="sr-only">Yes</span>
    </span>
  ) : (
    <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground/60">
      <X className="h-3.5 w-3.5" strokeWidth={3} aria-hidden />
      <span className="sr-only">No</span>
    </span>
  );
}

export default function HomePage() {
  const { isAuthenticated } = useAuthStore();
  const startHref = isAuthenticated ? '/dashboard' : '/signup';
  const startLabel = isAuthenticated ? 'Open my vault' : 'Start free';

  return (
    <div className="min-h-dvh bg-background">
      <OnboardingHeader />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_60%_at_70%_30%,black,transparent)]" aria-hidden />
          <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 py-16 sm:px-6 md:py-24 lg:grid-cols-[1.05fr_0.95fr]">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-card">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                Voice legacy for families
              </span>
              <h1 className="mt-5 text-4xl font-semibold leading-[1.08] text-foreground text-balance sm:text-5xl lg:text-6xl">
                One day, your voice will be what they miss most.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground">
                Record your stories once. Your family can ask questions and hear your answers in your own voice, for as long as they need.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={startHref}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-primary px-7 text-base font-semibold text-primary-foreground shadow-card transition-colors hover:bg-primary/90"
                >
                  {startLabel}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="#how-it-works"
                  className="inline-flex h-12 items-center justify-center rounded-[10px] border border-input bg-card px-7 text-base font-semibold text-foreground transition-colors hover:bg-muted"
                >
                  See how it works
                </Link>
              </div>
              <p className="mt-4 text-sm text-muted-foreground">Free to start. No card needed.</p>
            </div>

            {/* Product preview (illustration) */}
            <div className="relative" aria-label="Illustration of the VoiceVault dashboard">
              <div className="surface relative p-6 shadow-lift">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Vault overview (sample)</p>
                    <p className="mt-1 text-lg font-semibold text-foreground">Your voice vault</p>
                  </div>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">AI ready</span>
                </div>

                <div className="mt-6 flex items-center gap-6">
                  <ProgressRing value={100} size={108} stroke={9} sublabel="complete" />
                  <dl className="grid flex-1 grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs text-muted-foreground">Questions</dt>
                      <dd className="num text-2xl font-semibold text-foreground">30</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Family</dt>
                      <dd className="num text-2xl font-semibold text-foreground">4</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Hours</dt>
                      <dd className="num text-2xl font-semibold text-foreground">1.2</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">Voice</dt>
                      <dd className="text-2xl font-semibold text-primary">Ready</dd>
                    </div>
                  </dl>
                </div>

                <div className="mt-6 rounded-xl bg-muted p-4">
                  <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2 text-sm text-primary-foreground">
                    Dad, how did you know Mum was the one?
                  </div>
                  <div className="mt-3 flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-card">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                      <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
                    </span>
                    <div className="flex h-8 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
                      {bars.map((h, i) => (
                        <span key={i} className="w-1 shrink-0 rounded-full bg-primary/55" style={{ height: `${h}%` }} />
                      ))}
                    </div>
                    <span className="num text-xs text-muted-foreground">0:14</span>
                  </div>
                </div>
              </div>

              <div className="surface absolute -bottom-5 -left-3 hidden items-center gap-3 px-4 py-3 shadow-lift sm:flex">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-primary">
                  <ShieldCheck className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">Encrypted</p>
                  <p className="text-xs text-muted-foreground">Only your family</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust bar */}
        <section className="border-b border-border bg-card">
          <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-y-4 px-4 py-6 sm:px-6 md:grid-cols-4">
            {trustBar.map((t) => (
              <li key={t.label} className="flex items-center justify-center gap-2.5 text-sm font-medium text-foreground">
                <t.icon className="h-4.5 w-4.5 text-primary" />
                {t.label}
              </li>
            ))}
          </ul>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow mb-3">How it works</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">Three steps, about an hour</h2>
            </div>
            <ol className="relative mt-14 grid gap-6 md:grid-cols-3">
              <div className="absolute left-[16.6%] right-[16.6%] top-6 hidden h-px bg-border md:block" aria-hidden />
              {steps.map((s, i) => (
                <li key={s.title} className="relative text-center">
                  <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card">
                    <s.icon className="h-5 w-5" />
                  </span>
                  <p className="num mt-4 text-xs font-semibold text-muted-foreground">Step {i + 1}</p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">{s.title}</h3>
                  <p className="mx-auto mt-2 max-w-xs text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Feature bento */}
        <section className="border-y border-border bg-card py-14 md:py-20">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow mb-3">What you get</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">Built around the people who will listen</h2>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              <div className="brand-wash min-w-0 rounded-2xl border border-border p-7 md:col-span-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <AudioLines className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">A voice that sounds like yours</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                  With Premium, your recordings are used to create a voice for your AI, so the answers your family hears sound like you.
                </p>
                <div className="mt-6 flex h-14 items-center gap-[3px] overflow-hidden" aria-hidden>
                  {[...bars, ...bars].map((h, i) => (
                    <span key={i} className="w-1 shrink-0 rounded-full bg-primary/45" style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-border bg-background p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <ListChecks className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">Guided questions</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Thirty prompts on family, career, wisdom and personality, so you are never staring at a blank page.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-7">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                  <MessageSquare className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-semibold text-foreground">Real conversations</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Your family asks in their own words and gets answers shaped by your stories and way of speaking.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-background p-7 md:col-span-2">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                      <Users className="h-5 w-5" />
                    </span>
                    <h3 className="mt-5 text-xl font-semibold text-foreground">Access you control</h3>
                    <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                      Invite family by email, see who has joined, and remove access whenever you choose.
                    </p>
                  </div>
                  <ul className="hidden w-60 shrink-0 space-y-2 sm:block" aria-label="Example family list">
                    {[
                      { n: 'Sarah', s: 'Active', ok: true },
                      { n: 'Daniel', s: 'Active', ok: true },
                      { n: 'Maya', s: 'Invited', ok: false },
                    ].map((m) => (
                      <li key={m.n} className="flex items-center justify-between rounded-xl bg-card px-3 py-2 shadow-card">
                        <span className="flex items-center gap-2.5 text-sm font-medium text-foreground">
                          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-primary">
                            {m.n[0]}
                          </span>
                          {m.n}
                        </span>
                        <span className={`text-xs font-medium ${m.ok ? 'text-primary' : 'text-muted-foreground'}`}>{m.s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </section>

        <VoiceSample />

        {/* Comparison */}
        <section className="border-y border-border bg-card py-14 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow mb-3">Why VoiceVault</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">More than a photo or a voicemail</h2>
            </div>
            <div className="surface mt-10 overflow-hidden">
              <table className="w-full table-fixed text-sm">
                <colgroup>
                  <col className="w-[38%]" />
                  <col />
                  <col />
                  <col />
                </colgroup>
                <thead>
                  <tr className="border-b border-border text-left">
                    <th className="p-3 font-medium text-muted-foreground sm:p-4"><span className="sr-only">Feature</span></th>
                    <th className="p-2 text-center text-xs font-semibold text-primary sm:p-4 sm:text-sm">VoiceVault</th>
                    <th className="p-2 text-center text-xs font-medium text-muted-foreground sm:p-4 sm:text-sm"><span className="sm:hidden">Photos</span><span className="hidden sm:inline">Photos and video</span></th>
                    <th className="p-2 text-center text-xs font-medium text-muted-foreground sm:p-4 sm:text-sm">Voicemail<span className="hidden sm:inline">s</span></th>
                  </tr>
                </thead>
                <tbody>
                  {comparison.map((row) => (
                    <tr key={row.feature} className="border-b border-border last:border-0">
                      <td className="p-3 text-[13px] font-medium leading-snug text-foreground sm:p-4 sm:text-sm">{row.feature}</td>
                      <td className="bg-accent/50 p-2 sm:p-4"><Check2 ok={row.vv} /></td>
                      <td className="p-2 sm:p-4"><Check2 ok={row.photos} /></td>
                      <td className="p-2 sm:p-4"><Check2 ok={row.voicemail} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <FamilyStories />

        {/* Privacy and security */}
        <section className="border-y border-border bg-card py-14 md:py-20">
          <div className="mx-auto max-w-5xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow mb-3">Privacy and security</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
                Your voice stays yours
              </h2>
              <p className="mt-3 text-muted-foreground">
                A voice is personal. We protect it the way a bank protects money.
              </p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {[
                { icon: Lock, title: 'Encrypted end to end', body: 'Recordings are encrypted in transit and at rest, and never sold or used to advertise to you.' },
                { icon: UserCheck, title: 'Only people you invite', body: 'Your family joins by your invitation. You see who has access and can remove anyone at any time.' },
                { icon: Trash2, title: 'Delete whenever you choose', body: 'Your recordings and cloned voice can be removed from your account whenever you decide.' },
              ].map(({ icon: Icon, title, body }) => (
                <div key={title} className="surface p-6">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent text-primary">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing teaser */}
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow mb-3">Pricing</p>
              <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">Start free. Pay once to keep it forever.</h2>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
              <div className="surface p-7">
                <h3 className="text-lg font-semibold text-foreground">Memory Starter</h3>
                <p className="num mt-3 text-4xl font-semibold text-foreground">$0</p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {['5 guided questions', 'Text chat with your AI', '1 family invitation'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border-2 border-primary bg-card p-7 shadow-lift">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-foreground">VoiceVault Premium</h3>
                  <span className="rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground">Recommended</span>
                </div>
                <p className="num mt-3 text-4xl font-semibold text-foreground">
                  $149.99 <span className="text-sm font-medium text-muted-foreground">one time</span>
                </p>
                <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
                  {['All 30 guided questions', 'Voice cloning included', 'Up to 10 family members', 'Lifetime access'].map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div className="mt-8 text-center">
              <Link href="/pricing" className="inline-flex min-h-11 items-center text-sm font-semibold text-primary hover:underline">
                Compare plans in detail
              </Link>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-14 md:py-20">
          <div className="mx-auto max-w-3xl px-4 sm:px-6">
            <h2 className="text-center text-3xl font-semibold text-foreground sm:text-4xl">Questions</h2>
            <div className="surface mt-10 divide-y divide-border">
              {faqs.map((f) => (
                <details key={f.q} className="group px-5 py-4">
                  <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 py-3 text-base font-medium text-foreground">
                    {f.q}
                    <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
                  </summary>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* Final CTA */}
        <section className="px-4 pb-20 sm:px-6">
          <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-primary px-6 py-14 text-center text-primary-foreground">
            <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:radial-gradient(white_1px,transparent_1px)] [background-size:22px_22px]" aria-hidden />
            <h2 className="relative text-3xl font-semibold text-balance sm:text-4xl">Don&apos;t wait until it&apos;s too late.</h2>
            <p className="relative mx-auto mt-3 max-w-xl text-primary-foreground/85">Give your family something no photo or video can.</p>
            <Link
              href={startHref}
              className="relative mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-[10px] bg-white px-7 text-base font-semibold text-primary transition-colors hover:bg-white/90"
            >
              {startLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
      <div className="h-20 md:hidden" aria-hidden />
      <StickyCta href={startHref} label={startLabel} />
    </div>
  );
}
