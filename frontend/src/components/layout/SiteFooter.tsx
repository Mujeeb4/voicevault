'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Mail, Instagram, Heart, Mic } from 'lucide-react';

const INSTAGRAM_HANDLE = 'voicevault.life';
const INSTAGRAM_URL = `https://instagram.com/${INSTAGRAM_HANDLE.replace('@', '')}`;
const SUPPORT_EMAIL = 'Info@voicevault.life';
const MAILTO_URL = `mailto:${SUPPORT_EMAIL}`;

const pageLinks = [
  { href: '/', label: 'Home' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/#how-it-works', label: 'How It Works' },
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
];

export function SiteFooter() {
  return (
    <footer className="relative border-t border-border bg-background" role="contentinfo">
      <div
        className="archive-rule absolute left-0 right-0 top-0 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, hsl(var(--primary) / 0.2), hsl(var(--secondary) / 0.15), transparent)',
        }}
      />

      <div className="relative mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <Link
              href="/"
              className="group inline-flex w-fit items-center gap-2.5 text-foreground transition-opacity hover:opacity-90"
            >
              <Image
                src="/logo.png"
                alt="VoiceVault"
                width={36}
                height={36}
                className="h-9 w-9 rounded-lg ring-1 ring-primary/20 transition-all duration-200 group-hover:ring-primary/35"
              />
              <span className="font-logo text-xl font-bold">
                Voice<span className="text-gradient-amber">Vault</span>
              </span>
            </Link>

            <p className="max-w-[240px] text-sm leading-relaxed text-muted-foreground">
              Preserving your voice and stories for the people who matter most — forever.
            </p>

            {/* Social icons */}
            <div className="flex gap-2.5">
              <a
                href={INSTAGRAM_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/55 text-muted-foreground transition-all duration-200 hover:scale-110 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                aria-label={`Instagram @${INSTAGRAM_HANDLE}`}
              >
                <Instagram className="h-4 w-4" strokeWidth={1.5} />
              </a>
              <a
                href={MAILTO_URL}
                className="group flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-card/55 text-muted-foreground transition-all duration-200 hover:scale-110 hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
                aria-label={`Email ${SUPPORT_EMAIL}`}
              >
                <Mail className="h-4 w-4" strokeWidth={1.5} />
              </a>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3">
            <p className="text-[11px] font-semibold uppercase text-primary/70">Navigation</p>
            <nav aria-label="Site" className="flex flex-col gap-2">
              {pageLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Mission */}
          <div className="flex flex-col gap-3 max-w-[220px]">
            <p className="text-[11px] font-semibold uppercase text-primary/70">Our Mission</p>
            <div className="flex items-start gap-2.5 rounded-lg border border-border bg-card/55 p-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                <Mic className="h-4 w-4" strokeWidth={1.75} />
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                One day, your voice will be the thing they miss most. We make sure they never lose it.
              </p>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-8 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Made with
            <Heart className="h-3.5 w-3.5 fill-primary/50 text-primary" strokeWidth={0} aria-hidden />
            for Families
          </p>
          <p className="text-sm text-muted-foreground/60">
            © {new Date().getFullYear()} VoiceVault · All rights reserved
          </p>
        </div>
      </div>
    </footer>
  );
}
