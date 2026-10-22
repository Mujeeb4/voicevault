'use client';

import * as React from 'react';
import { Play, Pause } from 'lucide-react';
import { Waveform } from '@/components/ui/waveform';
import { PersonAvatar } from '@/components/ui/person-avatar';
import { voiceSample } from '@/config/marketing';

const isDev = process.env.NODE_ENV !== 'production';

export function VoiceSample() {
  const audioRef = React.useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const ready = !!voiceSample.src;

  if (!ready && !isDev) return null;

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => setPlaying(false));
    else el.pause();
  };

  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="eyebrow mb-3">Hear it</p>
          <h2 className="text-3xl font-semibold text-foreground sm:text-4xl">
            This is what your family will hear
          </h2>
        </div>

        <div className="surface mt-10 p-6 sm:p-8">
          <div className="flex items-center gap-4">
            <PersonAvatar name={voiceSample.speaker} size="lg" ring />
            <div className="min-w-0">
              <p className="font-semibold text-foreground">{voiceSample.speaker}</p>
              <p className="text-sm text-muted-foreground">{voiceSample.caption}</p>
            </div>
          </div>

          <div className="mt-6 flex items-center gap-4">
            <button
              type="button"
              onClick={toggle}
              disabled={!ready}
              aria-label={playing ? 'Pause sample' : 'Play sample'}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-card hover:bg-primary/90 disabled:opacity-40"
            >
              {playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-px" />}
            </button>
            <Waveform
              className="flex-1"
              bars={56}
              seed={11}
              progress={progress}
              active={playing}
              onSeek={
                ready
                  ? (f) => {
                      const el = audioRef.current;
                      if (el && el.duration) el.currentTime = f * el.duration;
                    }
                  : undefined
              }
              label="Voice sample progress"
            />
          </div>

          {ready ? (
            <>
              <audio
                ref={audioRef}
                src={voiceSample.src ?? undefined}
                preload="metadata"
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
              <details className="mt-5 text-sm text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">Read the transcript</summary>
                <p className="mt-2 leading-relaxed">{voiceSample.transcript}</p>
              </details>
            </>
          ) : (
            <p className="mt-5 rounded-lg border border-dashed border-border bg-secondary/40 p-3 text-xs text-muted-foreground">
              Preview only. Add a clip at <code>public/samples/voice-sample.mp3</code> and set it in{' '}
              <code>src/config/marketing.ts</code>. This section is hidden in production until then.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
