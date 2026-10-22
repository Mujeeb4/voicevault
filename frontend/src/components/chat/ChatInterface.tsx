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
import { PersonAvatar } from '@/components/ui/person-avatar';
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
    useChatStore.getState().reset();
    setIsLoading(true);
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
    return () => { useChatStore.getState().reset(); };
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
          <p className="text-sm text-muted-foreground">Loading conversation…</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b bg-background">
        <div className="flex items-center gap-3">
          <PersonAvatar name={aiOwnerName} size="md" />
          <div>
            <h1 className="text-lg font-semibold leading-tight text-foreground">{aiOwnerName}</h1>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              {voiceEnabled ? 'Replies in their voice' : 'Text replies · voice with Premium'}
            </p>
          </div>
        </div>

        {/* Status Indicators */}
        <div className="flex items-center gap-2">
          {isStreaming && (
            <div className="flex items-center gap-2 text-sm text-primary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Thinking…</span>
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
        <Alert className="mx-4 mt-3 border-primary/30 bg-accent py-2.5">
          <Lock className="h-4 w-4" />
          <AlertDescription>
            Voice replies unlock with Premium. Text chat works until the free message limit.
          </AlertDescription>
        </Alert>
      )}

      {/* Messages */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 p-4">
        <div className="space-y-4">
          {conversations.length === 0 && !isStreaming ? (
            <div className="flex flex-col items-center justify-center py-4 text-center">
              <PersonAvatar name={aiOwnerName} size="lg" ring />
              <h2 className="mt-3 text-xl font-semibold text-foreground">
                Ask {aiOwnerName} anything
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Answers come from their own recorded stories and the way they speak. Start with a question below, or write your own.
              </p>
              <div className="mt-4 flex max-w-xl flex-wrap justify-center gap-2">
                {[
                  'What was your childhood like?',
                  'What advice would you give me?',
                  'How did you meet the love of your life?',
                  'What are you most proud of?',
                ].map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => handleSend(q)}
                    disabled={isStreaming || !!error}
                    className="min-h-11 rounded-full border border-border bg-card px-4 py-2 text-sm text-foreground shadow-card transition hover:border-primary/40 hover:bg-accent disabled:opacity-50"
                  >
                    {q}
                  </button>
                ))}
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
          placeholder={`Ask ${aiOwnerName} a question…`}
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
