import { Button, Stack, Typography } from "@mui/material";
import { useAudioRecorder } from "~/hooks/useAudioRecorder";
import { useBirdModel } from "~/hooks/useBirdModel";
import SpectrogramVisualizer, {
  type SpectrogramCanvasHandle
} from "../spectogramVisualizer/spectogramVisualizer";
import { useRef, useEffect } from "react";

export default function SoundId() {
  const spectrogramVisualizerRef = useRef<SpectrogramCanvasHandle>(null);

  const {
    ready: modelReady,
    status: modelStatus,
    predict,
    latest,
  } = useBirdModel();

  const {
    start,
    stop,
    status: recorderStatus,
    isRecording,
  } = useAudioRecorder({
    bufferSize: 144000,
    overlap: 0,
    sampleRate: 48000,
    onChunk: (chunk: Float32Array) => {
      if (modelReady && chunk.length === 144000) {
        predict(chunk);
      }
    },
    onSpectrogramFrame: (frame: Float32Array) => {
      spectrogramVisualizerRef.current?.pushFrame(frame);
    },
    onStatus: (msg: string) => console.log("[Recorder]", msg),
  });

  useEffect(() => {
    if (latest) {
      console.log("[Prediction]", latest);
    }
  }, [latest]);

  const displayStatus = !modelReady
    ? modelStatus
    : isRecording
      ? recorderStatus
      : "Model ready. Click to start.";

  return (
    <Stack direction="column" spacing={2}>
      <Typography variant="body1">Status: {displayStatus}</Typography>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          onClick={start}
          disabled={!modelReady || isRecording}
          variant="contained"
        >
          Start
        </Button>
        <Button
          onClick={stop}
          disabled={!isRecording}
          variant="outlined"
        >
          Stop
        </Button>
      </Stack>

      <SpectrogramVisualizer
        amountOfSecondsToShow={15}
        sampleRate={48000}
        ref={spectrogramVisualizerRef}
      />
    </Stack>
  );
}
