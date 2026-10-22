'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2, Mail } from 'lucide-react';
import { AuthShell } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { authApi } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/utils';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async (address: string) => {
    setIsSending(true);
    setError(null);
    try {
      await authApi.requestPasswordReset(address);
      setSentTo(address);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Could not send the email. Please try again.'));
    } finally {
      setIsSending(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    const address = email.trim();
    if (address) void send(address);
  };

  return (
    <AuthShell>
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl font-semibold sm:text-4xl text-foreground">Reset your password</h1>
        <p className="mt-2 text-muted-foreground">
          {sentTo
            ? 'Check your email for a link to choose a new password.'
            : 'Enter the email on your account and we will send you a reset link.'}
        </p>
      </div>

      <div className="surface p-5 sm:p-8">
        <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
          <Mail className="h-5 w-5" strokeWidth={1.8} />
        </div>

        {sentTo ? (
          <div className="space-y-4" aria-live="polite">
            <p className="text-sm leading-relaxed text-muted-foreground">
              If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, a reset
              link is on its way. It works once and expires in 1 hour.
            </p>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full"
              disabled={isSending}
              onClick={() => void send(sentTo)}
            >
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send again
            </Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label htmlFor="reset-email">Email address</Label>
              <Input
                id="reset-email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="mt-1.5 h-11"
              />
            </div>
            {error && <p className="text-sm text-destructive" role="alert">{error}</p>}
            <Button type="submit" className="h-11 w-full font-semibold" disabled={isSending || !email.trim()}>
              {isSending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Remembered it?{' '}
          <Link href="/login" className="font-medium text-primary hover:text-primary">
            Sign in
          </Link>
        </p>
      </div>
    </AuthShell>
  );
}
