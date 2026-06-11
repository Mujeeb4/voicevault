'use client';

/**
 * Chat Message Component
 * Displays user and AI messages with voice playback
 * Following .cursorrules patterns
 */

import React, { useState, useEffect } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Copy, Star, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { StreamingText } from './StreamingText';
import { VoicePlayerComponent } from './VoicePlayerComponent';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useChatStore } from '@/store/chat';
import { toast } from 'sonner';
import type { Conversation } from '@/types';

interface ChatMessageProps {
  conversation: Conversation;
  isUser: boolean;
  isStreaming?: boolean;
  streamingText?: string;
  showAvatar?: boolean;
  onRate?: (rating: number, feedback?: string) => void;
}

export const ChatMessage: React.FC<ChatMessageProps> = ({
  conversation,
  isUser,
  isStreaming = false,
  streamingText = '',
  showAvatar = true,
  onRate,
}) => {
  const { rateConversation, processingAudioIds } = useChatStore();
  const [rating, setRating] = useState(conversation.user_rating || 0);
  const [feedback, setFeedback] = useState(conversation.user_feedback || '');
  const [isRatingDialogOpen, setIsRatingDialogOpen] = useState(false);

  const displayText = isStreaming ? streamingText : conversation.response_text;
  // Use useEffect to format date on client to avoid hydration mismatch
  const [messageTime, setMessageTime] = useState('');

  const isProcessingAudio = processingAudioIds.includes(conversation.id);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setMessageTime(format(new Date(conversation.created_at), 'h:mm a'));
    }
  }, [conversation.created_at]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayText);
      toast.success('Message copied to clipboard!');
    } catch {
      toast.error('Failed to copy message');
    }
  };

  const handleQuickRate = (value: number) => {
    setRating(value);
    rateConversation(conversation.id, value);
    toast.success(`Rated ${value} star${value > 1 ? 's' : ''}!`);
  };

  const handleDetailedRating = async () => {
    try {
      await rateConversation(conversation.id, rating, feedback);
      toast.success('Thank you for your feedback!');
      setIsRatingDialogOpen(false);
      onRate?.(rating, feedback);
    } catch {
      toast.error('Failed to save rating');
    }
  };

  return (
    <div
      className={cn(
        'flex gap-3 p-4 rounded-lg transition-colors',
        isUser ? 'flex-row-reverse bg-primary/5' : 'bg-muted/30'
      )}
    >
      {/* Avatar */}
      {showAvatar && (
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className={cn(isUser ? 'bg-primary text-primary-foreground' : 'bg-secondary')}>
            {isUser
              ? conversation.family_member?.full_name?.charAt(0) || 'U'
              : conversation.ai_owner?.full_name?.charAt(0) || 'AI'}
          </AvatarFallback>
        </Avatar>
      )}

      {/* Message Content */}
      <div className={cn('flex-1 space-y-2', isUser ? 'items-end' : 'items-start')}>
        {/* Header */}
        <div className={cn('flex items-center gap-2', isUser && 'justify-end')}>
          <span className="font-semibold text-sm">
            {isUser ? conversation.family_member?.full_name || 'You' : conversation.ai_owner?.full_name || 'AI'}
          </span>
          <span className="text-xs text-muted-foreground">{messageTime}</span>
        </div>

        {/* Message Text */}
        <div className={cn('text-sm leading-relaxed', isUser && 'text-right')}>
          {isUser ? (
            <p>{conversation.question_text}</p>
          ) : isStreaming ? (
            <StreamingText text={streamingText} isComplete={false} />
          ) : (
            <p>{displayText}</p>
          )}
        </div>

        {/* Voice Player or Loading Indicator (AI messages only) */}
        {!isUser && !isStreaming && (
          <div className="mt-2">
            {conversation.audio_url ? (
              <VoicePlayerComponent
                audioUrl={conversation.audio_url}
                conversationId={conversation.id}
                showControls={true}
              />
            ) : isProcessingAudio ? (
              <div className="flex items-center gap-2 p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground animate-pulse border border-border/50">
                <Loader2 className="h-3 w-3 animate-spin text-primary" />
                <span className="font-medium">Generating voice...</span>
              </div>
            ) : null}
          </div>
        )}

        {/* Actions */}
        {!isUser && !isStreaming && (
          <div className="flex items-center gap-2 mt-2">
            <Button variant="ghost" size="icon" onClick={handleCopy} className="h-8 w-8" aria-label="Copy message">
              <Copy className="h-3 w-3" />
            </Button>

            {/* Quick Rating */}
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Button
                  key={star}
                  variant="ghost"
                  size="icon"
                  onClick={() => handleQuickRate(star)}
                  className={cn('h-8 w-8', rating >= star && 'text-yellow-500')}
                  aria-label={`Rate ${star} stars`}
                >
                  <Star className={cn('h-3 w-3', rating >= star && 'fill-current')} />
                </Button>
              ))}
            </div>

            {/* Detailed Feedback */}
            <Dialog open={isRatingDialogOpen} onOpenChange={setIsRatingDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 text-xs">
                  Add Feedback
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Rate This Response</DialogTitle>
                  <DialogDescription>
                    Help us improve by sharing your thoughts on this AI response.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  {/* Star Rating */}
                  <div className="space-y-2">
                    <Label>Rating</Label>
                    <div className="flex items-center gap-2">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Button
                          key={star}
                          variant="outline"
                          size="icon"
                          onClick={() => setRating(star)}
                          className={cn('h-10 w-10', rating >= star && 'bg-yellow-500 text-white border-yellow-500')}
                        >
                          <Star className={cn('h-5 w-5', rating >= star && 'fill-current')} />
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Feedback */}
                  <div className="space-y-2">
                    <Label htmlFor="feedback">Feedback (Optional)</Label>
                    <Textarea
                      id="feedback"
                      placeholder="Tell us what you think..."
                      value={feedback}
                      onChange={(e) => setFeedback(e.target.value)}
                      rows={4}
                      maxLength={500}
                    />
                    <p className="text-xs text-muted-foreground text-right">{feedback.length}/500</p>
                  </div>

                  <Button onClick={handleDetailedRating} className="w-full" disabled={rating === 0}>
                    Submit Rating
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </div>
  );
};
