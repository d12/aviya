// audioProcessor.worker.ts
/// <reference lib="webworker" />

let ringBuffer: Float32Array;
let writePos = 0;

let bufferSize = 0;
let overlapSize = 0;

let isInitialized = false;
let isStopped = false;

let vizBuffer = new Float32Array(0);

export const SPEC_FRAME_SIZE = 2048;
export const SPEC_HOP_SIZE = 2400;
export const SPEC_FFT_BINS = 128;

function log(msg: string) {
  postMessage({ type: 'status', message: msg });
}

function fftRadix2(re: Float32Array, im: Float32Array) {
  const N = re.length;
  const levels = Math.log2(N);
  if (Math.floor(levels) !== levels) throw new Error('FFT size must be power of 2');

  const rev = new Uint32Array(N);
  for (let i = 0; i < N; i++) {
    let x = i;
    let r = 0;
    for (let j = 0; j < levels; j++) {
      r = (r << 1) | (x & 1);
      x >>>= 1;
    }
    rev[i] = r;
  }

  for (let i = 0; i < N; i++) {
    if (i < rev[i]) {
      [re[i], re[rev[i]]] = [re[rev[i]], re[i]];
      [im[i], im[rev[i]]] = [im[rev[i]], im[i]];
    }
  }

  for (let size = 2; size <= N; size *= 2) {
    const halfsize = size / 2;
    const tablestep = (2 * Math.PI) / size;
    for (let i = 0; i < N; i += size) {
      for (let j = 0; j < halfsize; j++) {
        const k = j + i;
        const l = k + halfsize;
        const tpre = re[l] * Math.cos(j * tablestep) + im[l] * Math.sin(j * tablestep);
        const tpim = -re[l] * Math.sin(j * tablestep) + im[l] * Math.cos(j * tablestep);
        re[l] = re[k] - tpre;
        im[l] = im[k] - tpim;
        re[k] += tpre;
        im[k] += tpim;
      }
    }
  }
}

function computeSpectrogramFrame(input: Float32Array, bins: number): Float32Array {
  // Apply Hann window
  const windowed = new Float32Array(input.length);
  for (let i = 0; i < input.length; i++) {
    windowed[i] = input[i] * (0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (input.length - 1)));
  }

  // Zero pad if needed
  const N = input.length;
  const re = new Float32Array(N);
  const im = new Float32Array(N);
  for (let i = 0; i < N; i++) re[i] = windowed[i];

  // Compute FFT (simple radix-2 Cooley-Tukey)
  fftRadix2(re, im);

  // Convert to magnitude and log scale
  const mag = new Float32Array(bins);
  for (let i = 0; i < bins; i++) {
    const j = Math.floor((i / bins) * (N / 2));
    mag[i] = Math.log10(1e-6 + Math.sqrt(re[j] * re[j] + im[j] * im[j]));
  }
  return mag;
}

onmessage = (event) => {
  const { type, data } = event.data;

  if (type === 'init') {
    bufferSize = data.bufferSize;
    overlapSize = data.overlapSize;
    ringBuffer = new Float32Array(bufferSize * 2); // double buffer for overlap logic
    writePos = 0;
    isInitialized = true;
    isStopped = false;
    log(`Audio processor initialized. bufferSize=${bufferSize}, overlapSize=${overlapSize}`);
  }

  else if (type === 'chunk' && isInitialized && !isStopped) {
    const input = data as Float32Array;
    const available = input.length;

    // 👇 Append to vizBuffer for STFT
    const newViz = new Float32Array(vizBuffer.length + input.length);
    newViz.set(vizBuffer);
    newViz.set(input, vizBuffer.length);
    vizBuffer = newViz;

    while (vizBuffer.length >= SPEC_FRAME_SIZE) {
      const frame = vizBuffer.slice(0, SPEC_FRAME_SIZE);
      const spec = computeSpectrogramFrame(frame, SPEC_FFT_BINS);
      postMessage({ type: 'viz', frame: spec }, [spec.buffer]);

      // shift forward by hop size
      vizBuffer = vizBuffer.slice(SPEC_HOP_SIZE);
    }

    // Ensure ring buffer has enough space
    if (writePos + available >= ringBuffer.length) {
      // shift overlapping portion to front
      ringBuffer.set(ringBuffer.subarray(bufferSize - overlapSize, bufferSize), 0);
      writePos = overlapSize;
    }

    ringBuffer.set(input, writePos);
    writePos += available;

    // Emit full chunks
    while (writePos >= bufferSize) {
      const chunk = ringBuffer.slice(0, bufferSize);
      postMessage({ type: 'chunk', chunk }, [chunk.buffer]);

      // Retain only overlap
      ringBuffer.set(ringBuffer.subarray(writePos - overlapSize, writePos), 0);
      writePos = overlapSize;
    }
  }

  else if (type === 'stop' && isInitialized && !isStopped) {
    isStopped = true;
    if (writePos >= bufferSize) {
      const finalChunk = ringBuffer.slice(0, bufferSize);
      postMessage({ type: 'chunk', chunk: finalChunk }, [finalChunk.buffer]);
    } else {
      // Pad with zeros at the end if necessary
      const finalChunk = new Float32Array(bufferSize);
      finalChunk.set(ringBuffer.subarray(Math.max(0, writePos - bufferSize)));
      postMessage({ type: 'chunk', chunk: finalChunk }, [finalChunk.buffer]);
    }
    log('Audio processor stopped and final chunk sent.');
  }
};
