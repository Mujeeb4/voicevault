'use client';

/**
 * App navigation: five items that follow the user's journey.
 * Desktop: fixed left sidebar. Mobile: bottom bar (see MobileNav).
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { Home, Mic, MessageSquare, Users, UserCircle, ShieldCheck, Lock, Sparkles } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { familyApi } from '@/lib/api/family';
import { cn } from '@/lib/utils';

interface AccessibleAI {
  id: string;
  full_name: string;
  ai_ready: boolean;
  relationship: string;
}

interface NavItem {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
  disabledReason?: string;
}

function useNavItems() {
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [familyAIs, setFamilyAIs] = useState<AccessibleAI[]>([]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    familyApi
      .getAccessibleAIs()
      .then((res) => {
        if (!cancelled) {
          setFamilyAIs(res.results.filter((ai) => ai.relationship !== 'self' && ai.ai_ready));
        }
      })
      .catch(() => {
        /* family list is optional */
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const recorded = !!user?.recording_completed;
  const aiReady = !!user?.ai_ready;

  const items: NavItem[] = [
    { key: 'home', href: '/dashboard', label: 'Home', icon: Home, active: pathname === '/dashboard' },
    {
      key: 'voice',
      href: recorded ? '/processing' : '/record',
      label: 'My voice',
      icon: Mic,
      active: pathname === '/record' || pathname === '/processing',
    },
    {
      key: 'chat',
      href: '/chat',
      label: 'Chat',
      icon: MessageSquare,
      active: pathname.startsWith('/chat'),
      disabledReason: aiReady ? undefined : 'Available once your AI is ready',
    },
    {
      key: 'family',
      href: '/family',
      label: 'Family',
      icon: Users,
      active: pathname === '/family',
      disabledReason: aiReady ? undefined : 'Available once your AI is ready',
    },
    { key: 'account', href: '/settings', label: 'Account', icon: UserCircle, active: pathname === '/settings' },
  ];

  return { items, familyAIs, pathname, user };
}

export function Sidebar() {
  const { items, familyAIs, pathname, user } = useNavItems();
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');

  return (
    <aside className="flex h-full w-64 flex-col border-r border-border bg-card" aria-label="App navigation">
      <div className="flex h-16 items-center border-b border-border px-5">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <Image src="/logo.png" alt="" width={36} height={36} className="h-9 w-9" />
          <span className="font-logo text-lg font-bold text-foreground">VoiceVault</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {items.map((item) => {
          const Icon = item.icon;
          const base = 'flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium transition-colors';
          if (item.disabledReason) {
            return (
              <div key={item.key} className={cn(base, 'cursor-not-allowed text-muted-foreground')} title={item.disabledReason}>
                <Icon className="h-5 w-5" />
                <span className="flex-1">{item.label}</span>
                <Lock className="h-3.5 w-3.5" aria-label={item.disabledReason} />
              </div>
            );
          }
          return (
            <React.Fragment key={item.key}>
              <Link
                href={item.href}
                aria-current={item.active ? 'page' : undefined}
                className={cn(
                  base,
                  item.active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </Link>
              {item.key === 'chat' &&
                familyAIs.map((ai) => (
                  <Link
                    key={ai.id}
                    href={`/chat/${ai.id}`}
                    className={cn(
                      'ml-8 flex min-h-9 items-center rounded-lg px-3 text-sm transition-colors',
                      pathname === `/chat/${ai.id}`
                        ? 'bg-accent font-medium text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <span className="truncate">{ai.full_name}</span>
                  </Link>
                ))}
            </React.Fragment>
          );
        })}

        {user?.is_admin && (
          <Link
            href="/admin"
            className="flex min-h-11 items-center gap-3 rounded-[10px] px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ShieldCheck className="h-5 w-5" />
            Admin
          </Link>
        )}
      </nav>

      <div className="space-y-3 border-t border-border p-4">
        {!isPremium && (
          <Link
            href="/pricing"
            className="flex items-center gap-3 rounded-[10px] bg-accent p-3 text-sm transition-colors hover:bg-accent/70"
          >
            <Sparkles className="h-5 w-5 shrink-0 text-primary" />
            <span>
              <span className="block font-semibold text-accent-foreground">Unlock Premium</span>
              <span className="block text-xs text-muted-foreground">Full voice and family sharing</span>
            </span>
          </Link>
        )}
        {user && (
          <div className="min-w-0 px-1">
            <p className="truncate text-sm font-medium text-foreground">{user.full_name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
      </div>
    </aside>
  );
}

export function MobileNav() {
  const { items } = useNavItems();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
      aria-label="App navigation"
    >
      {items.map((item) => {
        const Icon = item.icon;
        const cls = cn(
          'flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium',
          item.active ? 'text-primary' : 'text-muted-foreground',
          item.disabledReason && 'opacity-40'
        );
        if (item.disabledReason) {
          return (
            <div key={item.key} className={cls} title={item.disabledReason} aria-disabled>
              <Icon className="h-5 w-5" />
              {item.label}
            </div>
          );
        }
        return (
          <Link key={item.key} href={item.href} className={cls} aria-current={item.active ? 'page' : undefined}>
            <Icon className="h-5 w-5" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
