'use client';

import Link from 'next/link';
import { Home, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="archive-panel max-w-md rounded-lg p-8 text-center">
        <h1 className="font-heading text-6xl font-semibold text-foreground">404</h1>
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
            Go Home
          </Link>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-card/70 px-6 py-3 text-base font-semibold text-foreground transition-all hover:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
            Go Back
          </button>
        </div>
      </div>
    </div>
  );
}
