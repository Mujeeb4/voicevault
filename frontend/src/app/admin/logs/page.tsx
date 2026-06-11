'use client';

import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle, ClipboardList, Loader2 } from 'lucide-react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { adminApi } from '@/lib/api/admin';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { AdminLogEntry } from '@/types';

function AdminLogsContent() {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [type, setType] = useState<'failures' | 'audit'>('failures');

  useEffect(() => {
    let isMounted = true;

    async function loadLogs() {
      setIsLoading(true);
      try {
        const response = await adminApi.getLogs({ type, limit: 100 });
        if (isMounted) setLogs(response.results);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    }

    loadLogs();
    return () => {
      isMounted = false;
    };
  }, [type]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-primary">
            {type === 'failures' ? <AlertTriangle className="h-5 w-5" /> : <ClipboardList className="h-5 w-5" />}
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">Admin Logs</span>
          </div>
          <h1 className="font-heading text-3xl font-semibold">Logs</h1>
          <p className="mt-2 text-sm text-muted-foreground">Inspect failed processing, recording, API events, and admin audit actions.</p>
        </div>
        <Select value={type} onValueChange={(value) => setType(value as typeof type)}>
          <SelectTrigger className="w-full sm:w-[190px]">
            <SelectValue placeholder="Log type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="failures">Failed logs</SelectItem>
            <SelectItem value="audit">Audit trail</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-card/60">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Level</TableHead>
              <TableHead>Source</TableHead>
              <TableHead>Message</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Context</TableHead>
              <TableHead className="text-right">When</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" />
                  <p className="mt-2 text-sm text-muted-foreground">Loading logs...</p>
                </TableCell>
              </TableRow>
            ) : logs.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center text-sm text-muted-foreground">
                  No logs found
                </TableCell>
              </TableRow>
            ) : (
              logs.map((entry) => (
                <TableRow key={`${entry.source}-${entry.id}`}>
                  <TableCell>
                    <Badge variant={entry.level === 'error' ? 'error' : entry.level === 'warning' ? 'warning' : 'secondary'}>
                      {entry.level}
                    </Badge>
                  </TableCell>
                  <TableCell className="capitalize">{entry.source}</TableCell>
                  <TableCell className="max-w-[420px]">
                    <p className="line-clamp-2 text-sm">{entry.message}</p>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{entry.user_email ?? '-'}</TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">{entry.context || '-'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs text-muted-foreground">
                    {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </main>
  );
}

export default function AdminLogsPage() {
  return (
    <AdminRoute>
      <AdminLogsContent />
    </AdminRoute>
  );
}
