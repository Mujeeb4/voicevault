'use client';

/**
 * Global Error Page (Next.js App Router)
 * Catches errors in the app directory
 * Following .cursorrules patterns
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2 text-destructive mb-2">
            <AlertCircle className="h-6 w-6" />
            <CardTitle>Something went wrong</CardTitle>
          </div>
          <CardDescription>
            We encountered an unexpected error. Please try refreshing the page.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {process.env.NODE_ENV === 'development' && (
            <div className="mb-4 p-3 bg-muted rounded-md">
              <p className="text-sm font-mono text-destructive break-all">{error.message}</p>
              {error.digest && (
                <p className="mt-2 text-xs text-muted-foreground">Error ID: {error.digest}</p>
              )}
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <Button onClick={reset} className="flex-1">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            <Button onClick={() => (window.location.href = '/')} variant="outline" className="flex-1">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          </div>
        </CardContent>
        <CardFooter>
          <p className="w-full text-center text-xs text-muted-foreground">
            If this problem persists, please contact support.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
}
