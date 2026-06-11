'use client';

/**
 * Graphic archive background: ruled paper, waveform cuts, and quiet texture.
 */

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            'linear-gradient(90deg, hsl(var(--primary) / 0.08) 1px, transparent 1px), linear-gradient(180deg, hsl(var(--secondary) / 0.05) 1px, transparent 1px)',
          backgroundSize: '72px 72px',
          maskImage: 'linear-gradient(to bottom, black 0%, black 62%, transparent 100%)',
        }}
      />
      <div
        className="absolute left-1/2 top-16 h-[34rem] w-[62rem] -translate-x-1/2 opacity-55"
        style={{
          background:
            'repeating-linear-gradient(90deg, transparent 0 18px, hsl(var(--primary) / 0.13) 18px 20px, transparent 20px 36px), linear-gradient(180deg, transparent, hsl(var(--background)) 86%)',
          clipPath: 'polygon(0 42%, 8% 37%, 14% 45%, 21% 24%, 28% 52%, 36% 35%, 43% 46%, 50% 18%, 57% 53%, 64% 30%, 72% 48%, 79% 26%, 87% 44%, 94% 38%, 100% 42%, 100% 100%, 0 100%)',
        }}
      />
      <div
        className="absolute inset-x-0 top-0 h-28"
        style={{
          background: 'linear-gradient(180deg, hsl(var(--primary) / 0.08), transparent)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'repeat',
          backgroundSize: '128px 128px',
        }}
      />
    </div>
  );
}
