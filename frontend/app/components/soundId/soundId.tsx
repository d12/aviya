import { Button, Stack, Typography } from "@mui/material";
import { useAudioRecorder } from "~/hooks/useAudioRecorder";
import { useBirdModel } from "~/hooks/useBirdModel";
import SpectrogramVisualizer, {
  type SpectrogramCanvasHandle
} from "../spectogramVisualizer/spectogramVisualizer";
import { useRef, useEffect } from "react";
import { useSpeciesFilter } from "~/hooks/useSpeciesFilter";

export default function SoundId() {
  const spectrogramVisualizerRef = useRef<SpectrogramCanvasHandle>(null);

  const {
    ready: modelReady,
    status: modelStatus,
    predict,
    latest: latestBirdPrediction,
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

  const {
    ready: speciesReady,
    status: speciesStatus,
    allowedSpecies,
  } = useSpeciesFilter({
    threshold: 0.02,
  });

  useEffect(() => {
    if (latestBirdPrediction) {
      console.log("[Prediction]", latestBirdPrediction);

      // Filter by the allowed species
      const filteredSpecies = latestBirdPrediction.filter((prediction) => allowedSpecies.includes(prediction.label));

      console.log("[Filtered species]", filteredSpecies);
    }
  }, [latestBirdPrediction, allowedSpecies]);

  function getDisplayStatus({
    modelReady,
    modelStatus,
    speciesReady,
    speciesStatus,
    isRecording,
    recorderStatus,
  }: {
    modelReady: boolean;
    modelStatus: string;
    speciesReady: boolean;
    speciesStatus: string;
    isRecording: boolean;
    recorderStatus: string;
  }): string {
    if (!modelReady) return modelStatus;
    if (!speciesReady) return speciesStatus;
    if (isRecording) return recorderStatus;
    return "Ready to record.";
  }

  const allReady = modelReady && speciesReady;

  return (
    <Stack direction="column" spacing={2}>
      <Typography variant="body1">Status: {getDisplayStatus({ modelReady, modelStatus, speciesReady, speciesStatus, isRecording, recorderStatus })}</Typography>

      <Stack direction="row" spacing={2} justifyContent="center">
        <Button
          onClick={start}
          disabled={!allReady || isRecording}
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
