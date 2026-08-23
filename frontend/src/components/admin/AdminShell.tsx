'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Activity,
  ArrowLeft,
  CreditCard,
  FileQuestion,
  LayoutDashboard,
  ScrollText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const adminLinks = [
  { href: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/questions', label: 'Questions', icon: FileQuestion },
  { href: '/admin/processing', label: 'Processing', icon: Activity },
  { href: '/admin/payments', label: 'Payments', icon: CreditCard },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 py-3 sm:px-6">
          <Link
            href="/admin"
            className="flex shrink-0 items-center gap-2 rounded-lg pr-3 text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            aria-label="VoiceVault admin overview"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-500">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="hidden sm:block">
              <span className="block text-sm font-semibold leading-tight">VoiceVault Admin</span>
              <span className="block text-[11px] leading-tight text-muted-foreground">
                Operations console
              </span>
            </span>
          </Link>

          <nav aria-label="Administrator navigation" className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max items-center gap-1">
              {adminLinks.map((item) => {
                const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? 'page' : undefined}
                    className={cn(
                      'inline-flex min-h-10 items-center gap-2 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      active
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <Icon className="h-4 w-4" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </nav>

          <Link
            href="/dashboard"
            className="inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border border-border px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <span className="hidden lg:inline">User dashboard</span>
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
