'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

/** Deterministic pseudo-random bar heights so a given seed always looks the same. */
export function barHeights(count: number, seed = 7): number[] {
  let x = seed;
  return Array.from({ length: count }, (_, i) => {
    x = (x * 9301 + 49297) % 233280;
    const r = x / 233280;
    const envelope = 0.55 + 0.45 * Math.sin((i / count) * Math.PI);
    return Math.round(18 + r * 64 * envelope);
  });
}

interface WaveformProps {
  /** 0–1 playback progress. */
  progress?: number;
  bars?: number;
  seed?: number;
  /** Animate bars (e.g. while playing). */
  active?: boolean;
  /** Click or keyboard seek; receives 0–1. */
  onSeek?: (fraction: number) => void;
  className?: string;
  label?: string;
}

export function Waveform({
  progress = 0,
  bars = 48,
  seed = 7,
  active = false,
  onSeek,
  className,
  label = 'Audio waveform',
}: WaveformProps) {
  const heights = React.useMemo(() => barHeights(bars, seed), [bars, seed]);
  const ref = React.useRef<HTMLDivElement>(null);

  const seekFromEvent = (clientX: number) => {
    if (!onSeek || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    onSeek(Math.min(1, Math.max(0, (clientX - rect.left) / rect.width)));
  };

  return (
    <div
      ref={ref}
      role={onSeek ? 'slider' : 'img'}
      aria-label={label}
      aria-valuemin={onSeek ? 0 : undefined}
      aria-valuemax={onSeek ? 100 : undefined}
      aria-valuenow={onSeek ? Math.round(progress * 100) : undefined}
      tabIndex={onSeek ? 0 : -1}
      onClick={(e) => seekFromEvent(e.clientX)}
      onKeyDown={(e) => {
        if (!onSeek) return;
        if (e.key === 'ArrowRight') onSeek(Math.min(1, progress + 0.05));
        if (e.key === 'ArrowLeft') onSeek(Math.max(0, progress - 0.05));
      }}
      className={cn(
        'flex h-10 min-w-0 items-center gap-[2px] overflow-hidden rounded-md sm:gap-[3px]',
        onSeek && 'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
    >
      {heights.map((h, i) => {
        const played = i / bars < progress;
        return (
          <span
            key={i}
            className={cn(
              'min-w-0 flex-1 rounded-full transition-colors duration-150',
              played ? 'bg-primary' : 'bg-primary/25',
              active && 'animate-wave'
            )}
            style={{
              height: `${h}%`,
              animationDelay: active ? `${(i % 12) * 70}ms` : undefined,
            }}
          />
        );
      })}
    </div>
  );
}
