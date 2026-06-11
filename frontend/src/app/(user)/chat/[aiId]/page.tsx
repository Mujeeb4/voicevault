'use client';

/**
 * Dynamic Chat Page for Family AIs
 * Chat with a specific AI owner's personality
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatInterface } from '@/components/chat/ChatInterface';
import { useAuthStore } from '@/store/auth';
import { familyApi } from '@/lib/api/family';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, AlertCircle, ArrowLeft } from 'lucide-react';

interface AIOwnerInfo {
    id: string;
    full_name: string;
    ai_ready: boolean;
    relationship: string;
    voice_enabled?: boolean;
}

export default function ChatWithAIPage({
    params,
}: {
    params: Promise<{ aiId: string }>;
}) {
    const { aiId } = React.use(params);
    const router = useRouter();
    const { user } = useAuthStore();

    const [aiOwner, setAIOwner] = useState<AIOwnerInfo | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const loadAIDetails = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            // Get accessible AIs and find the one we're looking for
            const response = await familyApi.getAccessibleAIs();
            const ai = response.results.find((a) => a.id === aiId);

            if (!ai) {
                setError("You don't have access to this AI");
                return;
            }

            if (!ai.ai_ready) {
                setError("This AI is not ready yet");
                return;
            }

            setAIOwner(ai);
        } catch {
            setError('Failed to load AI details');
        } finally {
            setIsLoading(false);
        }
    }, [aiId]);

    useEffect(() => {
        loadAIDetails();
    }, [loadAIDetails]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-[60vh]">
                <div className="flex flex-col items-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Loading chat...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="max-w-md mx-auto mt-12">
                <CardHeader>
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-5 w-5" />
                        <CardTitle>Cannot Access Chat</CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <p className="text-muted-foreground">{error}</p>
                    <Button onClick={() => router.push('/dashboard')} variant="outline">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Dashboard
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (!aiOwner) {
        return null;
    }

    return (
        <div className="h-[calc(100vh-8rem)]">
            <div className="mb-4 flex items-center gap-4">
                <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard')}>
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back
                </Button>
                <div>
                    <h1 className="text-xl font-semibold">Chat with {aiOwner.full_name}&apos;s AI</h1>
                    <p className="text-sm text-muted-foreground capitalize">
                        Your {aiOwner.relationship}
                    </p>
                </div>
            </div>

            <ChatInterface
                aiOwnerId={aiOwner.id}
                familyMemberId={user?.id || ''}
                aiOwnerName={aiOwner.full_name}
                voiceEnabled={!!aiOwner.voice_enabled}
                className="h-[calc(100%-4rem)]"
            />
        </div>
    );
}
