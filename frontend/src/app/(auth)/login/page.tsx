/**
 * Login Page — Mobile-first, professional
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';

import { useAuthStore } from '@/store/auth';
import { loginSchema, type LoginFormData } from '@/lib/validations/auth';
import { getApiErrorMessage } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { OnboardingHeader, SiteFooter } from '@/components/layout';

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((state) => state.login);
  const [showPassword, setShowPassword] = useState(false);
  const [logoutReason, setLogoutReason] = useState<string | null>(null);

  const reason = searchParams.get('reason');
  useEffect(() => {
    if (reason === 'idle') {
      setLogoutReason('Your session expired due to inactivity. Please log in again.');
      toast.info('Session expired due to inactivity');
    } else if (reason === 'expired') {
      setLogoutReason('Your session has expired. Please log in again.');
      toast.info('Session expired');
    }
  }, [reason]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      toast.success('Welcome back!');
      const redirect = searchParams.get('redirect');
      router.push(redirect || '/dashboard');
    } catch (err: unknown) {
      toast.error(getApiErrorMessage(err, 'Invalid email or password'));
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
        <div className="mb-6 sm:mb-8">
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">
            Welcome back
          </h1>
          <p className="mt-2 text-muted-foreground">Sign in to your account</p>
        </div>

        {logoutReason && (
          <Alert className="mb-6 border-primary/20 bg-primary/5 text-foreground">
            <AlertCircle className="h-4 w-4 text-primary" />
            <AlertDescription>{logoutReason}</AlertDescription>
          </Alert>
        )}

        <motion.div
          className="archive-panel rounded-lg p-5 sm:p-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
        >
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-5">
            <div>
              <Label htmlFor="email" className="text-foreground">Email</Label>
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
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
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

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input text-primary focus:ring-primary/40"
                />
                <span className="text-sm text-muted-foreground">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-medium text-primary hover:text-primary/90 transition-colors"
              >
                Forgot password?
              </Link>
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
                  Signing in...
                </>
              ) : (
                'Sign in'
              )}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link href="/signup" className="font-medium text-primary hover:text-primary/90 transition-colors">
              Create account
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
