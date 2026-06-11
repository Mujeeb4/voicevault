/**
 * Signup Page — Mobile-first, professional
 * Single plan flow: signup → checkout ($99) → record
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth';
import { signupSchema, type SignupFormData } from '@/lib/validations/auth';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { OnboardingHeader, SiteFooter } from '@/components/layout';

export default function SignupPage() {
  const router = useRouter();
  const signup = useAuthStore((state) => state.signup);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToTerms, setAgreedToTerms] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({
    resolver: zodResolver(signupSchema),
  });

  const onSubmit = async (data: SignupFormData) => {
    if (!agreedToTerms) {
      toast.error('Please accept the terms and conditions');
      return;
    }

    try {
      const { email, password, full_name, phone_number } = data;
      await signup({ email, password, full_name, phone_number });
      toast.success('Account created! Redirecting to checkout...');
      router.push('/checkout');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Failed to create account'));
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <OnboardingHeader />

      <main className="mx-auto max-w-md px-4 py-8 sm:py-12">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
        <div className="mb-6 text-center sm:mb-8">
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
            Begin Your Forever Memory
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            One account. One payment. Your voice, preserved.
          </p>
        </div>

        <motion.div
          className="archive-panel rounded-lg p-5 sm:p-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            <div>
              <Label htmlFor="full_name" className="text-foreground">Full name</Label>
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
              <Label htmlFor="email" className="text-foreground">Email address</Label>
              <Input
                id="email"
                type="email"
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
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Create a strong password"
                  error={errors.password?.message}
                  {...register('password')}
                  className="pr-11 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors duration-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword" className="text-foreground">Confirm password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  error={errors.confirmPassword?.message}
                  {...register('confirmPassword')}
                  className="pr-11 h-11"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1.5 text-muted-foreground hover:bg-muted/70 hover:text-foreground transition-colors duration-200"
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <label className="flex cursor-pointer items-start gap-3">
              <input
                id="terms"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-input text-primary focus:ring-primary/40"
              />
              <span className="text-sm text-muted-foreground">
                I agree to the{' '}
                <Link href="/terms" className="font-medium text-primary hover:text-primary/90 transition-colors">Terms</Link>
                {' '}and{' '}
                <Link href="/privacy" className="font-medium text-primary hover:text-primary/90 transition-colors">Privacy</Link>
              </span>
            </label>

            <Button
              type="submit"
              disabled={isSubmitting || !agreedToTerms}
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
                  Secure My Legacy
                </>
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Already have an account?{' '}
            <Link href="/login" className="font-medium text-primary hover:text-primary/90 transition-colors">
              Sign in
            </Link>
          </p>
        </motion.div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-primary transition-colors">Pricing</Link>
          {' · '}
          <Link href="/" className="hover:text-primary transition-colors">Home</Link>
        </p>
        </motion.div>
      </main>
      <SiteFooter />
    </div>
  );
}
