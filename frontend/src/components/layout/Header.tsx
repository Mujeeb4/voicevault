'use client';

/**
 * App top bar: page context on mobile, plan badge and account menu.
 */

import React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import { PersonAvatar } from '@/components/ui/person-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Settings, LogOut, CreditCard } from 'lucide-react';

export function Header() {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');

  const handleLogout = () => {
    logout();
    // A full navigation completes logout teardown without competing with the route guard.
    window.location.assign('/');
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-card px-4 sm:px-6">
      <div className="flex items-center gap-2.5 lg:hidden">
        <Image src="/logo.png" alt="" width={32} height={32} className="h-8 w-8" />
        <span className="font-logo text-lg font-bold text-foreground">VoiceVault</span>
      </div>
      <div className="hidden lg:block" />

      <div className="flex items-center gap-3">
        {user && (
          <span
            className={
              isPremium
                ? 'rounded-full bg-accent px-2.5 py-1 text-xs font-semibold text-accent-foreground'
                : 'rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'
            }
          >
            {isPremium ? 'Premium' : 'Free plan'}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-10 gap-2 px-2" aria-label="Account menu">
              <PersonAvatar name={user?.full_name || user?.email} size="sm" tone="solid" />
              <span className="hidden text-sm font-medium text-foreground sm:inline">{user?.full_name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <p className="font-medium text-foreground">{user?.full_name}</p>
              <p className="text-xs font-normal text-muted-foreground">{user?.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => router.push('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => router.push('/settings#billing')}>
              <CreditCard className="mr-2 h-4 w-4" />
              Plan and billing
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
