'use client';

/**
 * Accept Invitation Page (Public)
 * Family members accept invitation with token
 * Following .cursorrules patterns
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { familyApi } from '@/lib/api/family';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, UserCheck, AlertCircle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = React.use(params);
  const router = useRouter();
  const { user, isAuthenticated, login, signup } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [invitationDetails, setInvitationDetails] = useState<Awaited<ReturnType<typeof familyApi.getInvitationDetails>> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAccepted, setIsAccepted] = useState(false);

  // Form state for new users
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // For existing users
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isNewUser, setIsNewUser] = useState(true);

  const loadInvitationDetails = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const details = await familyApi.getInvitationDetails(token);

      if (details.is_expired) {
        setError('This invitation has expired. Please contact the sender for a new invitation.');
      } else {
        setInvitationDetails(details);
      }
    } catch {
      setError('Invalid or expired invitation link.');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInvitationDetails();
  }, [loadInvitationDetails]);

  const handleAcceptAsNewUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!fullName || !email || !password || !confirmPassword) {
      toast.error('Please fill in all fields');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    try {
      setIsLoading(true);

      // 1. Signup
      await signup({ email, password, full_name: fullName });

      // 2. Accept invitation
      await familyApi.acceptInvitation({ token, full_name: fullName, password });

      setIsAccepted(true);
      toast.success('Invitation accepted! You can now chat with their AI.');

      // Redirect to chat after 2 seconds
      setTimeout(() => {
        router.push('/chat');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      toast.error('Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAcceptAsExistingUser = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation
    if (!loginEmail || !loginPassword) {
      toast.error('Please enter your email and password');
      return;
    }

    try {
      setIsLoading(true);

      // 1. Login
      await login({ email: loginEmail, password: loginPassword });

      // 2. Accept invitation
      await familyApi.acceptInvitation({ token });

      setIsAccepted(true);
      toast.success('Invitation accepted! You can now chat with their AI.');

      // Redirect to chat after 2 seconds
      setTimeout(() => {
        router.push('/chat');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
      toast.error('Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  };

  const acceptInvitationAutomatically = useCallback(async () => {
    try {
      setIsLoading(true);
      await familyApi.acceptInvitation({ token });
      setIsAccepted(true);
      toast.success('Invitation accepted! You can now chat with their AI.');
      setTimeout(() => {
        router.push('/chat');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    } finally {
      setIsLoading(false);
    }
  }, [token, router]);

  useEffect(() => {
    if (isAuthenticated && user && invitationDetails && !isAccepted) {
      acceptInvitationAutomatically();
    }
  }, [isAuthenticated, user, invitationDetails, isAccepted, acceptInvitationAutomatically]);

  if (isLoading && !invitationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-lg text-muted-foreground">Loading invitation...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !invitationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Invalid Invitation</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          </CardContent>
          <CardFooter>
            <Button onClick={() => router.push('/')} variant="outline" className="w-full">
              Go to Homepage
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  if (isAccepted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
        <Card className="w-full max-w-md border-green-500">
          <CardHeader>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              <CardTitle>Invitation Accepted!</CardTitle>
            </div>
            <CardDescription>Redirecting you to chat...</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-green-600" />
              <p className="text-sm text-muted-foreground text-center">
                You can now chat with {invitationDetails?.ai_owner.full_name}&apos;s AI personality!
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#faf8f5] p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <UserCheck className="h-12 w-12 mx-auto mb-4 text-primary" />
          <CardTitle className="text-2xl">You&apos;re Invited!</CardTitle>
          <CardDescription>
            <strong>{invitationDetails?.ai_owner.full_name}</strong> has invited you to chat with their AI
            personality as their <strong>{invitationDetails?.relationship}</strong>.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Toggle between new user and existing user */}
          <div className="flex gap-2 mb-6">
            <Button
              variant={isNewUser ? 'default' : 'outline'}
              onClick={() => setIsNewUser(true)}
              className="flex-1"
            >
              New User
            </Button>
            <Button
              variant={!isNewUser ? 'default' : 'outline'}
              onClick={() => setIsNewUser(false)}
              className="flex-1"
            >
              Existing User
            </Button>
          </div>

          {isNewUser ? (
            // New User Form
            <form onSubmit={handleAcceptAsNewUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Accept & Create Account
                  </>
                )}
              </Button>
            </form>
          ) : (
            // Existing User Form
            <form onSubmit={handleAcceptAsExistingUser} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="loginEmail">Email *</Label>
                <Input
                  id="loginEmail"
                  type="email"
                  placeholder="you@example.com"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="loginPassword">Password *</Label>
                <Input
                  id="loginPassword"
                  type="password"
                  placeholder="Your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                  disabled={isLoading}
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Login & Accept
                  </>
                )}
              </Button>
            </form>
          )}
        </CardContent>

        <CardFooter className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground text-center">
            By accepting, you&apos;ll be able to chat with {invitationDetails?.ai_owner.full_name}&apos;s AI personality. You
            cannot modify their voice or settings.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}

