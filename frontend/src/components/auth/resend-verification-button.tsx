'use client';

import { useEffect, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { authApi } from '@/lib/api/auth';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const COOLDOWN_SECONDS = 60;

interface ResendVerificationButtonProps {
  email: string;
  /** Start in cooldown (e.g. right after an email was just sent). */
  startCooldown?: boolean;
  className?: string;
}

export function ResendVerificationButton({ email, startCooldown = false, className }: ResendVerificationButtonProps) {
  const [cooldown, setCooldown] = useState(startCooldown ? COOLDOWN_SECONDS : 0);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const resend = async () => {
    if (!email || sending || cooldown > 0) return;
    setSending(true);
    try {
      await authApi.resendVerification(email);
      toast.success('If that account needs verifying, a new email is on its way.');
      setCooldown(COOLDOWN_SECONDS);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Could not resend the email. Please try again shortly.'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Button
      type="button"
      variant="outline"
      onClick={resend}
      disabled={sending || cooldown > 0 || !email}
      className={className ?? 'h-11 w-full font-semibold'}
    >
      {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
      {cooldown > 0 ? `Resend email in ${cooldown}s` : 'Resend verification email'}
    </Button>
  );
}
