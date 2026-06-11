'use client';

/**
 * SoundWave — animated SVG bars that pulse like a voice recording in progress.
 * Used in the hero section to visually represent preserved voices.
 */

interface SoundWaveProps {
  barCount?: number;
  className?: string;
  color?: string;
}

const waveClasses = [
  'animate-sw1',
  'animate-sw2',
  'animate-sw3',
  'animate-sw4',
  'animate-sw5',
  'animate-sw6',
  'animate-sw7',
];

export function SoundWave({ barCount = 28, className = '' }: SoundWaveProps) {
  return (
    <div
      className={`flex items-center justify-center gap-[3px] ${className}`}
      aria-hidden
    >
      {Array.from({ length: barCount }).map((_, i) => {
        const animClass = waveClasses[i % waveClasses.length];
        // Vary initial height — taller in center, shorter at edges
        const center = barCount / 2;
        const distFromCenter = Math.abs(i - center) / center;
        const baseH = Math.round(20 + (1 - distFromCenter) * 44);

        return (
          <span
            key={i}
            className={`inline-block w-[3px] rounded-full bg-primary/70 ${animClass}`}
            style={{
              height: `${baseH}px`,
              animationDelay: `${(i * 0.06) % 1.5}s`,
              transformOrigin: 'center',
            }}
          />
        );
      })}
    </div>
  );
}
