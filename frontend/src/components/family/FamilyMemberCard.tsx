'use client';

/**
 * Family Member Card Component
 * Displays individual family member with actions
 * Following .cursorrules patterns
 */

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { MoreVertical, Mail, Send, Trash2, Check, Clock, XCircle, MessageSquare } from 'lucide-react';
import { format } from 'date-fns';
import type { FamilyMember } from '@/types';
import { useFamilyStore } from '@/store/family';
import { cn } from '@/lib/utils';

interface FamilyMemberCardProps {
  member: FamilyMember;
  onViewConversations?: (memberId: string) => void;
}

export const FamilyMemberCard: React.FC<FamilyMemberCardProps> = ({ member, onViewConversations }) => {
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);
  const { removeMember, resendInvitation, isLoading } = useFamilyStore();

  const isAccepted = !!member.invitation_accepted_at;
  const isPending = !isAccepted;

  const handleRemove = async () => {
    try {
      await removeMember(member.id);
      setIsRemoveDialogOpen(false);
    } catch {
      // Error handled in store
    }
  };

  const handleResend = async () => {
    try {
      await resendInvitation(member.id);
    } catch {
      // Error handled in store
    }
  };

  const getStatusBadge = () => {
    if (isAccepted) {
      return (
        <Badge variant="default" className="bg-green-500">
          <Check className="mr-1 h-3 w-3" />
          Accepted
        </Badge>
      );
    }
    return (
      <Badge variant="secondary">
        <Clock className="mr-1 h-3 w-3" />
        Pending
      </Badge>
    );
  };

  const getRelationshipLabel = (rel: string) => {
    const labels: Record<string, string> = {
      spouse: 'Spouse',
      child: 'Child',
      parent: 'Parent',
      sibling: 'Sibling',
      friend: 'Friend',
    };
    return labels[rel] || rel;
  };

  return (
    <>
      <Card className={cn('transition-all hover:shadow-md', isPending && 'border-yellow-200 bg-yellow-50/30')}>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="flex items-center space-x-3">
            <Avatar>
              <AvatarFallback>
                {member.full_name ? member.full_name.charAt(0).toUpperCase() : member.email.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <CardTitle className="text-base">{member.full_name || 'Pending'}</CardTitle>
              <CardDescription className="flex items-center gap-2 mt-1">
                <Mail className="h-3 w-3" />
                {member.email}
              </CardDescription>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" disabled={isLoading}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              
              {isPending && (
                <DropdownMenuItem onClick={handleResend}>
                  <Send className="mr-2 h-4 w-4" />
                  Resend Invitation
                </DropdownMenuItem>
              )}
              
              {isAccepted && member.conversation_count > 0 && (
                <DropdownMenuItem onClick={() => onViewConversations?.(member.id)}>
                  <MessageSquare className="mr-2 h-4 w-4" />
                  View Conversations ({member.conversation_count})
                </DropdownMenuItem>
              )}
              
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive" onClick={() => setIsRemoveDialogOpen(true)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Remove Member
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </CardHeader>

        <CardContent>
          <div className="flex flex-wrap items-center gap-2">
            {getStatusBadge()}
            <Badge variant="outline">{getRelationshipLabel(member.relationship)}</Badge>
            {!member.has_access && (
              <Badge variant="error" className="flex items-center gap-1">
                <XCircle className="h-3 w-3" />
                No Access
              </Badge>
            )}
          </div>

          {/* Stats */}
          <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Invited</p>
              <p className="font-medium">{format(new Date(member.invitation_sent_at), 'MMM d, yyyy')}</p>
            </div>
            {isAccepted ? (
              <div>
                <p className="text-muted-foreground">Conversations</p>
                <p className="font-medium">{member.conversation_count}</p>
              </div>
            ) : (
              <div>
                <p className="text-muted-foreground">Status</p>
                <p className="font-medium text-yellow-600">Awaiting Response</p>
              </div>
            )}
          </div>

          {member.last_conversation_at && (
            <p className="mt-3 text-xs text-muted-foreground">
              Last chat: {format(new Date(member.last_conversation_at), 'MMM d, yyyy h:mm a')}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Remove Confirmation Dialog */}
      <AlertDialog open={isRemoveDialogOpen} onOpenChange={setIsRemoveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Family Member?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove <strong>{member.full_name || member.email}</strong>? They will no longer
              be able to chat with your AI.
              {member.conversation_count > 0 && (
                <span className="block mt-2 text-yellow-600">
                  ⚠️ They have {member.conversation_count} conversation{member.conversation_count > 1 ? 's' : ''} that
                  will be preserved.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemove} className="bg-destructive text-destructive-foreground">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

