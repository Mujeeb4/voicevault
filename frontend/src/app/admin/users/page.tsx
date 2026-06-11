'use client';

/**
 * Admin Users Management Page
 * View and manage all users
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import { AdminRoute } from '@/components/admin/AdminRoute';
import { useAdminStore } from '@/store/admin';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Search, Loader2, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';

function AdminUsersContent() {
  const router = useRouter();
  const { users, isLoadingUsers, usersTotalCount, loadUsers } = useAdminStore();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');

  useEffect(() => {
    loadUsers({ search: searchQuery, status: statusFilter });
  }, [loadUsers, searchQuery, statusFilter]);

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">User Management</h1>
        <p className="text-muted-foreground mt-1">View and manage all system users</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={(val) => setStatusFilter(val as typeof statusFilter)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Users</SelectItem>
            <SelectItem value="completed">AI Ready</SelectItem>
            <SelectItem value="processing">Processing</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Users Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Signed Up</TableHead>
              <TableHead>Recording</TableHead>
              <TableHead>AI Status</TableHead>
              <TableHead>Family</TableHead>
              <TableHead className="w-20"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoadingUsers ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <p className="text-muted-foreground mt-2">Loading users...</p>
                </TableCell>
              </TableRow>
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No users found
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.full_name}</TableCell>
                  <TableCell>{user.email}</TableCell>
                  <TableCell>{format(new Date(user.created_at), 'MMM d, yyyy')}</TableCell>
                  <TableCell>
                    <Badge variant={user.recording_completed ? 'default' : 'secondary'}>
                      {user.recording_completed ? 'Complete' : 'Pending'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={user.ai_ready ? 'default' : user.ai_processing_started_at ? 'secondary' : 'outline'}
                      className={user.ai_ready ? 'bg-green-500' : ''}
                    >
                      {user.ai_ready ? 'Ready' : user.ai_processing_started_at ? 'Processing' : 'Not Started'}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.family_members_count || 0}</TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => router.push(`/admin/processing?user=${user.id}`)}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Info */}
      {users.length > 0 && (
        <p className="text-sm text-muted-foreground mt-4 text-center">
          Showing {users.length} of {usersTotalCount} users
        </p>
      )}
    </div>
  );
}

export default function AdminUsersPage() {
  return (
    <AdminRoute>
      <AdminUsersContent />
    </AdminRoute>
  );
}

