import { useEffect, useRef, useState } from 'react';
import type { BirdPrediction, BirdModelWorkerRequest, BirdModelWorkerResponse } from '~/types/birds';

export function useBirdModel() {
  const workerRef = useRef<Worker | null>(null);
  const [status, setStatus] = useState<string>('Loading model...');
  const [ready, setReady] = useState(false);
  const [latest, setLatest] = useState<BirdPrediction[] | null>(null);

  useEffect(() => {
    const worker = new Worker(
      new URL('../workers/mlWorker.ts', import.meta.url),
      { type: 'module' }
    );
    workerRef.current = worker;

    worker.postMessage({ type: 'init' } as BirdModelWorkerRequest);

    worker.onmessage = (event: MessageEvent<BirdModelWorkerResponse>) => {
      const msg = event.data;
      if (msg.type === 'status') setStatus(msg.message ?? '');
      if (msg.type === 'result') {
        setLatest(msg.result ?? []);
      }
    };

    return () => {
      worker.terminate();
      workerRef.current = null;
    };
  }, []);

  const predict = (audioChunk: Float32Array) => {
    if (!ready || !workerRef.current) return;
    workerRef.current.postMessage({ type: 'predict', data: audioChunk });
  };

  useEffect(() => {
    if (status === 'Bird model ready.') {
      setReady(true);
    }
  }, [status]);

  return {
    ready,
    status,
    predict,
    latest,
  };
}
