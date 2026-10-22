'use client';

import Link from 'next/link';
import { Mail } from 'lucide-react';
import { AuthShell } from '@/components/layout';
import { Button } from '@/components/ui/button';

const supportEmail = 'Info@voicevault.life';

export default function ForgotPasswordPage() {
  return (
    <AuthShell>
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl font-semibold sm:text-3xl text-foreground sm:text-4xl">
            Reset your password
          </h1>
          <p className="mt-2 text-muted-foreground">
            Password reset is handled by support while account recovery is being finalized.
          </p>
        </div>

        <div className="surface p-5 sm:p-8">
          <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-primary">
            <Mail className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Email us from the address on your account and we will help you regain access.
          </p>
          <Button asChild className="mt-6 h-11 w-full font-semibold">
            <a href={`mailto:${supportEmail}?subject=VoiceVault password reset`}>
              Email support
            </a>
          </Button>
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
