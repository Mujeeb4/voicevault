'use client';

/**
 * Sticky brand header for onboarding and marketing pages.
 */

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function OnboardingHeader() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/78 backdrop-blur-xl supports-[backdrop-filter]:bg-background/72">
      <div className="archive-rule absolute left-0 right-0 top-0 h-px" />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[4.25rem] sm:px-6">
        {/* Logo */}
        <Link
          href="/"
          className="group flex items-center gap-2.5 text-foreground transition-all duration-200 hover:opacity-90"
          aria-label="VoiceVault Home"
        >
          <Image
            src="/logo.png"
            alt="VoiceVault"
            width={40}
            height={40}
            className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-primary/20 transition-all duration-200 group-hover:ring-primary/40 sm:h-10 sm:w-10"
          />
          <span className="font-logo text-lg font-bold sm:text-xl">
            Voice<span className="text-gradient-amber">Vault</span>
          </span>
        </Link>

        {/* Nav */}
        <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Main navigation">
          <Link
            href="/"
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 md:inline-block md:px-4 ${
              pathname === '/'
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            Home
          </Link>
          <Link
            href="/pricing"
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 md:inline-block md:px-4 ${
              pathname === '/pricing'
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            Pricing
          </Link>
          <Link
            href="/login"
            className={`hidden rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200 sm:inline-flex sm:px-4 ${
              pathname === '/login'
                ? 'bg-primary/12 text-primary'
                : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
            }`}
          >
            Sign in
          </Link>
          <Link
            href="/pricing"
            className="shimmer-btn glow-amber-sm ml-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all duration-300 hover:scale-[1.03] hover:shadow-md sm:px-5"
          >
            Preserve My Voice
          </Link>
        </nav>
      </div>
    </header>
  );
}
