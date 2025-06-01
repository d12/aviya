import { Box, Button, Stack, Typography } from "@mui/material";
import { useAudioRecorder } from "~/hooks/useAudioRecorder";
import { useBirdModel } from "~/hooks/useBirdModel";
import SpectrogramVisualizer, {
  type SpectrogramCanvasHandle
} from "../spectogramVisualizer/spectogramVisualizer";
import { useRef, useEffect, useState } from "react";
import { useSpeciesFilter } from "~/hooks/useSpeciesFilter";

interface DetectedBird {
  label: string;
  numberOfOccurrences: number;
  justDetected: boolean;
}

const BIRD_MATCH_CONFIDENCE_THRESHOLD = 0.5;

function birdLabelToImageUrl(label: string) {
  const [scientific, common] = label.split('_');
  return `/aviya/bird_photos/${scientific.replace(' ', '_')}.jpg`;
}

export default function SoundId() {
  const spectrogramVisualizerRef = useRef<SpectrogramCanvasHandle>(null);

  const [detectedBirds, setDetectedBirds] = useState<DetectedBird[]>([]);

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
    threshold: 0.005,
  });

  useEffect(() => {
    if (!latestBirdPrediction) return;

    setDetectedBirds((prev) => {
      const updatedBirds = new Map(prev.map(bird => [bird.label, { ...bird, justDetected: false }]));

      console.log("Most confident bird", latestBirdPrediction[0].label, latestBirdPrediction[0].probability);

      latestBirdPrediction
        .filter(prediction => allowedSpecies.includes(prediction.label))
        .filter(prediction => prediction.probability > BIRD_MATCH_CONFIDENCE_THRESHOLD)
        .forEach(prediction => {
          const existing = updatedBirds.get(prediction.label);
          if (existing) {
            existing.numberOfOccurrences++;
            existing.justDetected = true;
          } else {
            updatedBirds.set(prediction.label, {
              label: prediction.label,
              numberOfOccurrences: 1,
              justDetected: true,
            });
          }
        });

      return Array.from(updatedBirds.values());
    });
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

      <Stack spacing={1} mt={2}>
        {detectedBirds
          .sort((a, b) => b.numberOfOccurrences - a.numberOfOccurrences)
          .map((bird) => {
            const [scientific, common] = bird.label.split('_');

            return (
              <Box
                key={bird.label}
                display="flex"
                alignItems="center"
                p={1}
                borderRadius={1}
                sx={{
                  transition: 'background-color 0.5s ease',
                  backgroundColor: bird.justDetected ? 'rgba(255, 255, 0, 0.4)' : 'transparent',
                }}
              >
                {/* Placeholder image box */}
                <Box
                  width={64}
                  height={64}
                  bgcolor="#ccc"
                  borderRadius={1}
                  mr={2}
                  flexShrink={0}
                >
                  <img src={birdLabelToImageUrl(bird.label)} alt={common} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: "8px" }} />
                </Box>

                {/* Text content */}
                <Box flex={1}>
                  <Typography fontWeight="bold">{common}</Typography>
                  <Typography variant="body2" color="text.secondary">
                    <em>{scientific}</em>
                  </Typography>
                </Box>

                {/* Count */}
                <Typography fontWeight="bold">
                  {bird.numberOfOccurrences}
                </Typography>
              </Box>
            );
          })}
      </Stack>

    </Stack>
  );
}
