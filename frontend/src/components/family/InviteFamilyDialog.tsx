'use client';

/**
 * Invite Family Member Dialog
 * AI Owner can invite family members with relationship
 * Following .cursorrules patterns
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, Copy, Check, AlertCircle, ExternalLink } from 'lucide-react';
import { useFamilyStore } from '@/store/family';
import type { RelationshipType } from '@/types';
import { toast } from 'sonner';

interface InviteFamilyDialogProps {
  trigger?: React.ReactNode;
}

const relationshipOptions: Array<{ value: RelationshipType; label: string }> = [
  { value: 'spouse', label: 'Spouse / Partner' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'friend', label: 'Friend' },
];

export const InviteFamilyDialog: React.FC<InviteFamilyDialogProps> = ({ trigger }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [relationship, setRelationship] = useState<RelationshipType>('friend');
  const [message, setMessage] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const { inviteMember, isLoading, lastInvitation, error } = useFamilyStore();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!email || !fullName || !relationship) {
      toast.error('Please fill in all required fields');
      return;
    }

    const response = await inviteMember({
      email,
      full_name: fullName,
      relationship,
      message: message || undefined,
    });

    if (response) {
      // Success - show invitation link
      toast.success('Invitation created successfully!');
    }
  };

  const handleCopyLink = async () => {
    if (!lastInvitation) return;

    try {
      await navigator.clipboard.writeText(lastInvitation.invitation_link);
      setIsCopied(true);
      toast.success('Invitation link copied!');
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy link');
    }
  };

  const handleReset = () => {
    setEmail('');
    setFullName('');
    setRelationship('friend');
    setMessage('');
    setIsCopied(false);
    useFamilyStore.setState({ lastInvitation: null, error: null });
  };

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(handleReset, 300); // Reset after dialog closes
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <UserPlus className="mr-2 h-4 w-4" />
            Invite Family Member
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Invite Family Member</DialogTitle>
          <DialogDescription>
            Share your AI personality with a loved one. They&apos;ll be able to chat with your AI.
          </DialogDescription>
        </DialogHeader>

        {!lastInvitation ? (
          // Step 1: Invitation Form
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email">Email Address *</Label>
              <Input
                id="email"
                type="email"
                placeholder="family@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Full Name */}
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name *</Label>
              <Input
                id="fullName"
                type="text"
                placeholder="John Doe"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>

            {/* Relationship */}
            <div className="space-y-2">
              <Label htmlFor="relationship">Relationship *</Label>
              <Select value={relationship} onValueChange={(val) => setRelationship(val as RelationshipType)}>
                <SelectTrigger id="relationship" disabled={isLoading}>
                  <SelectValue placeholder="Select relationship..." />
                </SelectTrigger>
                <SelectContent>
                  {relationshipOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Personal Message (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="message">Personal Message (Optional)</Label>
              <Textarea
                id="message"
                placeholder="I'd love for you to chat with my AI..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                maxLength={500}
                disabled={isLoading}
              />
              <p className="text-xs text-muted-foreground text-right">{message.length}/500</p>
            </div>

            {/* Error Alert */}
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Submit */}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isLoading}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Sending...' : 'Send Invitation'}
              </Button>
            </DialogFooter>
          </form>
        ) : (
          // Step 2: Invitation Link
          <div className="space-y-4">
            <Alert className="bg-green-50 border-green-200">
              <Check className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                <strong>Invitation sent!</strong> Share the link below with {fullName}.
              </AlertDescription>
            </Alert>

            {/* Invitation Link */}
            <div className="space-y-2">
              <Label>Invitation Link</Label>
              <div className="flex gap-2">
                <Input
                  value={lastInvitation.invitation_link}
                  readOnly
                  className="font-mono text-sm"
                  onClick={(e) => (e.target as HTMLInputElement).select()}
                />
                <Button variant="outline" size="icon" onClick={handleCopyLink}>
                  {isCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                This link expires on {new Date(lastInvitation.expires_at).toLocaleDateString()}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => window.open(`mailto:${email}?subject=VoiceVault Invitation&body=Click here to accept: ${lastInvitation.invitation_link}`)}
              >
                <ExternalLink className="mr-2 h-4 w-4" />
                Email Link
              </Button>
              <Button variant="default" className="flex-1" onClick={handleClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

