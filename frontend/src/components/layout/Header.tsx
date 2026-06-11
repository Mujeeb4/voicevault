'use client';

/**
 * Dashboard Header Component
 * Top navigation bar with hamburger menu and user actions
 */

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Menu, Settings, LogOut, User, CreditCard } from 'lucide-react';
import { toast } from 'sonner';

interface HeaderProps {
    onMenuToggle: () => void;
}

export function Header({ onMenuToggle }: HeaderProps) {
    const router = useRouter();
    const { user, logout } = useAuthStore();
    const planLabel = user?.is_premium || user?.plan_type === 'premium' ? 'Premium' : 'Free';

    const handleLogout = () => {
        logout();
        toast.success('Logged out successfully');
        router.push('/');
    };

    return (
        <header className="h-16 border-b border-border bg-background/78 px-4 flex items-center justify-between backdrop-blur-xl sm:px-6">
            {/* Left: Menu Toggle */}
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={onMenuToggle} className="lg:hidden">
                    <Menu className="h-5 w-5" />
                </Button>
                <h1 className="font-logo text-lg font-bold text-foreground lg:hidden">VoiceVault</h1>
            </div>

            {/* Right: User Menu */}
            <div className="flex items-center gap-2">
                {/* Package Badge */}
                {user && (
                    <span className="hidden sm:inline-flex rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                        {planLabel}
                    </span>
                )}

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="flex items-center gap-2 hover:bg-muted/70">
                            <div className="w-8 h-8 rounded-lg border border-primary/20 bg-primary/12 flex items-center justify-center">
                                <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="hidden sm:inline text-foreground font-medium">{user?.full_name}</span>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            <div>
                                <p className="font-medium text-foreground">{user?.full_name}</p>
                                <p className="text-xs text-muted-foreground">{user?.email}</p>
                            </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => router.push('/settings')}>
                            <Settings className="mr-2 h-4 w-4" />
                            Settings
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => router.push('/pricing')}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Billing
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                            <LogOut className="mr-2 h-4 w-4" />
                            Logout
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    );
}
