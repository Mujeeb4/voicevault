'use client';

/**
 * Sidebar Component
 * Collapsible sidebar with role-based menu items
 * Shows different sections based on user's roles (AI Owner / Family Member)
 */

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { familyApi } from '@/lib/api/family';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import {
    Mic,
    Brain,
    MessageSquare,
    Users,
    ChevronLeft,
    ChevronRight,
    LayoutDashboard,
    CreditCard,
    User,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';

interface AccessibleAI {
    id: string;
    full_name: string;
    ai_ready: boolean;
    relationship: string;
}

interface SidebarProps {
    isCollapsed: boolean;
    onToggle: () => void;
}

interface SidebarItemProps {
    href: string;
    icon: React.ReactNode;
    label: string;
    isActive?: boolean;
    isCollapsed: boolean;
    badge?: string;
    disabled?: boolean;
}

function SidebarItem({ href, icon, label, isActive, isCollapsed, badge, disabled }: SidebarItemProps) {
    const content = (
        <div
            className={cn(
                'flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 ease-smooth',
                isActive
                    ? 'border border-primary/20 bg-primary/12 text-primary font-semibold shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.08)]'
                    : 'border border-transparent text-muted-foreground hover:border-border hover:bg-muted/70 hover:text-foreground',
                disabled && 'opacity-50 cursor-not-allowed',
                isCollapsed && 'justify-center'
            )}
        >
            <div className="flex-shrink-0">{icon}</div>
            {!isCollapsed && (
                <>
                    <span className="flex-1 truncate">{label}</span>
                    {badge && (
                        <span className="rounded-full border border-primary/20 bg-primary/12 px-2 py-0.5 text-xs font-semibold text-primary">
                            {badge}
                        </span>
                    )}
                </>
            )}
        </div>
    );

    if (disabled) {
        return <div className="cursor-not-allowed">{content}</div>;
    }

    return <Link href={href}>{content}</Link>;
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
    const pathname = usePathname();
    const { user } = useAuthStore();
    const [accessibleAIs, setAccessibleAIs] = useState<AccessibleAI[]>([]);
    const [, setIsLoadingAIs] = useState(false);

    // Determine user roles
    const isAIOwner = !!user;
    const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');

    // Load accessible AIs (for family member section)
    useEffect(() => {
        if (user) {
            loadAccessibleAIs();
        }
    }, [user]);

    const loadAccessibleAIs = async () => {
        try {
            setIsLoadingAIs(true);
            const response = await familyApi.getAccessibleAIs();
            // Filter out self (own AI)
            const otherAIs = response.results.filter(
                (ai) => ai.relationship !== 'self' && ai.ai_ready
            );
            setAccessibleAIs(otherAIs);
        } catch {
            console.error('Failed to load accessible AIs');
        } finally {
            setIsLoadingAIs(false);
        }
    };

    const isFamilyMember = accessibleAIs.length > 0;

    return (
        <aside
            className={cn(
                'flex flex-col bg-card/70 border-r border-border h-full transition-all duration-300 ease-smooth backdrop-blur-xl',
                isCollapsed ? 'w-16' : 'w-64'
            )}
        >
            {/* Logo / Brand */}
            <div className="flex items-center justify-between border-b border-border p-4">
                {!isCollapsed && (
                    <Link href="/dashboard" className="flex items-center gap-2 text-foreground hover:opacity-90 transition-opacity">
                        <Image src="/logo.png" alt="VoiceVault" width={36} height={36} className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-primary/20" />
                        <span className="font-logo text-lg font-bold">VoiceVault</span>
                    </Link>
                )}
                <Button
                    variant="ghost"
                    size="icon"
                    onClick={onToggle}
                    className={cn(isCollapsed && 'mx-auto')}
                >
                    {isCollapsed ? (
                        <ChevronRight className="h-4 w-4" />
                    ) : (
                        <ChevronLeft className="h-4 w-4" />
                    )}
                </Button>
            </div>

            <ScrollArea className="flex-1 px-2 py-4">
                {/* AI Owner Section */}
                {(isAIOwner || !isFamilyMember) && (
                    <div className="space-y-1">
                        {!isCollapsed && (
                            <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                                My AI
                            </p>
                        )}

                        <SidebarItem
                            href="/dashboard"
                            icon={<LayoutDashboard className="h-5 w-5" />}
                            label="Dashboard"
                            isActive={pathname === '/dashboard'}
                            isCollapsed={isCollapsed}
                        />

                        <SidebarItem
                            href="/record"
                            icon={<Mic className="h-5 w-5" />}
                            label="Record Voice"
                            isActive={pathname === '/record'}
                            isCollapsed={isCollapsed}
                            badge={user?.recording_completed ? '✓' : undefined}
                        />

                        <SidebarItem
                            href="/processing"
                            icon={<Brain className="h-5 w-5" />}
                            label="AI Processing"
                            isActive={pathname === '/processing'}
                            isCollapsed={isCollapsed}
                            disabled={!user?.recording_completed}
                        />

                        <SidebarItem
                            href="/chat"
                            icon={<MessageSquare className="h-5 w-5" />}
                            label="Test My AI"
                            isActive={pathname === '/chat' && !pathname.includes('/chat/')}
                            isCollapsed={isCollapsed}
                            disabled={!user?.ai_ready}
                        />

                        <SidebarItem
                            href="/family"
                            icon={<Users className="h-5 w-5" />}
                            label="Manage Family"
                            isActive={pathname === '/family'}
                            isCollapsed={isCollapsed}
                            disabled={!user?.ai_ready}
                        />

                        {!isPremium && (
                            <SidebarItem
                                href="/pricing"
                                icon={<CreditCard className="h-5 w-5" />}
                                label="Unlock Premium"
                                isActive={pathname === '/pricing'}
                                isCollapsed={isCollapsed}
                                badge="Upgrade"
                            />
                        )}
                    </div>
                )}

                {/* Family AIs Section */}
                {isFamilyMember && (
                    <>
                        {!isCollapsed && <Separator className="my-4" />}

                        <div className="space-y-1 mt-4">
                            {!isCollapsed && (
                                <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                                    Family AIs
                                </p>
                            )}

                            {accessibleAIs.map((ai) => (
                                <SidebarItem
                                    key={ai.id}
                                    href={`/chat/${ai.id}`}
                                    icon={<MessageSquare className="h-5 w-5" />}
                                    label={`${ai.full_name}'s AI`}
                                    isActive={pathname === `/chat/${ai.id}`}
                                    isCollapsed={isCollapsed}
                                />
                            ))}
                        </div>
                    </>
                )}

                {/* Settings Section */}
                {!isCollapsed && <Separator className="my-4" />}

                <div className="space-y-1 mt-4">
                    {!isCollapsed && (
                        <p className="mb-2 px-3 text-xs font-semibold uppercase text-muted-foreground">
                            Settings
                        </p>
                    )}

                    <SidebarItem
                        href="/settings"
                        icon={<User className="h-5 w-5" />}
                        label="Profile"
                        isActive={pathname === '/settings'}
                        isCollapsed={isCollapsed}
                    />

                    <SidebarItem
                        href="/settings#billing"
                        icon={<CreditCard className="h-5 w-5" />}
                        label="Billing"
                        isActive={pathname === '/settings'}
                        isCollapsed={isCollapsed}
                    />
                </div>
            </ScrollArea>

            {/* User Info at Bottom */}
            {!isCollapsed && user && (
                <div className="border-t border-border p-4">
                    <div className="flex items-center gap-3 rounded-lg border border-border bg-background/45 p-3">
                        <div className="w-8 h-8 rounded-lg bg-primary/12 flex items-center justify-center">
                            <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">{user.full_name}</p>
                            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                    </div>
                </div>
            )}
        </aside>
    );
}
