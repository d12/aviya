import { useEffect, useState } from "react";
import * as tf from "@tensorflow/tfjs";

interface SpeciesFilterResult {
  ready: boolean;
  status: string;
  allowedSpecies: string[];
}

interface UseSpeciesFilterOptions {
  threshold?: number;
}

export function useSpeciesFilter({
  threshold = 0.02,
}: UseSpeciesFilterOptions = {}): SpeciesFilterResult {
  const [status, setStatus] = useState("Initializing...");
  const [ready, setReady] = useState(false);
  const [allowedSpecies, setAllowedSpecies] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setStatus("Getting location...");

      let lat = 0, lon = 0;
      const week = getISOWeek(new Date());

      const labelRes = await fetch("/model/labels.json");
      const labels: string[] = await labelRes.json();

      let skipPrediction = false;

      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
        });
      }).catch(() => null);

      if (!position) {
        skipPrediction = true;
        setStatus("Location unavailable — allowing all species");
      } else {
        lat = position.coords.latitude;
        lon = position.coords.longitude;
      }

      await tf.ready();

      if (skipPrediction) {
        setAllowedSpecies(labels);
        setReady(true);
        return;
      }

      setStatus("Loading model...");
      const model = await tf.loadGraphModel("/model/mdata/model.json");

      setStatus("Predicting...");
      const input = tf.tensor([lat, lon, week]).expandDims(0); // [1, 3]
      const prediction = model.predict(input) as tf.Tensor;
      const values = await prediction.data();

      const allowed = labels.filter((_, i) => values[i] > threshold);

      if (!cancelled) {
        setAllowedSpecies(allowed);
        setReady(true);
        setStatus(`Ready (${allowed.length} species allowed)`);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [threshold]);

  return { ready, status, allowedSpecies };
}

function getISOWeek(date: Date): number {
  const temp = new Date(date.getTime());
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  return (
    1 +
    Math.round(
      ((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7
    )
  );
}
