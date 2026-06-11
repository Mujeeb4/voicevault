'use client';

/**
 * Dashboard Layout Component
 * Wrapper with sidebar and header for all dashboard pages
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface DashboardLayoutProps {
    children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
    const router = useRouter();
    const { isAuthenticated, isLoading, checkAuth, user } = useAuthStore();
    const [hasCheckedAuth, setHasCheckedAuth] = useState(false);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [isMobile, setIsMobile] = useState(false);

    // Check authentication on mount
    useEffect(() => {
        let isMounted = true;

        checkAuth().finally(() => {
            if (isMounted) {
                setHasCheckedAuth(true);
            }
        });

        return () => {
            isMounted = false;
        };
    }, [checkAuth]);

    // Handle responsive sidebar
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 1024;
            setIsMobile(mobile);
            if (mobile) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
        if (hasCheckedAuth && !isLoading && !isAuthenticated) {
            router.push('/login?redirect=/dashboard');
        }
    }, [hasCheckedAuth, isLoading, isAuthenticated, router]);

    // Loading state
    if (!hasCheckedAuth || isLoading || !user) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading your voice vault...</p>
                </div>
            </div>
        );
    }

    const toggleSidebar = () => {
        if (isMobile) {
            setSidebarOpen(!sidebarOpen);
        } else {
            setSidebarCollapsed(!sidebarCollapsed);
        }
    };

    return (
        <div className="h-screen bg-background flex overflow-hidden">
            {/* Sidebar - Desktop */}
            <div
                className={cn(
                    'hidden lg:block transition-all duration-300',
                    sidebarCollapsed ? 'w-16' : 'w-64'
                )}
            >
                <div className="h-full border-r border-border bg-card/55 backdrop-blur-xl">
                    <Sidebar isCollapsed={sidebarCollapsed} onToggle={toggleSidebar} />
                </div>
            </div>

            {/* Sidebar - Mobile Overlay */}
            {isMobile && sidebarOpen && (
                <>
                    <div
                        className="fixed inset-0 bg-black/50 z-40"
                        onClick={() => setSidebarOpen(false)}
                    />
                    <div className="fixed left-0 top-0 h-full z-50">
                        <Sidebar isCollapsed={false} onToggle={() => setSidebarOpen(false)} />
                    </div>
                </>
            )}

            {/* Main Content */}
            <div className="flex-1 flex flex-col h-full min-w-0">
                <Header onMenuToggle={toggleSidebar} />
                <main className="flex-1 overflow-y-auto">
                    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
                        {children}
                    </div>
                </main>
            </div>
        </div>
    );
}
