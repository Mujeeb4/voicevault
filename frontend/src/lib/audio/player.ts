/**
 * VoicePlayer - Audio playback with queue support
 */
export interface VoicePlayerOptions {
  onPlay?: (id: string) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onComplete?: (id: string) => void;
  onError?: (message: string) => void;
}

export class VoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private queue: Array<{ url: string; id: string }> = [];
  private currentId: string | null = null;
  private options: VoicePlayerOptions;

  constructor(options: VoicePlayerOptions = {}) {
    this.options = options;
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.addEventListener('timeupdate', () => {
        if (this.audio && this.options.onTimeUpdate) {
          this.options.onTimeUpdate(this.audio.currentTime, this.audio.duration || 0);
        }
      });
      this.audio.addEventListener('ended', () => {
        const id = this.currentId;
        if (id && this.options.onComplete) this.options.onComplete(id);
        this.currentId = null;
        this.playNext();
      });
      this.audio.addEventListener('error', () => {
        if (this.options.onError) this.options.onError('Playback failed');
        this.playNext();
      });
    }
  }

  addToQueue(url: string, id: string): void {
    this.queue.push({ url, id });
    if (!this.currentId) {
      this.playNext();
    }
  }

  play(url: string, id: string): void {
    this.currentId = id;
    if (this.audio) {
      this.audio.src = url;
      this.options.onPlay?.(id);
      const playPromise = this.audio.play();
      if (playPromise) {
        playPromise.catch(() => {
          this.options.onError?.('Tap play to hear the voice response');
        });
      }
    }
  }

  playNext(): void {
    const next = this.queue.shift();
    if (next) this.play(next.url, next.id);
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    const playPromise = this.audio?.play();
    if (playPromise) {
      playPromise.catch(() => {
        this.options.onError?.('Tap play to hear the voice response');
      });
    }
  }

  stop(): void {
    this.audio?.pause();
    if (this.audio) this.audio.src = '';
    this.queue = [];
    this.currentId = null;
  }

  seek(time: number): void {
    if (this.audio && !isNaN(time)) this.audio.currentTime = time;
  }

  setVolume(volume: number): void {
    if (this.audio) {
      this.audio.volume = Math.max(0, Math.min(1, volume));
    }
  }
}
