'use client';

import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ExternalLink, Loader2, Search } from 'lucide-react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { adminApi } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminPayment, AdminPaymentStatus } from '@/types';

const statusVariant: Record<AdminPaymentStatus, 'secondary' | 'success' | 'error' | 'warning'> = {
  pending: 'warning',
  succeeded: 'success',
  failed: 'error',
  refunded: 'secondary',
};

function AdminPaymentsContent() {
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'all' | AdminPaymentStatus>('all');

  useEffect(() => {
    let isMounted = true;

    async function loadPayments() {
      setIsLoading(true);
      try {
        const response = await adminApi.getPayments({
          search,
          status,
          limit: 50,
        });
        if (isMounted) {
          setPayments(response.results);
          setTotalCount(response.count);
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadPayments();
    return () => {
      isMounted = false;
    };
  }, [search, status]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 border-b border-border pb-5">
        <h1 className="font-heading text-3xl font-semibold">Payments</h1>
        <p className="mt-2 text-sm text-muted-foreground">Review Stripe payment records, receipts, and failed charges.</p>
      </div>

      <div className="mb-5 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name, email, or payment intent..."
            className="pl-10"
          />
        </div>
        <Select value={status} onValueChange={(value) => setStatus(value as typeof status)}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="succeeded">Succeeded</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="refunded">Refunded</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Plan</TableHead>
              <TableHead>Payment Intent</TableHead>
              <TableHead>Created</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="w-16"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading payments...</p>
                </TableCell>
              </TableRow>
            ) : payments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-12 text-center text-sm text-muted-foreground">
                  No payments found
                </TableCell>
              </TableRow>
            ) : (
              payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell>
                    <p className="font-medium">{payment.user_name}</p>
                    <p className="text-xs text-muted-foreground">{payment.user_email}</p>
                  </TableCell>
                  <TableCell>
                    <Badge variant={statusVariant[payment.status]}>{payment.status}</Badge>
                  </TableCell>
                  <TableCell className="capitalize">{payment.package_tier}</TableCell>
                  <TableCell className="max-w-[220px] truncate font-mono text-xs">
                    {payment.stripe_payment_intent_id}
                  </TableCell>
                  <TableCell>{format(new Date(payment.created_at), 'MMM d, yyyy h:mm a')}</TableCell>
                  <TableCell className="text-right font-semibold">{payment.amount_display}</TableCell>
                  <TableCell>
                    {payment.receipt_url && (
                      <Button asChild variant="ghost" size="icon">
                        <a href={payment.receipt_url} target="_blank" rel="noreferrer" aria-label="Open receipt">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <p className="mt-4 text-center text-xs text-muted-foreground">
        Showing {payments.length} of {totalCount} payment records
      </p>
    </main>
  );
}

export default function AdminPaymentsPage() {
  return (
    <AdminRoute>
      <AdminPaymentsContent />
    </AdminRoute>
  );
}
