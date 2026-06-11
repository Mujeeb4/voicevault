/**
 * Processing Status Page
 * Shows real-time AI processing status with beautiful UI
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { ProcessingStatusMonitor } from '@/components/processing/ProcessingStatusMonitor';
import { ProcessingComplete } from '@/components/processing/ProcessingComplete';
import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { processingApi } from '@/lib/api/processing';
import { ShieldCheck } from 'lucide-react';

export default function ProcessingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isComplete, setIsComplete] = useState(false);
  const [voiceConsentAccepted, setVoiceConsentAccepted] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');

  const handleComplete = () => {
    setIsComplete(true);
    toast.success('AI processing complete!', {
      description: 'Your AI is now ready to chat!',
    });
  };

  const handleVoiceConsent = async () => {
    try {
      setIsSavingConsent(true);
      await authApi.recordConsent('voice_cloning', true);
      setVoiceConsentAccepted(true);
      toast.success('Voice cloning consent saved.');
      if (user?.recording_completed) {
        try {
          await processingApi.retryStep(user.id, 'voice-clone');
          toast.info('Voice cloning has been queued.');
        } catch {
          toast.info('Consent is saved. Voice cloning can be retried after enough audio is available.');
        }
      }
    } catch {
      toast.error('Unable to save consent. Please try again.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="rounded-lg border border-border bg-card/55 p-5">
        <p className="text-xs font-semibold uppercase text-primary/85">AI build room</p>
        <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
          AI Processing
        </h1>
        <p className="mt-1 text-muted-foreground">
          {isComplete ? 'Processing complete!' : 'Processing your voice and memories...'}
        </p>
      </div>

      {isComplete ? (
        <ProcessingComplete
          userName={user.full_name}
          onChatNow={() => router.push('/chat')}
          onInviteFamily={() => router.push('/family')}
        />
      ) : (
        <div className="space-y-6">
          {/* Info Banner */}
          <div className="rounded-lg border border-primary/25 bg-primary/10 p-6">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              {isPremium ? 'Creating Your Premium AI Vault' : 'Creating Your Text AI Preview'}
            </h2>
            <p className="mb-4 text-muted-foreground">
              {isPremium
                ? 'Your memories are being processed. Voice cloning starts only after explicit consent is saved.'
                : 'Your free preview includes personality analysis and text chat. Premium unlocks voice cloning and voice responses.'}
            </p>
            {isPremium && !voiceConsentAccepted && (
              <div className="mb-4 rounded-md border border-primary/25 bg-background/45 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                    <p className="text-sm text-foreground">
                      I confirm this is my voice, or I have legal permission to create this voice clone.
                    </p>
                  </div>
                  <Button onClick={handleVoiceConsent} disabled={isSavingConsent} size="sm">
                    {isSavingConsent ? 'Saving...' : 'Confirm consent'}
                  </Button>
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 text-sm text-primary">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Step 1: Transcribing audio (1-2 min)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Step 2: Analyzing personality (30 sec)
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Step 3: {isPremium ? 'Cloning voice after consent' : 'Voice cloning locked'}
              </span>
            </div>
          </div>

          {/* Processing Monitor */}
          <ProcessingStatusMonitor
            userId={user.id}
            autoRefresh={true}
            refreshInterval={5000}
            onComplete={handleComplete}
          />

          {/* Help Section */}
          <div className="rounded-lg border border-border bg-card/55 p-6">
            <h3 className="mb-2 font-semibold text-foreground">What happens next?</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">1.</span>
                <span>
                  Your AI will analyze your speech patterns, personality, and voice characteristics
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">2.</span>
                <span>
                  We&apos;ll create a voice clone that sounds just like you using ElevenLabs
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>
                  Your family members can chat with your AI and hear responses in your voice
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
