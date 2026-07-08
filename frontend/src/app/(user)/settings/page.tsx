'use client';

/**
 * Settings Page
 * User profile settings and account management
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/auth';
import { paymentsApi } from '@/lib/api/payments';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { User, Mail, Lock, Save, Loader2, CheckCircle, CreditCard, Calendar, Receipt, ExternalLink, Sparkles } from 'lucide-react';
import { toast } from 'sonner';

interface BillingDetails {
    is_paid: boolean;
    plan_name: string | null;
    amount_paid_cents: number | null;
    paid_at: string | null;
    payment_method_display: string | null;
    is_lifetime: boolean;
    receipt_url: string | null;
}

export default function SettingsPage() {
    const router = useRouter();
    const { user, updateUser } = useAuthStore();

    const [fullName, setFullName] = useState(user?.full_name || '');
    const [email] = useState(user?.email || '');
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isChangingPassword, setIsChangingPassword] = useState(false);

    const [billing, setBilling] = useState<BillingDetails | null>(null);
    const [billingLoading, setBillingLoading] = useState(true);

    useEffect(() => {
        paymentsApi.getBillingDetails()
            .then(setBilling)
            .catch(() => setBilling(null))
            .finally(() => setBillingLoading(false));
    }, []);

    // Scroll to #billing when opening Settings via Billing link
    useEffect(() => {
        if (typeof window !== 'undefined' && window.location.hash === '#billing') {
            const el = document.getElementById('billing');
            el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();

        try {
            setIsSaving(true);
            // TODO: Implement API call to update profile
            updateUser({ full_name: fullName });
            toast.success('Profile updated successfully');
        } catch {
            toast.error('Failed to update profile');
        } finally {
            setIsSaving(false);
        }
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();

        if (newPassword !== confirmPassword) {
            toast.error('Passwords do not match');
            return;
        }

        if (newPassword.length < 8) {
            toast.error('Password must be at least 8 characters');
            return;
        }

        try {
            setIsChangingPassword(true);
            // TODO: Implement API call to change password
            toast.success('Password changed successfully');
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch {
            toast.error('Failed to change password');
        } finally {
            setIsChangingPassword(false);
        }
    };

    return (
            <div className="max-w-4xl mx-auto space-y-6">
                <div className="journey-hero p-5 sm:p-7">
                    <p className="journey-kicker mb-3">Account controls</p>
                    <h1 className="font-heading text-3xl sm:text-4xl font-bold tracking-normal text-foreground">
                        Settings
                    </h1>
                    <p className="text-muted-foreground mt-2 max-w-2xl">
                        Manage your profile, billing, password, and AI vault readiness from one secure place.
                    </p>
                </div>

                {/* Profile Section */}
                <Card className="journey-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                                <User className="h-5 w-5" />
                            </span>
                            Profile Information
                        </CardTitle>
                        <CardDescription>
                            Update your personal information
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSaveProfile} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="fullName">Full Name</Label>
                                <Input
                                    id="fullName"
                                    value={fullName}
                                    onChange={(e) => setFullName(e.target.value)}
                                    placeholder="Your full name"
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        id="email"
                                        value={email}
                                        disabled
                                        className="bg-muted"
                                    />
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    Email cannot be changed
                                </p>
                            </div>

                            <Button type="submit" disabled={isSaving} className="shimmer-btn text-primary-foreground">
                                {isSaving ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="mr-2 h-4 w-4" />
                                        Save Changes
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Password Section */}
                <Card className="journey-card">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                                <Lock className="h-5 w-5" />
                            </span>
                            Change Password
                        </CardTitle>
                        <CardDescription>
                            Update your password to keep your account secure
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="currentPassword">Current Password</Label>
                                <Input
                                    id="currentPassword"
                                    type="password"
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    placeholder="Enter current password"
                                />
                            </div>

                            <Separator />

                            <div className="space-y-2">
                                <Label htmlFor="newPassword">New Password</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    minLength={8}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    minLength={8}
                                />
                            </div>

                            <Button
                                type="submit"
                                disabled={isChangingPassword || !currentPassword || !newPassword}
                                className="border-border bg-background/70"
                                variant="outline"
                            >
                                {isChangingPassword ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Changing...
                                    </>
                                ) : (
                                    <>
                                        <Lock className="mr-2 h-4 w-4" />
                                        Change Password
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Billing & Payment */}
                <Card id="billing" className="journey-card scroll-mt-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-primary/20 bg-primary/10 text-primary">
                                <CreditCard className="h-5 w-5" />
                            </span>
                            Billing & Payment
                        </CardTitle>
                        <CardDescription>
                            Manage your subscription, payment methods, and billing details
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {billingLoading ? (
                            <div className="flex items-center gap-2 text-muted-foreground py-4">
                                <Loader2 className="h-5 w-5 animate-spin" />
                                Loading billing details...
                            </div>
                        ) : billing?.is_paid ? (
                            <>
                                {/* Paid: Plan & status */}
                                <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                                    <div className="flex items-center gap-2 text-primary font-medium">
                                        <CheckCircle className="h-5 w-5" />
                                        {billing.plan_name ?? 'VoiceVault Lifetime Subscription'}
                                    </div>
                                    <p className="text-sm text-primary/85 mt-1">
                                        Lifetime access · One-time payment. No subscription to cancel.
                                    </p>
                                </div>

                                <Separator />

                                {/* Payment details */}
                                <div className="space-y-4">
                                    <p className="text-sm font-medium text-foreground">Payment details</p>
                                    <dl className="grid gap-3 text-sm">
                                        {billing.payment_method_display && (
                                            <div className="flex justify-between">
                                                <dt className="text-muted-foreground flex items-center gap-2">
                                                    <CreditCard className="h-4 w-4" />
                                                    Payment method
                                                </dt>
                                                <dd className="font-medium">{billing.payment_method_display}</dd>
                                            </div>
                                        )}
                                        {billing.amount_paid_cents != null && (
                                            <div className="flex justify-between">
                                                <dt className="text-muted-foreground">Amount paid</dt>
                                                <dd className="font-medium">
                                                    ${(billing.amount_paid_cents / 100).toFixed(2)}
                                                </dd>
                                            </div>
                                        )}
                                        {billing.paid_at && (
                                            <div className="flex justify-between">
                                                <dt className="text-muted-foreground flex items-center gap-2">
                                                    <Calendar className="h-4 w-4" />
                                                    Paid on
                                                </dt>
                                                <dd className="font-medium">
                                                    {new Date(billing.paid_at).toLocaleDateString(undefined, {
                                                        year: 'numeric',
                                                        month: 'long',
                                                        day: 'numeric',
                                                    })}
                                                </dd>
                                            </div>
                                        )}
                                    </dl>
                                </div>

                                {billing.is_lifetime && (
                                    <>
                                        <Separator />
                                        <div className="rounded-lg border border-border bg-background/55 p-4">
                                            <p className="text-sm font-medium text-foreground">Cancel subscription</p>
                                            <p className="text-sm text-muted-foreground mt-1">
                                                You have lifetime access. There is no recurring subscription to cancel.
                                            </p>
                                        </div>
                                    </>
                                )}

                                <div className="flex flex-wrap gap-2">
                                    {billing.receipt_url && (
                                        <Button variant="outline" size="sm" asChild>
                                            <a href={billing.receipt_url} target="_blank" rel="noopener noreferrer">
                                                <Receipt className="h-4 w-4 mr-2" />
                                                View receipt
                                                <ExternalLink className="h-3 w-3 ml-2" />
                                            </a>
                                        </Button>
                                    )}
                                        <Button variant="outline" size="sm" onClick={() => router.push('/pricing')} className="border-border bg-background/60">
                                        View plan details
                                    </Button>
                                </div>
                            </>
                        ) : (
                            /* Not paid: family member or not yet subscribed */
                            <>
                                <div className="rounded-lg border border-primary/25 bg-primary/10 p-4">
                                    <p className="font-medium text-primary">
                                        No payment methods
                                    </p>
                                    <p className="text-sm text-primary/85 mt-1">
                                        You don&apos;t have an active subscription. Purchase a lifetime subscription to
                                        record your voice, create your AI, and invite family members.
                                    </p>
                                </div>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <Button asChild className="shimmer-btn text-primary-foreground">
                                        <Link href="/pricing" className="inline-flex items-center gap-2">
                                            <Sparkles className="h-4 w-4" />
                                            Buy lifetime subscription
                                        </Link>
                                    </Button>
                                    <Button variant="outline" asChild>
                                        <Link href="/pricing">View pricing</Link>
                                    </Button>
                                </div>
                            </>
                        )}
                    </CardContent>
                </Card>

                {/* Account / AI Status */}
                <Card className="journey-card">
                    <CardHeader>
                        <CardTitle>Account & AI Status</CardTitle>
                        <CardDescription>
                            Your recording and AI readiness
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex justify-between items-center rounded-lg border border-border bg-background/55 p-4">
                            <div>
                                <p className="font-medium">AI Status</p>
                                <p className="text-sm text-muted-foreground">
                                    {user?.ai_ready
                                        ? 'Ready'
                                        : user?.recording_completed
                                            ? 'Processing'
                                            : 'Not started'}
                                </p>
                            </div>
                            {user?.ai_ready && (
                                <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-500">
                                    <CheckCircle className="h-4 w-4" />
                                    Active
                                </span>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
    );
}
