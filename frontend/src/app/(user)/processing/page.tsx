/**
 * Processing Status Page
 * Shows real-time AI processing status with beautiful UI
 */

'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { ProcessingStatusMonitor } from '@/components/processing/ProcessingStatusMonitor';
import { ProcessingComplete } from '@/components/processing/ProcessingComplete';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { authApi } from '@/lib/api/auth';
import { processingApi } from '@/lib/api/processing';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function ProcessingPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [isComplete, setIsComplete] = useState(false);
  const [voiceConsentAccepted, setVoiceConsentAccepted] = useState(false);
  const [isSavingConsent, setIsSavingConsent] = useState(false);
  const [previewText, setPreviewText] = useState('I remember sitting on the front steps with my family, feeling completely safe and happy.');
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [previewAudioUrl, setPreviewAudioUrl] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState('');
  useEffect(() => () => {
    if (previewAudioUrl) URL.revokeObjectURL(previewAudioUrl);
  }, [previewAudioUrl]);
  const isPremium = !!(
    user?.is_premium ||
    user?.payment_completed ||
    user?.plan_type === 'premium'
  );

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
          toast.info(
            'Consent is saved. Voice cloning can be retried after enough audio is available.'
          );
        }
      }
    } catch {
      toast.error('Unable to save consent. Please try again.');
    } finally {
      setIsSavingConsent(false);
    }
  };

  const handleVoicePreview = async () => {
    if (!user || !previewText.trim()) return;
    setIsPreviewing(true);
    setPreviewError('');
    setPreviewAudioUrl(null);
    try {
      const started = await processingApi.startVoicePreview(user.id, previewText.trim());
      for (let attempt = 0; attempt < 90; attempt += 1) {
        const current = await processingApi.getVoicePreviewStatus(user.id, started.preview_id);
        if (current.status === 'complete') {
          const audio = await processingApi.getVoicePreviewAudio(user.id, started.preview_id);
          setPreviewAudioUrl(URL.createObjectURL(audio));
          return;
        }
        if (current.status === 'failed') throw new Error(current.error || 'Voice preview failed');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
      throw new Error('The preview is still processing. Please try again shortly; the same text reuses the pending request.');
    } catch (error) {
      setPreviewError(error instanceof Error ? error.message : 'Could not generate voice preview');
    } finally {
      setIsPreviewing(false);
    }
  };

  if (!user) {
    return null;
  }

  if (!user.recording_completed) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="journey-hero p-6 sm:p-8">
          <p className="journey-kicker">AI build room</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">
            Record before starting AI processing
          </h1>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            There is nothing to process yet. Complete and upload your guided recordings first.
          </p>
          <Button className="mt-6" onClick={() => router.push('/record')}>
            Start recording
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="journey-hero p-5 sm:p-6">
        <p className="journey-kicker">AI build room</p>
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
          <div className="journey-card p-6">
            <h2 className="mb-2 text-lg font-semibold text-foreground">
              {isPremium ? 'Creating Your Premium AI Vault' : 'Creating Your Text AI Preview'}
            </h2>
            <p className="mb-4 text-muted-foreground">
              {isPremium
                ? 'Your memories are being processed. Voice cloning starts only after explicit consent is saved.'
                : 'Your free preview includes personality analysis and text chat. Premium unlocks voice cloning and voice responses.'}
            </p>
            {isPremium && !voiceConsentAccepted && (
              <div className="mb-4 rounded-lg border border-primary/25 bg-primary/8 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                    <p className="text-sm text-foreground">
                      I confirm this is my voice, or I have legal permission to create this voice
                      clone.
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

          {isPremium && (
            <div className="journey-card p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Hear your Qwen3 voice</h2>
              <p className="mb-3 text-sm text-muted-foreground">
                A preview uses your saved recording and matching transcript. Replicate charges for a new request when you press Generate; repeating the same text reuses its result.
              </p>
              <textarea
                value={previewText}
                onChange={(event) => setPreviewText(event.target.value)}
                maxLength={300}
                rows={3}
                aria-label="Words for the voice preview"
                className="mb-3 w-full rounded-lg border border-border bg-background p-3 text-foreground"
              />
              <Button onClick={handleVoicePreview} disabled={isPreviewing || !previewText.trim()}>
                {isPreviewing ? 'Generating voice...' : 'Generate voice preview'}
              </Button>
              {previewError && <p className="mt-3 text-sm text-destructive">{previewError}</p>}
              {previewAudioUrl && <audio className="mt-4 w-full" controls src={previewAudioUrl} />}
            </div>
          )}

          {/* Help Section */}
          <div className="journey-card p-6">
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
                  {isPremium
                    ? "After you consent, we'll prepare a recording and matching transcript for Qwen3 voice cloning"
                    : "We'll create your text-based AI preview; voice cloning remains locked unless you upgrade"}
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold text-primary">3.</span>
                <span>
                  {isPremium
                    ? 'Your family members can chat with your AI and hear responses in your voice'
                    : 'Your family members can chat with your text-based AI preview'}
                </span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
