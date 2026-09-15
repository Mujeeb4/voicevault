/**
 * AudioRecorder - Web Audio API based recorder
 */
export class AudioRecorder {
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private waveformBuffer: Uint8Array<ArrayBuffer> | null = null;
  private startTime = 0;

  static async checkMicrophoneAvailable(): Promise<boolean> {
    if (
      typeof window === 'undefined' ||
      !window.isSecureContext ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      return false;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      // An empty list can mean the browser is hiding device information until
      // the user grants permission. Let the permission request determine it.
      return devices.length === 0 || devices.some((d) => d.kind === 'audioinput');
    } catch {
      // Some browsers do not expose devices until permission is requested.
      // getUserMedia support is enough to offer the user-triggered permission flow.
      return true;
    }
  }

  static async getMicrophonePermission(): Promise<'granted' | 'denied' | 'prompt'> {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) return 'denied';

    try {
      if (!navigator.permissions?.query) return 'prompt';
      const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (permission.state === 'granted' || permission.state === 'denied') return permission.state;
      return 'prompt';
    } catch {
      // Safari does not currently support querying microphone permission.
      return 'prompt';
    }
  }

  static async requestMicrophone(): Promise<MediaStream> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('Microphone recording is not supported by this browser.');
    }

    return navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  }

  static async testMicrophone(
    onLevel?: (level: number) => void,
    durationMs = 3500
  ): Promise<{ peakLevel: number; signalDetected: boolean }> {
    const stream = await AudioRecorder.requestMicrophone();
    const AudioContextClass = window.AudioContext;

    if (!AudioContextClass) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Live microphone testing is not supported by this browser.');
    }

    const audioContext = new AudioContextClass();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    const samples = new Uint8Array(new ArrayBuffer(analyser.fftSize));
    let peakLevel = 0;

    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    try {
      await new Promise<void>((resolve) => {
        const startedAt = performance.now();

        const sample = () => {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (const value of samples) {
            const normalized = (value - 128) / 128;
            sumSquares += normalized * normalized;
          }

          const rms = Math.sqrt(sumSquares / samples.length);
          const level = Math.min(1, rms * 7);
          peakLevel = Math.max(peakLevel, level);
          onLevel?.(level);

          if (performance.now() - startedAt >= durationMs) {
            resolve();
            return;
          }
          window.setTimeout(sample, 50);
        };

        sample();
      });
    } finally {
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await audioContext.close();
    }

    return { peakLevel, signalDetected: peakLevel >= 0.025 };
  }

  static getErrorMessage(error: unknown): string {
    const name = (error as { name?: string })?.name;
    if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
      return 'Microphone access is blocked. Allow it in your browser settings, then try again.';
    }
    if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect a microphone and try again.';
    }
    if (name === 'NotReadableError' || name === 'TrackStartError') {
      return 'Your microphone is being used by another application. Close it there and try again.';
    }
    if (name === 'OverconstrainedError') {
      return 'The selected microphone cannot satisfy the requested audio settings.';
    }
    if (error instanceof Error && error.message) return error.message;
    return 'The microphone could not be started. Check browser and system permissions, then try again.';
  }

  async initialize(): Promise<void> {
    this.stream = await AudioRecorder.requestMicrophone();
    if (typeof MediaRecorder === 'undefined') {
      this.cleanup();
      throw new Error('Audio recording is not supported by this browser.');
    }

    const mimeType = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ].find((type) => MediaRecorder.isTypeSupported(type));

    try {
      this.mediaRecorder = new MediaRecorder(this.stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 128000,
      });

      this.audioContext = new AudioContext();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.75;
      this.waveformBuffer = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
      this.audioContext.createMediaStreamSource(this.stream).connect(this.analyser);
    } catch (error) {
      this.cleanup();
      throw error;
    }
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
    if (!this.analyser || !this.waveformBuffer) return Array.from({ length: 32 }, () => 0);

    this.analyser.getByteTimeDomainData(this.waveformBuffer);
    const bucketSize = Math.max(1, Math.floor(this.waveformBuffer.length / 32));
    return Array.from({ length: 32 }, (_, index) => {
      const start = index * bucketSize;
      const end = Math.min(this.waveformBuffer!.length, start + bucketSize);
      let peak = 0;
      for (let offset = start; offset < end; offset += 1) {
        peak = Math.max(peak, Math.abs(this.waveformBuffer![offset] - 128) / 128);
      }
      return Math.min(1, peak * 2.5);
    });
  }

  getAudioLevel(): number {
    const data = this.getWaveformData();
    return data.length > 0 ? Math.min(1, data.reduce((a, b) => a + b, 0) / data.length) : 0;
  }

  cleanup(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    void this.audioContext?.close();
    this.stream = null;
    this.mediaRecorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.waveformBuffer = null;
  }
}
