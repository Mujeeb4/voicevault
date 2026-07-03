/**
 * Audio compression - combine blobs and compress to MP3
 * Uses basic browser APIs when FFmpeg.wasm is not loaded
 */
export async function combineAudioFiles(
  blobs: Blob[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  if (blobs.length === 0) throw new Error('No blobs to combine');
  if (blobs.length === 1) return blobs[0];

  return transcodeBlobsToMP3(blobs, onProgress);
}

export async function compressToMP3(
  blob: Blob,
  onProgress?: (progress: number) => void
): Promise<Blob> {
  onProgress?.(0.5);
  if (getAudioFormat(blob) === 'mp3') {
    onProgress?.(1);
    return blob;
  }
  try {
    const output = await transcodeBlobsToMP3([blob], (progress) => {
      onProgress?.(0.5 + progress * 0.5);
    });
    onProgress?.(1);
    return output;
  } catch {
    onProgress?.(1);
    return blob;
  }
}

export async function splitAudioToMP3Chunks(
  blob: Blob,
  segmentSeconds: number,
  onProgress?: (progress: number) => void
): Promise<Blob[]> {
  const ffmpeg = await loadFFmpeg((progress) => onProgress?.(0.2 + progress * 0.7));
  const inputFile = `input.${getAudioFormat(blob)}`;
  const outputPattern = 'segment-%03d.mp3';
  const ffmpegWithList = ffmpeg as typeof ffmpeg & {
    listDir?: (path: string) => Promise<Array<{ name: string }>>;
  };

  try {
    await ffmpeg.writeFile(inputFile, new Uint8Array(await blob.arrayBuffer()));
    onProgress?.(0.2);
    await ffmpeg.exec([
      '-i',
      inputFile,
      '-f',
      'segment',
      '-segment_time',
      String(segmentSeconds),
      '-reset_timestamps',
      '1',
      '-b:a',
      '128k',
      outputPattern,
    ]);

    const entries = ffmpegWithList.listDir ? await ffmpegWithList.listDir('/') : [];
    const segmentFiles = entries
      .map((entry) => entry.name)
      .filter((name) => /^segment-\d{3}\.mp3$/.test(name))
      .sort();

    if (segmentFiles.length === 0) {
      throw new Error('Unable to split audio into upload parts');
    }

    const chunks: Blob[] = [];
    for (let index = 0; index < segmentFiles.length; index += 1) {
      const data = await ffmpeg.readFile(segmentFiles[index]);
      const outputData = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
      const outputBuffer = outputData.buffer.slice(
        outputData.byteOffset,
        outputData.byteOffset + outputData.byteLength
      ) as ArrayBuffer;
      chunks.push(new Blob([outputBuffer], { type: 'audio/mpeg' }));
      onProgress?.(0.9 + ((index + 1) / segmentFiles.length) * 0.1);
    }

    onProgress?.(1);
    return chunks;
  } finally {
    const entries = ffmpegWithList.listDir ? await ffmpegWithList.listDir('/').catch(() => []) : [];
    const segmentFiles = entries
      .map((entry) => entry.name)
      .filter((name) => /^segment-\d{3}\.mp3$/.test(name));
    await Promise.allSettled(
      [inputFile, ...segmentFiles].map((file) => ffmpeg.deleteFile(file))
    );
  }
}

export type SupportedAudioFormat = 'mp3' | 'webm' | 'wav';

export function getAudioFormat(blob: Blob): SupportedAudioFormat {
  const type = blob.type.toLowerCase();
  if (type.includes('mpeg') || type.includes('mp3')) return 'mp3';
  if (type.includes('wav') || type.includes('wave')) return 'wav';
  return 'webm';
}

function replaceAudioExtension(filename: string, format: SupportedAudioFormat): string {
  return filename.replace(/\.(mp3|webm|wav)$/i, '') + `.${format}`;
}

export function blobToFile(blob: Blob, filename: string): File {
  const format = getAudioFormat(blob);
  return new File([blob], replaceAudioExtension(filename, format), { type: blob.type });
}

async function loadFFmpeg(onProgress?: (progress: number) => void) {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const { toBlobURL } = await import('@ffmpeg/util');
  const ffmpeg = new FFmpeg();
  const baseURL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd';

  ffmpeg.on('progress', ({ progress }) => onProgress?.(progress));
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  return ffmpeg;
}

async function transcodeBlobsToMP3(
  blobs: Blob[],
  onProgress?: (progress: number) => void
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg((progress) => onProgress?.(0.4 + progress * 0.6));
  const inputFiles: string[] = [];
  const outputFile = 'output.mp3';

  try {
    for (let index = 0; index < blobs.length; index += 1) {
      const blob = blobs[index];
      const inputFile = `input-${index}.${getAudioFormat(blob)}`;
      inputFiles.push(inputFile);
      await ffmpeg.writeFile(inputFile, new Uint8Array(await blob.arrayBuffer()));
      onProgress?.((0.35 * (index + 1)) / blobs.length);
    }

    if (inputFiles.length === 1) {
      await ffmpeg.exec(['-i', inputFiles[0], '-b:a', '128k', outputFile]);
    } else {
      const concatFile = 'inputs.txt';
      inputFiles.push(concatFile);
      const concatList = inputFiles
        .filter((file) => file !== concatFile)
        .map((file) => `file '${file}'`)
        .join('\n');
      await ffmpeg.writeFile(concatFile, new TextEncoder().encode(concatList));
      await ffmpeg.exec(['-f', 'concat', '-safe', '0', '-i', concatFile, '-b:a', '128k', outputFile]);
    }

    const data = await ffmpeg.readFile(outputFile);
    const outputData = data instanceof Uint8Array ? data : new TextEncoder().encode(data);
    const outputBuffer = outputData.buffer.slice(
      outputData.byteOffset,
      outputData.byteOffset + outputData.byteLength
    ) as ArrayBuffer;
    onProgress?.(1);
    return new Blob([outputBuffer], { type: 'audio/mpeg' });
  } finally {
    await Promise.allSettled(
      [...inputFiles, outputFile].map((file) => ffmpeg.deleteFile(file))
    );
  }
}
