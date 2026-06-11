'use client';

import React, { useEffect, useState } from 'react';

interface TypewriterHeadingProps {
  /** Lines to type sequentially. Second line gets the accentClassName. */
  lines: [string, string];
  accentClassName?: string;
  speed?: number; // ms per character
  delayBetweenLines?: number;
  className?: string;
}

export function TypewriterHeading({
  lines,
  accentClassName = 'text-primary',
  speed = 45,
  delayBetweenLines = 400,
  className = '',
}: TypewriterHeadingProps) {
  const [line1Done, setLine1Done] = useState(false);
  const [visible1, setVisible1] = useState('');
  const [visible2, setVisible2] = useState('');
  const [showCursor, setShowCursor] = useState(true);
  const [skipAnimation, setSkipAnimation] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (reducedMotion) {
        setSkipAnimation(true);
        setVisible1(lines[0]);
        setVisible2(lines[1]);
        setLine1Done(true);
        setShowCursor(false);
        return;
      }
    }

    let cancelled = false;

    async function run() {
      // Type first line
      for (let i = 0; i <= lines[0].length && !cancelled; i++) {
        setVisible1(lines[0].slice(0, i));
        await new Promise((r) => setTimeout(r, speed));
      }
      if (cancelled) return;
      setLine1Done(true);
      await new Promise((r) => setTimeout(r, delayBetweenLines));

      // Type second line
      for (let i = 0; i <= lines[1].length && !cancelled; i++) {
        setVisible2(lines[1].slice(0, i));
        await new Promise((r) => setTimeout(r, speed));
      }
      if (cancelled) return;
      setShowCursor(false);
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [lines, speed, delayBetweenLines]);

  if (skipAnimation) {
    return (
      <h1 className={className}>
        <span className="block">{lines[0]}</span>
        <span className={`block ${accentClassName}`}>{lines[1]}</span>
      </h1>
    );
  }

  return (
    <h1 className={className}>
      <span className="block">
        {visible1}
        {!line1Done && showCursor && (
          <span className="inline-block w-[2px] min-h-[0.75em] ml-0.5 align-middle bg-foreground animate-pulse" aria-hidden />
        )}
      </span>
      <span className={`block ${accentClassName}`}>
        {visible2}
        {line1Done && showCursor && (
          <span className="inline-block w-[2px] min-h-[0.75em] ml-0.5 align-middle bg-current animate-pulse" aria-hidden />
        )}
      </span>
    </h1>
  );
}
