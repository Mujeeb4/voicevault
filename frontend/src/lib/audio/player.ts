/** One playback element shared by all reply controls. */
export const AUTOPLAY_BLOCKED_MESSAGE = 'Tap Play to hear this reply.';

export interface VoicePlayerOptions {
  onSelect?: (id: string) => void;
  onPlay?: (id: string) => void;
  onPause?: (id: string) => void;
  onMetadata?: (id: string, duration: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
  onComplete?: (id: string) => void;
  onError?: (message: string, id: string) => void;
}

export class VoicePlayer {
  private audio: HTMLAudioElement | null = null;
  private queue: Array<{ url: string; id: string }> = [];
  private queuedIds = new Set<string>();
  private currentId: string | null = null;
  private options: VoicePlayerOptions;

  constructor(options: VoicePlayerOptions = {}) {
    this.options = options;
    if (typeof window === 'undefined') return;
    this.audio = new Audio();
    this.audio.preload = 'metadata';
    const updateMetadata = () => {
      if (this.audio && this.currentId && Number.isFinite(this.audio.duration) && this.audio.duration > 0) {
        this.options.onMetadata?.(this.currentId, this.audio.duration);
        this.options.onTimeUpdate?.(this.audio.currentTime, this.audio.duration);
      }
    };
    this.audio.addEventListener('loadedmetadata', updateMetadata);
    this.audio.addEventListener('durationchange', updateMetadata);
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio && this.currentId) {
        this.options.onTimeUpdate?.(this.audio.currentTime, this.finiteDuration());
      }
    });
    this.audio.addEventListener('playing', () => {
      if (this.currentId) this.options.onPlay?.(this.currentId);
    });
    this.audio.addEventListener('pause', () => {
      if (this.currentId) this.options.onPause?.(this.currentId);
    });
    this.audio.addEventListener('ended', () => {
      const id = this.currentId;
      if (id) this.options.onComplete?.(id);
      this.playNext();
    });
    this.audio.addEventListener('error', () => {
      if (this.currentId) {
        this.options.onError?.('Audio could not be loaded. Try again to refresh the playback link.', this.currentId);
      }
    });
  }

  private finiteDuration(): number {
    const duration = this.audio?.duration;
    return duration && Number.isFinite(duration) ? duration : 0;
  }

  private startPlayback(id: string): void {
    this.audio?.play()?.catch((error: unknown) => {
      // A rejected play for a previous reply must not stop the newly selected reply.
      if (this.currentId !== id) return;
      const message = error instanceof Error && error.name === 'NotAllowedError'
        ? AUTOPLAY_BLOCKED_MESSAGE
        : 'Audio could not be played. Try again to refresh the playback link.';
      this.options.onError?.(message, id);
    });
  }

  addToQueue(url: string, id: string): void {
    if (this.queuedIds.has(id)) return;
    this.queuedIds.add(id);
    this.queue.push({ url, id });
    if (!this.currentId || this.audio?.ended || this.audio?.error) this.playNext();
  }

  play(url: string, id: string): void {
    if (!this.audio) return;
    this.currentId = id;
    this.options.onSelect?.(id);
    this.audio.src = url;
    this.audio.load();
    this.startPlayback(id);
  }

  playNext(): void {
    const next = this.queue.shift();
    if (next) this.play(next.url, next.id);
  }

  pause(): void {
    this.audio?.pause();
  }

  resume(): void {
    if (!this.audio || !this.currentId) return;
    if (this.audio.ended) this.audio.currentTime = 0;
    this.startPlayback(this.currentId);
  }

  stop(): void {
    this.currentId = null;
    this.audio?.pause();
    this.audio?.removeAttribute('src');
    this.audio?.load();
    this.queue = [];
    this.queuedIds.clear();
  }

  seek(time: number): void {
    if (this.audio && Number.isFinite(time)) {
      this.audio.currentTime = Math.max(0, Math.min(time, this.finiteDuration() || time));
    }
  }

  setVolume(volume: number): void {
    if (this.audio) this.audio.volume = Math.max(0, Math.min(1, volume));
  }
}
