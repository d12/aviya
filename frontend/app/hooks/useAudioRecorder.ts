import { useState, useRef, useCallback } from 'react';

interface UseAudioRecorderConfig {
  bufferSize: number;
  overlap: number;
  sampleRate: number;
  onChunk: (chunk: Float32Array) => void;
  onStatus?: (msg: string) => void;
  onSpectrogramFrame?: (frame: Float32Array) => void;
}

export function useAudioRecorder(config: UseAudioRecorderConfig) {
  const [status, setStatus] = useState<string>('idle');
  const [isRecording, setIsRecording] = useState<boolean>(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const postStatus = useCallback((msg: string) => {
    setStatus(msg);
    config.onStatus?.(msg);
  }, [config]);

  const start = useCallback(async () => {
    if (isRecording) return;
    setIsRecording(true);
    postStatus('Requesting microphone access...');

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;

    postStatus('Creating audio context...');
    const ctx = new AudioContext({ sampleRate: config.sampleRate });
    audioContextRef.current = ctx;

    postStatus('Loading audio worklet...');
    await ctx.audioWorklet.addModule('/audio/recorder-worklet.js');

    const workletNode = new AudioWorkletNode(ctx, 'recorder-worklet');
    workletNodeRef.current = workletNode;

    postStatus('Starting audio worker...');
    const audioWorker = new Worker(new URL('../workers/audioProcessor.worker.ts', import.meta.url), { type: 'module' });

    workerRef.current = audioWorker;

    audioWorker.postMessage({
      type: 'init',
      data: {
        bufferSize: config.bufferSize,
        overlapSize: Math.floor(config.overlap * config.sampleRate),
      }
    });

    audioWorker.onmessage = (e) => {
      const { type, chunk, message, frame } = e.data;
      if (type === 'status') postStatus(message);
      if (type === 'chunk' && chunk) config.onChunk(new Float32Array(chunk));
      if (type === 'viz' && frame) config.onSpectrogramFrame?.(new Float32Array(frame));
    };

    workletNode.port.onmessage = (e) => {
      const pcm = new Float32Array(e.data);
      audioWorker.postMessage({ type: 'chunk', data: pcm }, [pcm.buffer]);
    };

    const source = ctx.createMediaStreamSource(stream);
    source.connect(workletNode);

    postStatus('Recording...');
  }, [config, isRecording, postStatus]);

  const stop = useCallback(async () => {
    if (!isRecording) return;
    setIsRecording(false);
    postStatus('Stopping...');

    // Stop mic
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;

    // Stop audio context
    await audioContextRef.current?.close();
    audioContextRef.current = null;

    // Stop worker
    workerRef.current?.postMessage({ type: 'stop' });
    workerRef.current = null;

    workletNodeRef.current?.disconnect();
    workletNodeRef.current = null;

    postStatus('Stopped.');
  }, [isRecording, postStatus]);

  return {
    start,
    stop,
    status,
    isRecording,
  };
}
