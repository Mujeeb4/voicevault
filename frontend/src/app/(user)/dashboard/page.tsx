/**
 * User Dashboard Page
 * Main dashboard with role-based content
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useRecordingStore } from '@/store/recording';
import { familyApi } from '@/lib/api/family';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Mic, Brain, Users, MessageSquare, ArrowRight, Check, Sparkles, Clock, HardDrive, Lock, UserCheck, Trash2 } from 'lucide-react';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { PageHeader } from '@/components/ui/page-header';
import { StatTile } from '@/components/ui/stat-tile';
import { ProgressRing } from '@/components/ui/progress-ring';

interface AccessibleAI {
  id: string;
  full_name: string;
  ai_ready: boolean;
  relationship: string;
  voice_enabled?: boolean;
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshUser } = useAuthStore();
  const { recordings, loadSavedRecordings } = useRecordingStore();
  const [accessibleAIs, setAccessibleAIs] = useState<AccessibleAI[]>([]);
  const [familyCount, setFamilyCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    try {
      // Load accessible AIs
      const aisResponse = await familyApi.getAccessibleAIs();
      setAccessibleAIs(aisResponse.results.filter((ai) => ai.relationship !== 'self'));

      // Load family members count if AI owner
      if (user?.ai_ready) {
        const familyResponse = await familyApi.getFamilyMembers();
        setFamilyCount(familyResponse.count);
      }
    } catch {
      console.error('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  }, [user?.ai_ready]);

  useEffect(() => {
    const init = async () => {
      await refreshUser();
      await loadData();
    };
    init();
  }, [refreshUser, loadData]);

  useEffect(() => {
    if (!user?.id || user.recording_completed) return;
    loadSavedRecordings(user.id);
  }, [loadSavedRecordings, user?.id, user?.recording_completed]);

  const isPremium = !!(
    user?.is_premium ||
    user?.payment_completed ||
    user?.plan_type === 'premium'
  );
  const hasRecorded = user?.recording_completed;
  const hasAI = user?.ai_ready;
  const isFamilyMember = accessibleAIs.length > 0;
  const quota = user?.usage_quota;
  const savedDraftCount = recordings.size;
  const isFirstSession = searchParams.get('welcome') === '1';


  if (isLoading) {
    return (
      <div className="space-y-8">
        <div>
          <Skeleton className="h-10 w-64 mb-2" />
          <Skeleton className="h-5 w-96" />
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    );
  }

  const firstName = (user?.full_name || '').trim().split(' ')[0];
  const showJourney = hasRecorded || !isFamilyMember;

  const next = hasAI
    ? {
        title: 'Your AI is ready',
        body: 'Try a conversation yourself, then invite the family members you want to hear you.',
        label: 'Chat with your AI',
        href: '/chat',
        icon: MessageSquare,
      }
    : hasRecorded
      ? {
          title: 'We are building your AI',
          body: 'Your recordings are in. This runs on its own, and you can follow its progress here.',
          label: 'View progress',
          href: '/processing',
          icon: Brain,
        }
      : {
          title: savedDraftCount > 0 ? 'Pick up where you left off' : 'Record your voice',
          body:
            savedDraftCount > 0
              ? `${savedDraftCount} answer${savedDraftCount === 1 ? ' is' : 's are'} saved on this browser. Continue, review, then upload when you are ready.`
              : isPremium
                ? 'Answer 30 guided questions. You can pause at any time and come back.'
                : 'Answer 5 guided questions to try VoiceVault. You can pause at any time.',
          label: savedDraftCount > 0 ? 'Continue recording' : 'Start recording',
          href: '/record',
          icon: Mic,
        };

  const journey = [
    { label: 'Record your voice', detail: isPremium ? '30 guided questions' : '5 guided questions', done: !!hasRecorded, href: '/record' },
    { label: 'We build your AI', detail: 'Automatic, takes a few minutes', done: !!hasAI, href: '/processing' },
    { label: 'Try it yourself', detail: 'Chat with your own AI', done: !!hasAI && familyCount > 0, href: '/chat' },
    { label: 'Share with family', detail: 'Invite people you trust', done: familyCount > 0, href: '/family' },
  ];
  const doneCount = journey.filter((j) => j.done).length;
  const percent = Math.round((doneCount / journey.length) * 100);
  const currentIndex = journey.findIndex((j) => !j.done);
  const NextIcon = next.icon;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={isPremium ? 'Premium vault' : 'Free vault'}
        title={isFirstSession ? `Welcome, ${firstName}` : `Welcome back, ${firstName}`}
        description={isFamilyMember && !hasRecorded ? 'You have family voice memories ready to visit.' : 'Here is where your vault stands today.'}
        actions={
          showJourney ? (
            <Button size="lg" onClick={() => router.push(next.href)}>
              {next.label}
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : undefined
        }
      />

      {showJourney && (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Card className="brand-wash flex flex-col justify-center border-primary/20">
              <CardContent className="flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:p-8">
                <ProgressRing value={percent} sublabel="complete" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <NextIcon className="h-4 w-4 text-primary" />
                    <p className="eyebrow">Your next step</p>
                  </div>
                  <h2 className="mt-1.5 text-xl font-semibold text-foreground">{next.title}</h2>
                  <p className="mt-1.5 max-w-md text-sm text-muted-foreground">{next.body}</p>
                  <p className="num mt-4 text-xs font-medium text-muted-foreground">
                    {doneCount} of {journey.length} steps done
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Your journey</CardTitle>
              </CardHeader>
              <CardContent>
                <ol className="space-y-1">
                  {journey.map((step, i) => {
                    const active = i === currentIndex;
                    return (
                      <li key={step.label}>
                        <button
                          type="button"
                          onClick={() => router.push(step.href)}
                          className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-muted ${active ? 'bg-accent/60' : ''}`}
                        >
                          <span
                            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                              step.done
                                ? 'bg-primary text-primary-foreground'
                                : active
                                  ? 'border-2 border-primary text-primary'
                                  : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {step.done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                          </span>
                          <span className="min-w-0">
                            <span className={`block text-sm font-medium ${step.done || active ? 'text-foreground' : 'text-muted-foreground'}`}>
                              {step.label}
                            </span>
                            <span className="block truncate text-xs text-muted-foreground">{step.detail}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </CardContent>
            </Card>
          </div>

          {quota && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatTile
                label="Recording time"
                value={
                  <>
                    {quota.usage.recording_minutes_used}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/ {quota.limits.recording_minutes} min</span>
                  </>
                }
                hint={<UsageBar used={quota.usage.recording_minutes_used} limit={quota.limits.recording_minutes} />}
                icon={<Clock className="h-4.5 w-4.5" />}
              />
              <StatTile
                label="Messages"
                value={
                  <>
                    {quota.usage.text_messages_used_this_month}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/ {quota.limits.text_messages_monthly}</span>
                  </>
                }
                hint={<UsageBar used={quota.usage.text_messages_used_this_month} limit={quota.limits.text_messages_monthly} />}
                icon={<MessageSquare className="h-4.5 w-4.5" />}
              />
              <StatTile
                label="Family members"
                value={
                  <>
                    {familyCount}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/ {quota.limits.family_members}</span>
                  </>
                }
                hint={<UsageBar used={familyCount} limit={quota.limits.family_members} />}
                icon={<Users className="h-4.5 w-4.5" />}
              />
              <StatTile
                label="Storage"
                value={
                  <>
                    {quota.usage.recording_storage_used_mb}
                    <span className="ml-1 text-base font-medium text-muted-foreground">/ {quota.limits.storage_mb} MB</span>
                  </>
                }
                hint={<UsageBar used={quota.usage.recording_storage_used_mb} limit={quota.limits.storage_mb} />}
                icon={<HardDrive className="h-4.5 w-4.5" />}
              />
            </div>
          )}

          {!isPremium && !isFamilyMember && (
            <Card className="border-primary/30">
              <CardContent className="flex flex-col items-start gap-4 p-6 md:flex-row md:items-center md:justify-between">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                    <Sparkles className="h-5 w-5" />
                  </span>
                  <div>
                    <h3 className="font-semibold text-foreground">Unlock the full vault</h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Premium adds voice cloning, all 30 questions and up to 10 family members, with a one-time payment.
                    </p>
                  </div>
                </div>
                <Button onClick={() => router.push('/pricing')} className="shrink-0">
                  See Premium
                </Button>
              </CardContent>
            </Card>
          )}

          {!isFamilyMember && (
            <section aria-label="Privacy and security" className="surface p-5 sm:p-6">
              <p className="eyebrow">Private by design</p>
              <div className="mt-4 grid gap-5 sm:grid-cols-3">
                {[
                  { icon: Lock, title: 'Encrypted', body: 'Your recordings are encrypted in transit and at rest.' },
                  { icon: UserCheck, title: 'Invite only', body: 'Only family you invite can talk to your AI.' },
                  { icon: Trash2, title: 'You are in control', body: 'Remove access or delete your vault at any time.' },
                ].map(({ icon: Icon, title, body }) => (
                  <div key={title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-primary">
                      <Icon className="h-4 w-4" strokeWidth={1.75} />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{title}</p>
                      <p className="mt-0.5 text-sm text-muted-foreground">{body}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      {isFamilyMember && (
        <section aria-labelledby="family-ais">
          <h2 id="family-ais" className="mb-1 text-lg font-semibold text-foreground">
            Family voices
          </h2>
          <p className="mb-4 text-sm text-muted-foreground">Talk with the AI of someone in your family.</p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accessibleAIs.map((ai) => (
              <button
                key={ai.id}
                type="button"
                onClick={() => router.push(`/chat/${ai.id}`)}
                className="surface flex items-center gap-3 p-4 text-left transition-shadow hover:shadow-lift"
              >
                <PersonAvatar name={ai.full_name} size="md" />
                <span>
                  <span className="block font-semibold text-foreground">{ai.full_name}</span>
                  <span className="block text-sm capitalize text-muted-foreground">{ai.relationship}</span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const value = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  return <Progress value={value} className="mt-1 h-1.5" />;
}

export default function DashboardPage() {
  return <DashboardContent />;
}
