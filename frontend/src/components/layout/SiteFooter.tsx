'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail, Instagram } from 'lucide-react';

const INSTAGRAM_HANDLE = 'voicevault.life';
const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE}`;
const SUPPORT_EMAIL = 'Info@voicevault.life';

const columns = [
  {
    title: 'Product',
    links: [
      { href: '/#how-it-works', label: 'How it works' },
      { href: '/pricing', label: 'Pricing' },
      { href: '/signup', label: 'Get started' },
    ],
  },
  {
    title: 'Company',
    links: [
      { href: '/terms', label: 'Terms' },
      { href: '/privacy', label: 'Privacy' },
      { href: `mailto:${SUPPORT_EMAIL}`, label: 'Contact' },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-card" role="contentinfo">
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-[1.5fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Link href="/" className="inline-flex min-h-11 w-fit items-center gap-2.5">
              <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9" />
              <span className="font-logo text-xl font-bold text-foreground">VoiceVault</span>
            </Link>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              Keep your voice and your stories for the people who matter most.
            </p>
            <div className="flex gap-2">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Instagram @${INSTAGRAM_HANDLE}`}
              >
                <Instagram className="h-4 w-4" strokeWidth={1.75} />
              </a>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="flex h-11 w-11 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Email ${SUPPORT_EMAIL}`}
              >
                <Mail className="h-4 w-4" strokeWidth={1.75} />
              </a>
            </div>
          </div>

          {columns.map((col) => (
            <nav key={col.title} aria-label={col.title} className="flex flex-col gap-0 lg:gap-3">
              <p className="text-sm font-semibold text-foreground">{col.title}</p>
              {col.links.map((l) => (
                <Link key={l.label} href={l.href} className="flex min-h-11 items-center text-sm text-muted-foreground transition-colors hover:text-foreground lg:min-h-0">
                  {l.label}
                </Link>
              ))}
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-border pt-6 text-sm text-muted-foreground">
          © {new Date().getFullYear()} VoiceVault. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
