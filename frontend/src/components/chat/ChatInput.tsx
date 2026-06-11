'use client';

/**
 * Chat Input Component
 * Message input with validation and security
 * Following .cursorrules and CIA Triad (Confidentiality, Integrity, Availability)
 */

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send, Loader2, Mic, MicOff } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { AudioRecorder } from '@/lib/audio/recorder';

interface ChatInputProps {
  onSend: (message: string) => void;
  onSendVoice?: (audioBlob: Blob) => Promise<void>;  // New: Voice input handler
  isStreaming: boolean;
  maxLength?: number;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export const ChatInput: React.FC<ChatInputProps> = ({
  onSend,
  onSendVoice,
  isStreaming,
  maxLength = 500,
  placeholder = 'Type your message...',
  disabled = false,
  className,
}) => {
  const [message, setMessage] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const audioRecorderRef = useRef<AudioRecorder | null>(null);

  // Auto-focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [message]);

  const handleSend = () => {
    // Validation (Integrity - CIA)
    const trimmedMessage = message.trim();

    if (trimmedMessage.length === 0) {
      toast.error('Please enter a message');
      return;
    }

    if (trimmedMessage.length > maxLength) {
      toast.error(`Message too long (max ${maxLength} characters)`);
      return;
    }

    // Sanitize input (Security - CIA)
    const sanitizedMessage = trimmedMessage
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
      .replace(/<[^>]+>/g, ''); // Remove HTML tags

    if (sanitizedMessage.length === 0) {
      toast.error('Invalid message content');
      return;
    }

    // Send message
    onSend(sanitizedMessage);
    setMessage('');

    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Send on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleStartRecording = async () => {
    if (!onSendVoice) {
      toast.error('Voice input not available');
      return;
    }

    try {
      const recorder = new AudioRecorder();
      await recorder.initialize();
      recorder.start();
      audioRecorderRef.current = recorder;
      setIsRecording(true);
      toast.info('Recording... Click again to stop');
    } catch {
      toast.error('Failed to start recording. Please check microphone permissions.');
      console.error('Recording error');
    }
  };

  const handleStopRecording = async () => {
    if (!audioRecorderRef.current || !onSendVoice) return;

    try {
      setIsRecording(false);
      setIsTranscribing(true);
      
      const result = await audioRecorderRef.current.stop();
      audioRecorderRef.current.cleanup();
      audioRecorderRef.current = null;

      // Send voice blob for transcription
      await onSendVoice(result.blob);
      
      setIsTranscribing(false);
      toast.success('Voice message sent!');
    } catch {
      setIsTranscribing(false);
      toast.error('Failed to process voice recording');
      console.error('Stop recording error');
    }
  };

  const handleToggleRecording = () => {
    if (isRecording) {
      handleStopRecording();
    } else {
      handleStartRecording();
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioRecorderRef.current) {
        audioRecorderRef.current.cleanup();
      }
    };
  }, []);

  const remainingChars = maxLength - message.length;
  const isNearLimit = remainingChars < 50;
  const isAtLimit = remainingChars === 0;

  return (
    <div className={cn('space-y-2', className)}>
      <div
        className={cn(
          'relative flex items-end gap-2 p-2 rounded-lg border transition-colors',
          isFocused ? 'border-primary bg-background' : 'border-border bg-muted/30',
          disabled && 'opacity-50 cursor-not-allowed'
        )}
      >
        {/* Voice Recording Button */}
        {onSendVoice && (
          <Button
            onClick={handleToggleRecording}
            disabled={disabled || isStreaming || isTranscribing}
            size="icon"
            variant={isRecording ? 'destructive' : 'outline'}
            className="h-10 w-10 flex-shrink-0"
            aria-label={isRecording ? 'Stop recording' : 'Start voice recording'}
          >
            {isTranscribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Textarea */}
        <Textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          disabled={disabled || isStreaming || isRecording || isTranscribing}
          rows={1}
          maxLength={maxLength}
          className="flex-1 min-h-[40px] max-h-[200px] resize-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
          aria-label="Message input"
        />

        {/* Send Button */}
        <Button
          onClick={handleSend}
          disabled={disabled || isStreaming || message.trim().length === 0 || isRecording || isTranscribing}
          size="icon"
          className="h-10 w-10 flex-shrink-0"
          aria-label="Send message"
        >
          {isStreaming ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </div>

      {/* Character Count */}
      <div className="flex items-center justify-between px-2">
        <span className="text-xs text-muted-foreground">
          {isRecording
            ? 'Recording... Click microphone to stop'
            : isTranscribing
              ? 'Transcribing voice...'
              : isStreaming
                ? 'AI is responding...'
                : 'Press Enter to send, Shift+Enter for new line'}
        </span>
        <span
          className={cn(
            'text-xs',
            isAtLimit ? 'text-destructive font-semibold' : isNearLimit ? 'text-warning' : 'text-muted-foreground'
          )}
        >
          {remainingChars} chars left
        </span>
      </div>
    </div>
  );
};
