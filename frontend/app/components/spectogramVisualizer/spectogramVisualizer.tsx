import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { SPEC_FFT_BINS, SPEC_HOP_SIZE } from '~/workers/audioProcessor.worker';

export interface SpectrogramCanvasHandle {
  pushFrame: (frame: Float32Array) => void;
}

interface SpectrogramVisualizerProps {
  amountOfSecondsToShow: number;
  sampleRate: number;
}

const SpectrogramVisualizer = forwardRef<SpectrogramCanvasHandle, SpectrogramVisualizerProps>(
  ({ amountOfSecondsToShow = 15, sampleRate }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const frameBuffer = useRef<Float32Array[]>([]);

    const frameDurationSec = SPEC_HOP_SIZE / sampleRate;

    const FRAME_WIDTH = 1; // pixels per frame
    const maxFrames = Math.ceil(amountOfSecondsToShow / frameDurationSec);

    const canvasWidth = maxFrames * FRAME_WIDTH;
    const canvasHeight = SPEC_FFT_BINS;

    useImperativeHandle(ref, () => ({
      pushFrame(frame: Float32Array) {
        if (frame.length !== SPEC_FFT_BINS) return;

        frameBuffer.current.push(frame);
        if (frameBuffer.current.length > maxFrames) {
          frameBuffer.current.shift();
        }
      }
    }));

    useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = canvasWidth;
      canvas.height = canvasHeight;

      const render = () => {
        ctx.clearRect(0, 0, canvasWidth, canvasHeight);

        // Disable anti-aliasing
        ctx.imageSmoothingEnabled = false;

        const frames = frameBuffer.current;
        const scaleY = canvasHeight / SPEC_FFT_BINS;

        for (let x = 0; x < frames.length; x++) {
          const frame = frames[x];
          for (let y = 0; y < SPEC_FFT_BINS; y++) {
            const mag = frame[y];
            const value = Math.min(255, Math.max(0, (mag + 4) / 4 * 255)); // Normalize log-mags
            ctx.fillStyle = `hsl(${(1 - value / 255) * 240}, 100%, ${value / 255 * 50 + 25}%)`;
            ctx.fillRect(x * FRAME_WIDTH, canvasHeight - y * scaleY, FRAME_WIDTH, scaleY);
          }
        }

        requestAnimationFrame(render);
      };

      render();
    }, [canvasWidth, canvasHeight]);

    return <canvas ref={canvasRef} style={{ width: '100%', height: 'auto', display: 'block', imageRendering: 'pixelated' }} />;
  }
);

export default SpectrogramVisualizer;
