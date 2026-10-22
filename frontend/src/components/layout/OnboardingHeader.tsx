'use client';

/**
 * Public site header: logo, four links, one primary action.
 * Used on marketing, pricing and legal pages.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { cn } from '@/lib/utils';

const links = [
  { href: '/#how-it-works', label: 'How it works' },
  { href: '/pricing', label: 'Pricing' },
];

export function OnboardingHeader() {
  const pathname = usePathname();
  const { isAuthenticated, checkAuth } = useAuthStore();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    void checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const accountHref = isAuthenticated ? '/dashboard' : '/login';
  const accountLabel = isAuthenticated ? 'My vault' : 'Sign in';
  const ctaHref = isAuthenticated ? '/dashboard' : '/signup';
  const ctaLabel = isAuthenticated ? 'Open my vault' : 'Get started';

  const linkClass = (active: boolean) =>
    cn(
      'inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors',
      active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
    );

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5" aria-label="VoiceVault home">
          <Image src="/logo.png" alt="" width={40} height={40} className="h-9 w-9 shrink-0" priority />
          <span className="font-logo text-xl font-bold text-foreground">VoiceVault</span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className={linkClass(pathname === l.href)}>
              {l.label}
            </Link>
          ))}
          <Link href={accountHref} className={linkClass(pathname === accountHref)}>
            {accountLabel}
          </Link>
          <Link
            href={ctaHref}
            className="ml-2 inline-flex h-10 items-center rounded-[10px] bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {ctaLabel}
          </Link>
        </nav>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-foreground hover:bg-muted md:hidden"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav className="border-t border-border bg-background px-4 pb-4 pt-2 md:hidden" aria-label="Mobile navigation">
          <div className="flex flex-col">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted">
                {l.label}
              </Link>
            ))}
            <Link href={accountHref} className="rounded-lg px-3 py-3 text-base font-medium text-foreground hover:bg-muted">
              {accountLabel}
            </Link>
            <Link
              href={ctaHref}
              className="mt-2 inline-flex h-12 items-center justify-center rounded-[10px] bg-primary text-base font-semibold text-primary-foreground"
            >
              {ctaLabel}
            </Link>
          </div>
        </nav>
      )}
    </header>
  );
}
