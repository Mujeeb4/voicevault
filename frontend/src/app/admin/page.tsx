'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  CreditCard,
  FileQuestion,
  Loader2,
  MessageSquare,
  Mic,
  ReceiptText,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { useAdminStore } from '@/store/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

function compactNumber(value: number | undefined): string {
  return new Intl.NumberFormat('en', { notation: 'compact' }).format(value ?? 0);
}

function AdminDashboardContent() {
  const router = useRouter();
  const { stats, isLoadingStats, loadStats } = useAdminStore();

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const statCards = [
    {
      title: 'Users',
      value: stats?.total_users,
      detail: `${stats?.recent_signups ?? 0} new this week`,
      icon: Users,
      tone: 'text-sky-500 bg-sky-500/10',
    },
    {
      title: 'Revenue',
      value: stats?.revenue_display ?? '$0.00',
      detail: `${stats?.payments_succeeded ?? 0} successful payments`,
      icon: CreditCard,
      tone: 'text-emerald-500 bg-emerald-500/10',
    },
    {
      title: 'Recordings',
      value: compactNumber(stats?.total_recordings),
      detail: `${stats?.ai_ready_count ?? 0} AI profiles ready`,
      icon: Mic,
      tone: 'text-amber-500 bg-amber-500/10',
    },
    {
      title: 'Failures',
      value: compactNumber(stats?.failed_count),
      detail: `${stats?.failed_processing ?? 0} processing failures`,
      icon: AlertTriangle,
      tone: 'text-red-500 bg-red-500/10',
    },
  ];

  const actions = [
    {
      title: 'Questions',
      description: `${stats?.active_questions ?? 0} active, ${stats?.inactive_questions ?? 0} inactive`,
      href: '/admin/questions',
      icon: FileQuestion,
    },
    {
      title: 'Users',
      description: 'Search vault owners and inspect their status',
      href: '/admin/users',
      icon: Users,
    },
    {
      title: 'Payments',
      description: `${stats?.payments_total ?? 0} total payment records`,
      href: '/admin/payments',
      icon: ReceiptText,
    },
    {
      title: 'Processing',
      description: `${stats?.pending_processing ?? 0} queued or waiting`,
      href: '/admin/processing',
      icon: Activity,
    },
    {
      title: 'Failed Logs',
      description: `${stats?.failed_count ?? 0} current failure signals`,
      href: '/admin/logs',
      icon: AlertTriangle,
    },
    {
      title: 'Conversations',
      description: `${stats?.total_conversations ?? 0} family chat responses`,
      href: '/admin/users',
      icon: MessageSquare,
    },
  ];

  if (isLoadingStats && !stats) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="space-y-4 text-center">
          <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading admin console...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Admin Console</span>
          </div>
          <h1 className="font-heading text-3xl font-semibold text-foreground sm:text-4xl">VoiceVault Operations</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Monitor users, payments, question prompts, processing health, and failure signals from one authorized view.
          </p>
        </div>
        <Button onClick={() => loadStats()} variant="outline" className="w-full sm:w-fit">
          Refresh
        </Button>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="overflow-hidden border-border bg-card/70">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
              <div>
                <CardDescription>{stat.title}</CardDescription>
                <CardTitle className="mt-2 text-2xl">{stat.value}</CardTitle>
              </div>
              <div className={cn('rounded-lg p-2', stat.tone)}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground">{stat.detail}</p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">Admin Areas</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
            {actions.map((action) => (
              <button
                key={action.title}
                type="button"
                onClick={() => router.push(action.href)}
                className="group flex min-h-[88px] items-center justify-between rounded-lg border border-border bg-card/60 px-4 py-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/50"
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <action.icon className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{action.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{action.description}</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <Card className="border-border bg-card/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Recent Payments</CardTitle>
                <CardDescription>Latest Stripe payment records</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin/payments')}>
                View all
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(stats?.recent_payments ?? []).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="py-8 text-center text-sm text-muted-foreground">
                        No payment records yet
                      </TableCell>
                    </TableRow>
                  ) : (
                    stats?.recent_payments?.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell>
                          <p className="font-medium">{payment.user_name}</p>
                          <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant={payment.status === 'succeeded' ? 'success' : payment.status === 'failed' ? 'error' : 'secondary'}>
                            {payment.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">{payment.amount_display}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="border-border bg-card/70">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Failure Signals</CardTitle>
                <CardDescription>Processing, recording, and API failures</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => router.push('/admin/logs')}>
                View logs
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {(stats?.recent_failures ?? []).length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted/25 p-6 text-center text-sm text-muted-foreground">
                    No failed logs found
                  </div>
                ) : (
                  stats?.recent_failures?.map((entry) => (
                    <div key={`${entry.source}-${entry.id}`} className="rounded-lg border border-border bg-background/50 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={entry.level === 'error' ? 'error' : 'warning'}>{entry.source}</Badge>
                            {entry.user_email && <span className="text-xs text-muted-foreground">{entry.user_email}</span>}
                          </div>
                          <p className="mt-2 text-sm text-foreground">{entry.message}</p>
                        </div>
                        <span className="whitespace-nowrap text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <AdminRoute>
      <AdminDashboardContent />
    </AdminRoute>
  );
}
