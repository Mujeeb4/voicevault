/**
 * User Dashboard Page
 * Main dashboard with role-based content
 */

'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/auth';
import { useRecordingStore } from '@/store/recording';
import { familyApi } from '@/lib/api/family';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Mic,
  Brain,
  Users,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Sparkles,
  CreditCard,
} from 'lucide-react';

interface AccessibleAI {
  id: string;
  full_name: string;
  ai_ready: boolean;
  relationship: string;
  voice_enabled?: boolean;
}

function DashboardContent() {
  const router = useRouter();
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

  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
  const hasRecorded = user?.recording_completed;
  const hasAI = user?.ai_ready;
  const isFamilyMember = accessibleAIs.length > 0;
  const quota = user?.usage_quota;
  const savedDraftCount = recordings.size;

  // Determine what to show based on user's status
  const getProgressStep = () => {
    if (!hasRecorded) return 1;
    if (!hasAI) return 2;
    return 3;
  };

  const progressStep = getProgressStep();

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

  return (
    <div className="space-y-7">
      {/* Welcome Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="journey-hero p-5 sm:p-6"
      >
        <div className="archive-rule absolute left-0 right-0 top-0 h-px" />
        <p className="journey-kicker">Voice archive status</p>
        <div className="relative z-10 mt-2 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-semibold leading-tight text-foreground sm:text-4xl">
              Welcome back, {user?.full_name}
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              {hasAI
                ? 'Your AI is ready. Manage family access, test responses, and keep the archive cared for.'
                : hasRecorded
                  ? "Your recordings are in place. Let's finish training your AI voice memory."
                  : isFamilyMember
                    ? 'You have family voice memories ready to visit.'
                    : 'Start with your free Memory Starter vault and preserve the first chapter today.'}
            </p>
          </div>
          <Button onClick={() => router.push(hasRecorded ? '/processing' : '/record')} className="w-full shimmer-btn text-primary-foreground sm:w-auto">
            {hasRecorded ? 'View Processing' : savedDraftCount > 0 ? `Continue Recording (${savedDraftCount} saved)` : 'Start Recording'}
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </motion.div>

      {!hasRecorded && savedDraftCount > 0 && (
        <Card className="journey-card border-primary/45 bg-primary/10">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-foreground">Saved recording draft found</p>
              <p className="text-sm text-muted-foreground">
                {savedDraftCount} answer{savedDraftCount === 1 ? '' : 's'} saved on this browser. Continue, review, then upload when ready.
              </p>
            </div>
            <Button onClick={() => router.push('/record')} className="w-full sm:w-auto">
              Continue recording
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* AI Owner Progress - Only show if paid or has potential to create AI, AND NOT purely a family member viewing their dashboard */}
      {/* Logic: Show progress if user has started payment flow OR if they are NOT a family member (default state for new users) */}
      {(hasRecorded || !isFamilyMember) && (
        <>
          {/* Progress Cards for AI Owners */}
          <motion.div
            className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.08 } },
              hidden: {},
            }}
          >
            <ProgressCard
              step={1}
              currentStep={progressStep}
              icon={<CreditCard className="h-5 w-5" />}
              title={isPremium ? 'Premium Active' : 'Memory Starter'}
              description={isPremium ? 'Full vault unlocked' : 'Free plan active'}
              completed={isPremium}
              onClick={() => router.push('/pricing')}
            />
            <ProgressCard
              step={2}
              currentStep={progressStep}
              icon={<Mic className="h-5 w-5" />}
              title={savedDraftCount > 0 && !hasRecorded ? 'Continue' : 'Record'}
              description={savedDraftCount > 0 && !hasRecorded ? `${savedDraftCount} saved locally` : isPremium ? 'Answer 30 questions' : 'Answer 5 questions'}
              completed={hasRecorded}
              onClick={() => router.push('/record')}
            />
            <ProgressCard
              step={3}
              currentStep={progressStep}
              icon={<Brain className="h-5 w-5" />}
              title="Processing"
              description="AI learns your voice"
              completed={hasAI}
              disabled={!hasRecorded}
              onClick={() => router.push('/processing')}
            />
            <ProgressCard
              step={4}
              currentStep={progressStep}
              icon={<MessageSquare className="h-5 w-5" />}
              title="Chat"
              description="Talk to your AI"
              completed={false}
              disabled={!hasAI}
              onClick={() => router.push('/chat')}
            />
          </motion.div>

          {quota && !isPremium && (
            <Card>
              <CardHeader>
                <CardTitle>Memory Starter usage</CardTitle>
                <CardDescription>Free plan includes 5 questions, 15 recording minutes, 5 messages, and 1 family invite.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <UsageMeter
                  label="Recording minutes"
                  used={quota.usage.recording_minutes_used}
                  limit={quota.limits.recording_minutes}
                  suffix="min"
                />
                <UsageMeter
                  label="Chat messages"
                  used={quota.usage.text_messages_used_this_month}
                  limit={quota.limits.text_messages_monthly}
                />
                <UsageMeter
                  label="Family invites"
                  used={quota.usage.family_invites_used}
                  limit={quota.limits.family_members}
                />
                <UsageMeter
                  label="Storage"
                  used={quota.usage.recording_storage_used_mb}
                  limit={quota.limits.storage_mb}
                  suffix="MB"
                />
              </CardContent>
            </Card>
          )}

          {/* Quick Actions for AI Owners */}
          {hasAI && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  Quick Actions
                </CardTitle>
              </CardHeader>
              <CardContent className="grid md:grid-cols-3 gap-4">
                <ActionCard
                  icon={<MessageSquare className="h-6 w-6" />}
                  title="Test My AI"
                  description="Have a conversation with your AI"
                  onClick={() => router.push('/chat')}
                />
                <ActionCard
                  icon={<Users className="h-6 w-6" />}
                  title="Invite Family"
                  description={`${familyCount} members invited`}
                  onClick={() => router.push('/family')}
                />
                <ActionCard
                  icon={<Mic className="h-6 w-6" />}
                  title="Re-record"
                  description="Update your recordings"
                  onClick={() => router.push('/record')}
                />
              </CardContent>
            </Card>
          )}

          {/* CTA for unpaid users who are NOT family members */}
          {!isPremium && !isFamilyMember && (
            <Card className="overflow-hidden border-primary/35 bg-primary/12 text-foreground">
              <CardContent className="py-8">
                <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                  <div>
                    <h3 className="font-heading text-2xl font-semibold">Unlock the full memory vault</h3>
                    <p className="mt-1 text-muted-foreground">
                      Premium adds voice cloning, 30+ questions, 10 family members, and generous monthly usage.
                    </p>
                  </div>
                  <Button
                    onClick={() => router.push('/pricing')}
                    size="lg"
                    className="shimmer-btn text-primary-foreground"
                  >
                    Unlock Premium
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Family Member Section - Show accessible AIs */}
      {isFamilyMember && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Family AIs
            </CardTitle>
            <CardDescription>
              Chat with AI personalities from your family members
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accessibleAIs.map((ai) => (
                <Card
                  key={ai.id}
                  className="cursor-pointer transition-all duration-200 hover:border-primary/50"
                  onClick={() => router.push(`/chat/${ai.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-primary/25 bg-primary/12">
                        <MessageSquare className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <p className="font-semibold">{ai.full_name}</p>
                        <p className="text-sm text-muted-foreground capitalize">
                          {ai.relationship}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// Progress Card Component
function ProgressCard({
  step,
  currentStep,
  icon,
  title,
  description,
  completed,
  disabled,
  onClick,
}: {
  step: number;
  currentStep: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  completed?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const isActive = step === currentStep + 1;

  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        visible: { opacity: 1, y: 0 },
      }}
    >
    <Card
      className={`cursor-pointer transition-all duration-200 hover:-translate-y-0.5 ${completed
        ? 'border-primary/45 bg-primary/12'
        : isActive
          ? 'border-primary/70 shadow-[0_0_0_1px_hsl(var(--primary)/0.16),0_16px_34px_hsl(var(--primary)/0.1)]'
          : disabled
            ? 'opacity-60 cursor-not-allowed'
            : 'bg-card/60 hover:border-primary/35'
        }`}
      onClick={disabled ? undefined : onClick}
    >
      <CardContent className="p-4 flex items-center gap-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${completed
            ? 'bg-primary text-primary-foreground'
            : isActive
              ? 'bg-primary text-primary-foreground'
              : disabled
                ? 'bg-muted text-muted-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
        >
          {completed ? <CheckCircle2 className="h-5 w-5" /> : icon}
        </div>
        <div>
          <p className={`font-medium ${disabled ? 'text-muted-foreground' : 'text-foreground'}`}>{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </CardContent>
    </Card>
    </motion.div>
  );
}

function UsageMeter({
  label,
  used,
  limit,
  suffix,
}: {
  label: string;
  used: number;
  limit: number;
  suffix?: string;
}) {
  const value = Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {used} / {limit}{suffix ? ` ${suffix}` : ''}
        </p>
      </div>
      <Progress value={value} className="h-2" />
    </div>
  );
}

// Action Card Component
function ActionCard({
  icon,
  title,
  description,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <div
      className="flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-background/35 p-4 transition-all duration-200 hover:border-primary/35 hover:bg-primary/10"
      onClick={onClick}
    >
      <div className="rounded-lg border border-primary/25 bg-primary/12 p-3 text-primary">{icon}</div>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  return <DashboardContent />;
}
