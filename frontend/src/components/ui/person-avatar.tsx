import * as React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-10 w-10 text-sm',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-20 w-20 text-3xl',
} as const;

interface PersonAvatarProps {
  name?: string | null;
  /** Optional photo. Falls back to initials when missing or broken. */
  src?: string | null;
  size?: keyof typeof sizes;
  /** "solid" is for the signed-in user, "soft" for other people. */
  tone?: 'solid' | 'soft';
  ring?: boolean;
  className?: string;
}

export function PersonAvatar({
  name,
  src,
  size = 'md',
  tone = 'soft',
  ring = false,
  className,
}: PersonAvatarProps) {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <Avatar className={cn(sizes[size], ring && 'ring-4 ring-primary/10', className)}>
      {src ? <AvatarImage src={src} alt={name ? `${name}` : ''} /> : null}
      <AvatarFallback
        className={cn(
          'font-heading font-semibold',
          tone === 'solid' ? 'bg-primary text-primary-foreground' : 'bg-accent text-primary'
        )}
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
