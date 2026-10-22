/**
 * Signup Page — Mobile-first, professional
 * Signup → "check your email" → verify link → sign in
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Check, MailCheck } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth';
import { signupSchema, type SignupFormData } from '@/lib/validations/auth';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AuthShell } from '@/components/layout';
import { ResendVerificationButton } from '@/components/auth/resend-verification-button';

export default function SignupPage() {
  const signup = useAuthStore((state) => state.signup);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
    defaultValues: { acceptedTerms: false },
  });

  const onSubmit = async (data: SignupFormData) => {
    try {
      const { email, password, full_name, phone_number } = data;
      await signup({ email, password, full_name, phone_number });
      setSentTo(email);
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to create account'));
    }
  };

  if (sentTo) {
    return (
      <AuthShell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="surface p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-accent">
              <MailCheck className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-semibold text-foreground sm:text-3xl">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base" aria-live="polite">
              We sent a verification link to <span className="font-medium text-foreground">{sentTo}</span>.
              Open it to activate your account, then sign in. The link expires in 24 hours.
            </p>
            <div className="mt-6 space-y-3">
              <ResendVerificationButton email={sentTo} startCooldown />
              <Button asChild variant="ghost" className="h-11 w-full">
                <Link href="/login">Go to sign in</Link>
              </Button>
            </div>
          </div>
        </motion.div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <div className="mb-6 text-center sm:mb-8">
            <h1 className="text-2xl font-semibold sm:text-3xl text-foreground sm:text-4xl">
              Create your free account
            </h1>
            <p className="mt-2 text-sm text-muted-foreground sm:text-base">
              Start free and record your first memories today. Upgrade only if you choose to.
            </p>
          </div>

          <motion.div
            className="surface p-6 shadow-sm sm:p-8"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <form
              method="post"
              noValidate
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-4 sm:space-y-5"
            >
              <div>
                <Label htmlFor="full_name" className="text-foreground">
                  Full name
                </Label>
                <Input
                  id="full_name"
                  type="text"
                  placeholder="John Doe"
                  error={errors.full_name?.message}
                  {...register('full_name')}
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="email" className="text-foreground">
                  Email address
                </Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  error={errors.email?.message}
                  {...register('email')}
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="phone_number" className="text-foreground">
                  Phone <span className="text-muted-foreground text-xs">(optional)</span>
                </Label>
                <Input
                  id="phone_number"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  error={errors.phone_number?.message}
                  {...register('phone_number')}
                  className="mt-1.5 h-11"
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-foreground">
                  Password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    error={errors.password?.message}
                    {...register('password')}
                    className="pr-11 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors duration-200"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-foreground">
                  Confirm password
                </Label>
                <div className="relative mt-1.5">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    error={errors.confirmPassword?.message}
                    {...register('confirmPassword')}
                    className="pr-11 h-11"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-0 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors duration-200"
                    aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-5 w-5" />
                    ) : (
                      <Eye className="h-5 w-5" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    id="terms"
                    type="checkbox"
                    {...register('acceptedTerms')}
                    aria-invalid={errors.acceptedTerms ? true : undefined}
                    aria-describedby={errors.acceptedTerms ? 'terms-error' : undefined}
                    className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/40"
                  />
                  <span className="text-sm text-muted-foreground">
                    I agree to the{' '}
                    <Link
                      href="/terms"
                      className="font-medium text-primary hover:text-primary transition-colors"
                    >
                      Terms
                    </Link>{' '}
                    and{' '}
                    <Link
                      href="/privacy"
                      className="font-medium text-primary hover:text-primary transition-colors"
                    >
                      Privacy
                    </Link>
                  </span>
                </label>
                {errors.acceptedTerms && (
                  <p id="terms-error" className="mt-1 text-sm text-error-500" role="alert">
                    {errors.acceptedTerms.message}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-11 w-full font-semibold sm:h-12"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Create free account
                  </>
                )}
              </Button>
            </form>

            <p className="mt-5 text-center text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link
                href="/login"
                className="font-medium text-primary hover:text-primary transition-colors"
              >
                Sign in
              </Link>
            </p>
          </motion.div>


        </motion.div>
      </AuthShell>
  );
}
