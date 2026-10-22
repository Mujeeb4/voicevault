/**
 * Reset Password Page — opened from the link in the reset email.
 */

'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

import { authApi } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout';
import { PasswordStrengthMeter } from '@/components/auth/PasswordStrengthMeter';

const LINK_ERRORS: Record<string, string> = {
  token_expired: 'This reset link has expired. Reset links last 1 hour.',
  token_used: 'This reset link was already used.',
  invalid_token: 'This reset link is not valid.',
  token_required: 'This reset link is not valid.',
};

function ResetPasswordContent() {
  const token = useSearchParams().get('token');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(token ? null : LINK_ERRORS.invalid_token);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFieldError(null);
    if (password !== confirm) {
      setFieldError('Passwords do not match');
      return;
    }
    if (!token) return;
    setIsSaving(true);
    try {
      await authApi.confirmPasswordReset(token, password);
      setDone(true);
    } catch (err: unknown) {
      const code = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? '';
      if (LINK_ERRORS[code]) setLinkError(LINK_ERRORS[code]);
      else setFieldError(getApiErrorMessage(err, 'Could not reset your password. Please try again.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (done || linkError) {
    const ok = done;
    return (
      <div className="surface p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
          {ok ? <CheckCircle2 className="h-6 w-6 text-primary" /> : <AlertCircle className="h-6 w-6 text-primary" />}
        </div>
        <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">
          {ok ? 'Password updated' : 'Link problem'}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground sm:text-base" aria-live="polite">
          {ok ? 'Your password has been reset and you were signed out everywhere. Sign in with your new password.' : linkError}
        </p>
        <Button asChild className="mt-6 h-11 w-full font-semibold" size="lg">
          <Link href={ok ? '/login' : '/forgot-password'}>{ok ? 'Sign in' : 'Request a new link'}</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="surface p-5 sm:p-8">
      <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Choose a new password</h1>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <div>
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            required
            minLength={8}
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="mt-1.5 h-11"
          />
          <PasswordStrengthMeter password={password} />
        </div>
        <div>
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className="mt-1.5 h-11"
          />
        </div>
        {fieldError && <p className="text-sm text-destructive" role="alert">{fieldError}</p>}
        <Button type="submit" className="h-11 w-full font-semibold" disabled={isSaving || !password || !confirm}>
          {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Reset password
        </Button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthShell>
      <Suspense fallback={null}>
        <ResetPasswordContent />
      </Suspense>
    </AuthShell>
  );
}
