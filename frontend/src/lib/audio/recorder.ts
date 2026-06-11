/**
 * AudioRecorder - Web Audio API based recorder
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private startTime = 0;

  static async checkMicrophoneAvailable(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return false;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      return devices.some((d) => d.kind === 'audioinput');
    } catch {
      return false;
    }
  }

  static async getMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return 'denied';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (e: unknown) {
      const err = e as { name?: string };
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') return 'denied';
      return 'prompt';
    }
  }

  async initialize(): Promise<void> {
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.mediaRecorder = new MediaRecorder(this.stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' : 'audio/webm',
      audioBitsPerSecond: 128000,
    });
  }

  start(): void {
    if (!this.mediaRecorder) throw new Error('Recorder not initialized');
    this.audioChunks = [];
    this.startTime = Date.now();
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) this.audioChunks.push(e.data);
    };
    this.mediaRecorder.start(100);
  }

  async stop(): Promise<{ blob: Blob; duration: number }> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        reject(new Error('Recorder not initialized'));
        return;
      }
      this.mediaRecorder.onstop = () => {
        const blob = new Blob(this.audioChunks, { type: this.mediaRecorder?.mimeType ?? 'audio/webm' });
        const duration = (Date.now() - this.startTime) / 1000;
        this.cleanup();
        resolve({ blob, duration });
      };
      this.mediaRecorder.stop();
    });
  }

  pause(): void {
    this.mediaRecorder?.pause();
  }

  resume(): void {
    this.mediaRecorder?.resume();
  }

  getWaveformData(): number[] {
    return Array.from({ length: 32 }, () => Math.random() * 0.5 + 0.3);
  }

  getAudioLevel(): number {
    const data = this.getWaveformData();
    return data.length > 0 ? data.reduce((a, b) => a + b, 0) / data.length : 0;
  }

  cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.mediaRecorder = null;
  }
}
