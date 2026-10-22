'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  const handleGoBack = () => {
    const hasSameOriginReferrer = (() => {
      try {
        return (
          Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin
        );
      } catch {
        return false;
      }
    })();

    if (hasSameOriginReferrer) {
      router.back();
      return;
    }

    router.push('/');
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="surface max-w-md p-8 text-center">
        <h1 className="font-heading tracking-tight text-6xl font-semibold text-foreground">404</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          This page doesn&apos;t exist or has been moved.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your voice deserves to be preserved — but this link doesn&apos;t.
        </p>
        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3 text-base font-semibold text-primary-foreground transition-all hover:bg-primary/90 hover:shadow-md"
          >
            <Home className="h-5 w-5" />
            Go to home
          </Link>
          <button
            type="button"
            onClick={handleGoBack}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card px-6 py-3 text-base font-semibold text-foreground transition-all hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>
      </div>
    </main>
  );
}
