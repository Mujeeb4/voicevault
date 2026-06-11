'use client';

/**
 * Chat Page
 * Main chat interface with security (CIA Triad compliance)
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useAuthStore } from '@/store/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertCircle, MessageSquare, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import apiClient from '@/lib/api/client';

interface AccessibleAI {
  id: string;
  full_name: string;
  ai_ready: boolean;
  relationship: string;
  invitation_accepted_at: string | null;
  voice_enabled?: boolean;
}

const ChatPage: React.FC = () => {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [accessibleAIs, setAccessibleAIs] = useState<AccessibleAI[]>([]);
  const [selectedAIId, setSelectedAIId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Confidentiality: Check authentication (CIA Triad)
  useEffect(() => {
    if (!isAuthenticated || !user) {
      router.push('/login?redirect=/chat');
      return;
    }

    loadAccessibleAIs();
  }, [isAuthenticated, user, router]);

  /**
   * Load AIs that user has access to
   * Integrity: Only show AIs user is authorized to access (CIA Triad)
   * SECURITY: Family members can ONLY chat with AI owners who invited them
   */
  const loadAccessibleAIs = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Fetch family members where user has access
      // This endpoint returns ONLY AIs the user is explicitly granted access to
      const response = await apiClient.get<{ results: AccessibleAI[] }>('/family/accessible-ais/');

      // Filter only AIs that are ready AND invitation is accepted
      // SECURITY: Double-check has_access and invitation_accepted_at
      const results = response.data?.results ?? [];
      const readyAIs = results.filter((ai) => {
        return ai.ai_ready && ai.invitation_accepted_at !== null;
      });

      if (readyAIs.length === 0) {
        setError(
          'No AI personalities are available yet. You may need to accept an invitation or wait for processing to complete.'
        );
      } else {
        setAccessibleAIs(readyAIs);
        // Auto-select first AI if only one available
        if (readyAIs.length === 1) {
          setSelectedAIId(readyAIs[0].id);
        }
      }
    } catch {
      console.error('Failed to load accessible AIs');
      setError('Failed to load available AIs. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-lg text-muted-foreground">Loading chat...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <CardTitle>Unable to Access Chat</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
            <div className="flex gap-2">
              <Button onClick={loadAccessibleAIs} variant="outline">
                Retry
              </Button>
              <Button onClick={() => router.push('/dashboard')}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // If no AI selected, show selector
  if (!selectedAIId) {
    return (
      <div>
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              <CardTitle>Select an AI to Chat With</CardTitle>
            </div>
            <CardDescription>
              Choose which AI personality you&apos;d like to talk to
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="ai-select">Available AIs</Label>
              <Select value={selectedAIId || ''} onValueChange={setSelectedAIId}>
                <SelectTrigger id="ai-select">
                  <SelectValue placeholder="Select an AI..." />
                </SelectTrigger>
                <SelectContent>
                  {accessibleAIs.map((ai) => (
                    <SelectItem key={ai.id} value={ai.id}>
                      {ai.full_name} ({ai.relationship})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Security Notice */}
            <Alert>
              <Lock className="h-4 w-4" />
              <AlertDescription className="text-xs">
                <strong>Security Notice:</strong> All conversations are encrypted and stored securely.
                You can only chat with AI personalities where you&apos;ve accepted an invitation.
                You cannot modify their voice, personality, or settings.
              </AlertDescription>
            </Alert>

            <Button onClick={() => selectedAIId && router.push(`/chat?ai=${selectedAIId}`)} disabled={!selectedAIId}>
              Start Chatting
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const selectedAI = accessibleAIs.find((ai) => ai.id === selectedAIId);

  if (!selectedAI) {
    return null;
  }

  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface
        aiOwnerId={selectedAIId}
        familyMemberId={user?.id || ''}
        aiOwnerName={selectedAI.full_name}
        voiceEnabled={!!selectedAI.voice_enabled}
        className="h-full"
      />
    </div>
  );
};

export default ChatPage;
