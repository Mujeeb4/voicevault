'use client';

/**
 * Family Management Page (AI Owner Only)
 * Manage family member invitations and access
 * Following .cursorrules and Django schema
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { useFamilyStore } from '@/store/family';
import { InviteFamilyDialog } from '@/components/family/InviteFamilyDialog';
import { FamilyMemberCard } from '@/components/family/FamilyMemberCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Search, Users, UserPlus, Info, Lock } from 'lucide-react';
function FamilyManagementContent() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { familyMembers, loadFamilyMembers, isLoading, error } = useFamilyStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'accepted' | 'pending'>('all');

  useEffect(() => {
    loadFamilyMembers();
  }, [loadFamilyMembers]);

  // Filter members
  const filteredMembers = familyMembers.filter((member) => {
    // Search filter
    const matchesSearch =
      member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.relationship.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Tab filter
    if (activeTab === 'accepted') {
      return !!member.invitation_accepted_at;
    }
    if (activeTab === 'pending') {
      return !member.invitation_accepted_at;
    }
    return true; // 'all'
  });

  const acceptedCount = familyMembers.filter((m) => !!m.invitation_accepted_at).length;
  const pendingCount = familyMembers.filter((m) => !m.invitation_accepted_at).length;
  const isPremium = !!(user?.is_premium || user?.payment_completed || user?.plan_type === 'premium');
  const inviteLimit = user?.usage_quota?.limits.family_members ?? (isPremium ? 10 : 1);

  if (isLoading && familyMembers.length === 0) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">Loading family members...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-8 flex flex-col items-start justify-between gap-4 rounded-lg border border-border bg-card/55 p-5 sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-semibold uppercase text-primary/85">Family access</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold text-foreground sm:text-4xl">Family Management</h1>
          <p className="mt-1 text-muted-foreground">
            {familyMembers.length} of {inviteLimit} family invitations used
          </p>
        </div>
        <InviteFamilyDialog />
      </div>

      {/* Security Notice */}
      <Alert className="mb-6 border-primary/25 bg-primary/10">
        <Lock className="h-4 w-4 text-primary" />
        <AlertDescription className="text-foreground">
          <strong>Access Control:</strong> Family members can only chat with your AI. They cannot modify your voice,
          personality, or settings. You can revoke access at any time.
        </AlertDescription>
      </Alert>

      {/* Search & Filter */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search by name, email, or relationship..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as typeof activeTab)} className="space-y-6">
        <TabsList>
          <TabsTrigger value="all">
            All ({familyMembers.length})
          </TabsTrigger>
          <TabsTrigger value="accepted">
            Accepted ({acceptedCount})
          </TabsTrigger>
          <TabsTrigger value="pending">
            Pending ({pendingCount})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Users className="h-16 w-16 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {searchQuery
                  ? 'No members found'
                  : activeTab === 'pending'
                    ? 'No pending invitations'
                    : activeTab === 'accepted'
                      ? 'No accepted members yet'
                      : 'No family members yet'}
              </h3>
              <p className="text-muted-foreground mb-6 max-w-md">
                {searchQuery
                  ? 'Try adjusting your search query'
                  : 'Invite family members to share your AI personality with them. They&apos;ll be able to chat and create memories.'}
              </p>
              {!searchQuery && (
                <InviteFamilyDialog
                  trigger={
                    <Button>
                      <UserPlus className="mr-2 h-4 w-4" />
                      Invite Your First Member
                    </Button>
                  }
                />
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMembers.map((member) => (
                <FamilyMemberCard
                  key={member.id}
                  member={member}
                  onViewConversations={(memberId) => {
                    router.push(`/conversations?member=${memberId}`);
                  }}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      {familyMembers.length > 0 && (
        <Alert className="mt-8 border-primary/25 bg-primary/10">
          <Info className="h-4 w-4 text-primary" />
          <AlertDescription className="text-sm text-foreground">
            <strong>Tip:</strong> Pending invitations will show until accepted. You can resend invitations if they
            expire or weren&apos;t received. Accepted members can start chatting with your AI immediately.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

export default function FamilyManagementPage() {
  return <FamilyManagementContent />;
}
