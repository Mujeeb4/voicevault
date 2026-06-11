'use client';

/**
 * Streaming Text Component
 * Displays text with typewriter effect
 * Following .cursorrules patterns
 */

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface StreamingTextProps {
  text: string;
  isComplete: boolean;
  speed?: number; // milliseconds per character
  className?: string;
}

export const StreamingText: React.FC<StreamingTextProps> = ({
  text,
  isComplete,
  speed = 20,
  className,
}) => {
  const [displayedText, setDisplayedText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    if (isComplete) {
      // Show all text immediately when complete
      setDisplayedText(text);
      setCurrentIndex(text.length);
      return;
    }

    if (currentIndex < text.length) {
      const timeout = setTimeout(() => {
        setDisplayedText((prev) => prev + text[currentIndex]);
        setCurrentIndex((prev) => prev + 1);
      }, speed);

      return () => clearTimeout(timeout);
    }
    return undefined;
  }, [text, currentIndex, isComplete, speed]);

  // Reset when text changes (new message)
  useEffect(() => {
    if (text.length < displayedText.length) {
      setDisplayedText(text);
      setCurrentIndex(text.length);
    }
  }, [text, displayedText.length]);

  return (
    <div className={cn('text-foreground', className)}>
      {displayedText}
      {!isComplete && (
        <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" aria-hidden="true" />
      )}
    </div>
  );
};

