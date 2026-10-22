/**
 * Verify Email Page — opened from the link in the verification email.
 */

'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

import { authApi } from '@/lib/api/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout';
import { ResendVerificationButton } from '@/components/auth/resend-verification-button';

type Status = 'verifying' | 'success' | 'expired' | 'used' | 'invalid';

function codeFromError(err: unknown): Status {
  const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
  if (code === 'token_expired') return 'expired';
  if (code === 'token_used') return 'used';
  return 'invalid';
}

function VerifyEmailContent() {
  const token = useSearchParams().get('token');
  const [status, setStatus] = useState<Status>(token ? 'verifying' : 'invalid');
  const [email, setEmail] = useState('');
  const [confirmedEmail, setConfirmedEmail] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Guard against double-invocation: the token is single-use.
    if (!token || started.current) return;
    started.current = true;
    authApi
      .verifyEmail(token)
      .then(() => setStatus('success'))
      .catch((err: unknown) => setStatus(codeFromError(err)));
  }, [token]);

  const needsResend = status === 'expired' || status === 'used' || status === 'invalid';
  const headings: Record<Status, string> = {
    verifying: 'Verifying your email...',
    success: 'Email verified',
    expired: 'This link has expired',
    used: 'This link was already used',
    invalid: 'This link is not valid',
  };
  const descriptions: Record<Status, string> = {
    verifying: 'Just a moment while we confirm your address.',
    success: 'Your email is confirmed. You can now sign in to your account.',
    expired: 'Verification links last 24 hours. Enter your email to get a new one.',
    used: 'If you already verified your email, just sign in. Otherwise request a new link.',
    invalid: 'The link may be incomplete. Enter your email to get a new one.',
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
      <div className="surface p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          {status === 'verifying' && <Loader2 className="h-6 w-6 animate-spin text-primary" />}
          {status === 'success' && <CheckCircle2 className="h-6 w-6 text-primary" />}
          {needsResend && <AlertCircle className="h-6 w-6 text-primary" />}
        </div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">{headings[status]}</h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base" aria-live="polite">
          {descriptions[status]}
        </p>

        {status === 'success' && (
          <Button asChild className="mt-6 h-11 w-full font-semibold sm:h-12" size="lg">
            <Link href="/login">Sign in</Link>
          </Button>
        )}

        {needsResend && (
          <div className="mt-6 space-y-4 text-left">
            <div>
              <Label htmlFor="resend-email" className="text-foreground">
                Email address
              </Label>
              <Input
                id="resend-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setConfirmedEmail(event.target.value.trim());
                }}
                className="mt-1.5 h-11"
              />
            </div>
            <ResendVerificationButton email={confirmedEmail} />
            {status === 'used' && (
              <Button asChild variant="ghost" className="h-11 w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function VerifyEmailPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <VerifyEmailContent />
      </Suspense>
    </AuthShell>
  );
}
