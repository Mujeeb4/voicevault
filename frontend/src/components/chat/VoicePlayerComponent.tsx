'use client';

/**
 * Voice Player Component
 * Audio playback controls with progress bar
 * Refactored to use global VoicePlayer from store to prevent echo (double playback)
 * Following .cursorrules patterns
 */

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';
import { AUTOPLAY_BLOCKED_MESSAGE } from '@/lib/audio/player';

interface VoicePlayerComponentProps {
  audioUrl: string;
  conversationId: string;
  autoPlay?: boolean;
  showControls?: boolean;
  className?: string;
}

export const VoicePlayerComponent: React.FC<VoicePlayerComponentProps> = ({
  audioUrl,
  conversationId,
  showControls = true,
  className,
}) => {
  const {
    playAudio,
    pauseAudio,
    resumeAudio,
    seekAudio,
    setVolume,
    isAudioPlaying,
    currentAudioId,
    currentTime,
    duration,
    volume,
    audioErrors,
    loadConversations,
  } = useChatStore();

  const [metadataDuration, setMetadataDuration] = useState<number | null>(null);
  const [metadataError, setMetadataError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const previousVolume = useRef(1);
  const isMuted = volume === 0;

  useEffect(() => {
    if (volume > 0) previousVolume.current = volume;
  }, [volume]);

  // Read each reply's duration even when it has never been selected for playback.
  // This element only reads metadata; the shared player remains the sole playback source.
  useEffect(() => {
    setMetadataDuration(null);
    setMetadataError(null);
    const probe = new Audio();
    probe.preload = 'metadata';
    const updateDuration = () => {
      if (Number.isFinite(probe.duration) && probe.duration > 0) {
        setMetadataDuration(probe.duration);
        setMetadataError(null);
      }
    };
    const onError = () => setMetadataError('Audio could not be loaded. Tap Play to refresh its link.');
    probe.addEventListener('loadedmetadata', updateDuration);
    probe.addEventListener('durationchange', updateDuration);
    probe.addEventListener('error', onError);
    probe.src = audioUrl;
    probe.load();
    return () => {
      probe.removeEventListener('loadedmetadata', updateDuration);
      probe.removeEventListener('durationchange', updateDuration);
      probe.removeEventListener('error', onError);
      probe.removeAttribute('src');
      probe.load();
    };
  }, [audioUrl]);

  // Check if this specific instance is currently playing
  const isCurrent = currentAudioId === conversationId;
  const isPlaying = isAudioPlaying && isCurrent;

  const displayDuration = (isCurrent && duration > 0 ? duration : metadataDuration) || 0;
  const displayTime = isCurrent ? Math.min(currentTime, displayDuration || currentTime) : 0;
  const playbackError = audioErrors[conversationId] || (!displayDuration ? metadataError : null);

  const handlePlayPause = async () => {
    if (playbackError === AUTOPLAY_BLOCKED_MESSAGE) {
      // Keep a manual retry inside the user gesture; fetching first can block it again.
      playAudio(audioUrl, conversationId);
      return;
    }
    if (playbackError) {
      setIsRetrying(true);
      try {
        await loadConversations();
        const freshUrl = useChatStore.getState().conversations.find(c => c.id === conversationId)?.audio_url;
        playAudio(freshUrl || audioUrl, conversationId);
      } catch {
        setMetadataError('Could not refresh this audio link. Please try again.');
      } finally {
        setIsRetrying(false);
      }
      return;
    }
    if (isPlaying) {
      pauseAudio();
    } else if (isCurrent) {
      resumeAudio();
    } else {
      playAudio(audioUrl, conversationId);
    }
  };

  const handleVolumeChange = (values: number[]) => {
    const newVolume = values[0];
    setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(previousVolume.current);
    } else {
      setVolume(0);
    }
  };

  const handleSeek = (values: number[]) => {
    if (isCurrent) {
      seekAudio(values[0]);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = audioUrl;
    // The server's Content-Disposition supplies the actual WAV or MP3 filename.
    link.download = '';
    link.click();
  };

  const formatTime = (time: number) => {
    if (!time || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  if (!showControls) {
    return (
      <Button
        variant="outline"
        size="icon"
        onClick={handlePlayPause}
        className={className}
        aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
        disabled={isRetrying}
      >
        {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
    );
  }

  return (
    <div className={cn('flex flex-col space-y-2 p-3 bg-muted/30 rounded-lg', className)}>
      {/* Progress Bar */}
      <div className="flex items-center space-x-2">
        <span className="text-xs text-muted-foreground w-10 text-right">
          {formatTime(displayTime)}
        </span>
        <Slider
          value={[displayTime]}
          min={0}
          max={displayDuration || 100}
          step={0.1}
          onValueChange={handleSeek}
          disabled={!isCurrent || !displayDuration}
          className="flex-1"
          aria-label="Audio progress"
        />
        <span className="text-xs text-muted-foreground w-10">
          {displayDuration ? formatTime(displayDuration) : '--:--'}
        </span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {/* Play/Pause */}
          <Button
            variant="outline"
            size="icon"
            onClick={handlePlayPause}
            className="h-8 w-8"
            aria-label={isPlaying ? 'Pause' : 'Play'}
            disabled={isRetrying}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>

          {/* Volume */}
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleMuteToggle}
              className="h-8 w-8"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </Button>
            <Slider
              value={[volume]}
              min={0}
              max={1}
              step={0.01}
              onValueChange={handleVolumeChange}
              className="w-20"
              aria-label="Volume"
            />
          </div>
        </div>

        {/* Download */}
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDownload}
          className="h-8 w-8"
          aria-label="Download audio"
        >
          <Download className="h-4 w-4" />
        </Button>
      </div>
      {playbackError && <p role="alert" className="text-sm text-destructive">{playbackError}</p>}
    </div>
  );
};

