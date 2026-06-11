'use client';

/**
 * Admin Route Protection
 * Requires admin permissions (is_staff or is_superuser)
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { isAdmin } from '@/lib/api/admin';
import { Loader2, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AdminRouteProps {
  children: React.ReactNode;
}

export const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, checkAuth } = useAuthStore();
  const [hasCheckedAuth, setHasCheckedAuth] = useState(false);

  useEffect(() => {
    let isMounted = true;

    checkAuth().finally(() => {
      if (isMounted) setHasCheckedAuth(true);
    });

    return () => {
      isMounted = false;
    };
  }, [checkAuth]);

  useEffect(() => {
    if (hasCheckedAuth && !isLoading && !isAuthenticated) {
      router.push('/login?redirect=/admin');
    }
  }, [hasCheckedAuth, isAuthenticated, isLoading, router]);

  // Still loading authentication
  if (!hasCheckedAuth || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Verifying admin permissions...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
          <p className="text-lg text-muted-foreground">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // Not an admin
  if (!isAdmin(user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        <Card className="w-full max-w-md border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive mb-2">
              <ShieldAlert className="h-6 w-6" />
              <CardTitle>Access Denied</CardTitle>
            </div>
            <CardDescription>You don&apos;t have permission to access the admin dashboard.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This area is restricted to administrators only. If you believe you should have access, please contact
              support.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => router.push('/dashboard')} className="flex-1">
                Go to Dashboard
              </Button>
              <Button onClick={() => router.push('/')} variant="outline" className="flex-1">
                Go to Homepage
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Is admin - render children
  return <>{children}</>;
};
