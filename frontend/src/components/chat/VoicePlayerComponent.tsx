'use client';

/**
 * Voice Player Component
 * Audio playback controls with progress bar
 * Refactored to use global VoicePlayer from store to prevent echo (double playback)
 * Following .cursorrules patterns
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useChatStore } from '@/store/chat';

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
    duration
  } = useChatStore();

  const [localVolume, setLocalVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  // Check if this specific instance is currently playing
  const isCurrent = currentAudioId === conversationId;
  const isPlaying = isAudioPlaying && isCurrent;

  // Use global time/duration if current, otherwise 0
  const displayTime = isCurrent ? currentTime : 0;
  const displayDuration = isCurrent ? duration : 0; // Inactive players showing 0 is expected for now

  const handlePlayPause = () => {
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
    setLocalVolume(newVolume);
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleMuteToggle = () => {
    if (isMuted) {
      setVolume(localVolume || 1);
      setIsMuted(false);
    } else {
      setVolume(0);
      setIsMuted(true);
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
    link.download = `voicevault_response_${conversationId}.mp3`;
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
          disabled={!isCurrent}
          className="flex-1"
          aria-label="Audio progress"
        />
        <span className="text-xs text-muted-foreground w-10">
          {formatTime(displayDuration)}
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
              value={[isMuted ? 0 : localVolume]}
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
    </div>
  );
};

