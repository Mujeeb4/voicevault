'use client';

/**
 * Chat Interface Component
 * Main chat UI with SSE streaming and voice playback
 * Following .cursorrules patterns and CIA Triad (Confidentiality, Integrity, Availability)
 */

import React, { useEffect, useRef } from 'react';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { Loader2, AlertCircle, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { chatApi } from '@/lib/api/chat';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';

interface ChatInterfaceProps {
  aiOwnerId: string;
  familyMemberId: string;
  aiOwnerName: string;
  voiceEnabled?: boolean;
  className?: string;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({
  aiOwnerId,
  familyMemberId,
  aiOwnerName,
  voiceEnabled = true,
  className,
}) => {
  const {
    conversations,
    isStreaming,
    streamingText,
    error,
    setAIOwner,
    setFamilyMember,
    loadConversations,
    sendMessage,
    clearError,
    stopStreaming,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = React.useState(true);

  // Initialize chat
  useEffect(() => {
    setAIOwner(aiOwnerId);
    setFamilyMember(familyMemberId);

    // Load conversation history
    loadConversations()
      .catch(() => {
        console.error('Failed to load conversations');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [aiOwnerId, familyMemberId, setAIOwner, setFamilyMember, loadConversations]);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [conversations, streamingText]);

  const handleSend = async (message: string) => {
    try {
      await sendMessage(message);
    } catch {
      console.error('Failed to send message');
    }
  };

  const handleSendVoice = async (audioBlob: Blob) => {
    try {
      // Transcribe voice input
      const { transcript } = await chatApi.transcribeVoice(audioBlob);
      
      // Send transcribed text as message
      await sendMessage(transcript);
    } catch (err) {
      console.error('Failed to send voice message');
      throw err; // Re-throw to show error in ChatInput
    }
  };

  const handleRetry = () => {
    clearError();
  };

  if (isLoading) {
    return (
      <div className={cn('flex items-center justify-center h-full', className)}>
        <div className="flex flex-col items-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div>
          <h2 className="text-xl font-bold text-foreground">Chat with {aiOwnerName}</h2>
          <p className="text-sm text-muted-foreground">
            {voiceEnabled ? 'Voice responses enabled' : 'Text chat only on Memory Starter'}
          </p>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>AI is responding...</span>
            </div>
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Alert variant="destructive" className="m-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>{error}</span>
            <Button variant="outline" size="sm" onClick={handleRetry}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {!voiceEnabled && (
        <Alert className="m-4 border-primary/30 bg-primary/5">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Voice input and voice responses unlock with VoiceVault Premium. This vault can still use text chat until the free message limit is reached.
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {conversations.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="space-y-2">
                <h3 className="text-lg font-semibold text-foreground">Start a Conversation</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  Ask {aiOwnerName} anything! They&apos;ll respond with their unique voice and personality.
                </p>
              </div>
            </div>
          ) : (
            <>
              {/* Render conversations in reverse order (newest first) */}
              {[...conversations].reverse().map((conversation) => (
                <React.Fragment key={conversation.id}>
                  {/* User Message */}
                  <ChatMessage conversation={conversation} isUser={true} showAvatar={true} />

                  {/* AI Response */}
                  <ChatMessage conversation={conversation} isUser={false} showAvatar={true} />

                  <Separator />
                </React.Fragment>
              ))}

              {/* Streaming Message */}
              {isStreaming && streamingText && (
                <ChatMessage
                  conversation={{
                    id: 'streaming',
                    ai_owner: { id: aiOwnerId, full_name: aiOwnerName },
                    family_member: { id: familyMemberId, full_name: '' },
                    question_text: '',
                    response_text: streamingText,
                    created_at: new Date().toISOString(),
                    response_time_ms: 0,
                  }}
                  isUser={false}
                  isStreaming={true}
                  streamingText={streamingText}
                  showAvatar={true}
                />
              )}
            </>
          )}

          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="p-4 border-t bg-background">
        <ChatInput
          onSend={handleSend}
          onSendVoice={voiceEnabled ? handleSendVoice : undefined}
          isStreaming={isStreaming}
          maxLength={500}
          placeholder={`Ask ${aiOwnerName} a question...`}
          disabled={!!error}
        />
      </div>

      {/* Stop Streaming Button */}
      {isStreaming && (
        <div className="absolute bottom-20 left-1/2 transform -translate-x-1/2">
          <Button variant="destructive" size="sm" onClick={stopStreaming}>
            Stop Generating
          </Button>
        </div>
      )}
    </div>
  );
};
