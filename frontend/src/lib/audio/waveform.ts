/**
 * Waveform visualization utilities
 */
export interface WaveformOptions {
  width: number;
  height: number;
  barWidth?: number;
  barGap?: number;
  color?: string;
  backgroundColor?: string;
}

export function drawWaveform(
  canvas: HTMLCanvasElement,
  data: number[],
  options: WaveformOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const { width, height, barWidth = 3, barGap = 2, color = '#3b82f6', backgroundColor = '#1f2937' } = options;

  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const bars = data.length || 32;
  const totalBarWidth = barWidth + barGap;
  const startX = (width - bars * totalBarWidth + barGap) / 2;

  for (let i = 0; i < bars; i++) {
    const val = data[i] ?? 0.5;
    const barHeight = Math.max(4, (val * height) / 2);
    const x = startX + i * totalBarWidth;
    const y = (height - barHeight) / 2;

    ctx.fillStyle = color;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
}
