'use client';

import * as React from 'react';
import { Play, Pause } from 'lucide-react';

const SRC = '/audio/old_man_on_voicevault.mp3';
const bars = [30, 55, 40, 75, 50, 90, 60, 80, 45, 70, 35, 60, 85, 50, 65, 40, 55, 30, 70, 45, 60, 35];

function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Hero card demo answer: plays the sample voice clip on click. */
export function HeroVoicePlayer() {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [duration, setDuration] = React.useState(13);

  React.useEffect(() => {
    const el = audioRef.current;
    return () => el?.pause();
  }, []);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  const played = Math.round(progress * bars.length);

  return (
    <div className="mt-3 flex items-center gap-3 rounded-xl bg-card px-3 py-2.5 shadow-card">
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? 'Pause voice sample' : 'Play voice sample'}
        aria-pressed={playing}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {playing ? (
          <Pause className="h-3.5 w-3.5" fill="currentColor" />
        ) : (
          <Play className="h-3.5 w-3.5 translate-x-px" fill="currentColor" />
        )}
      </button>
      <div className="flex h-8 min-w-0 flex-1 items-center gap-[3px] overflow-hidden" aria-hidden>
        {bars.map((h, i) => (
          <span
            key={i}
            className={`w-1 shrink-0 rounded-full transition-colors ${i < played ? 'bg-primary' : 'bg-primary/55'}`}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className="num text-xs text-muted-foreground">
        {formatTime(playing || progress > 0 ? (1 - progress) * duration : duration)}
      </span>
      <audio
        ref={audioRef}
        src={SRC}
        preload="metadata"
        onLoadedMetadata={(e) => {
          if (Number.isFinite(e.currentTarget.duration)) setDuration(e.currentTarget.duration);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          setProgress(0);
        }}
        onTimeUpdate={(e) => {
          const el = e.currentTarget;
          setProgress(el.duration ? el.currentTime / el.duration : 0);
        }}
      />
    </div>
  );
}
