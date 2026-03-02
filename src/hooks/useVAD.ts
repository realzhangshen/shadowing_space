"use client";

import { useEffect, useRef, useState } from "react";

type UseVADParams = {
  stream: MediaStream | null;
  enabled: boolean;
  onSilenceDetected: () => void;
  silenceDurationMs?: number;
  minRecordingMs?: number;
  threshold?: number;
};

export function useVAD({
  stream,
  enabled,
  onSilenceDetected,
  silenceDurationMs = 1800,
  minRecordingMs = 1000,
  threshold = 0.01
}: UseVADParams): { isSilent: boolean } {
  const [isSilent, setIsSilent] = useState(false);
  const onSilenceRef = useRef(onSilenceDetected);
  onSilenceRef.current = onSilenceDetected;

  useEffect(() => {
    if (!stream || !enabled) {
      setIsSilent(false);
      return;
    }

    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const dataArray = new Float32Array(analyser.fftSize);
    const startedAt = Date.now();
    let silenceSince: number | null = null;
    let fired = false;
    let rafId: number;

    const tick = () => {
      if (fired) return;

      analyser.getFloatTimeDomainData(dataArray);

      // Compute RMS
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      const now = Date.now();
      const elapsed = now - startedAt;

      if (rms < threshold) {
        if (silenceSince === null) {
          silenceSince = now;
        }
        setIsSilent(true);

        if (
          elapsed > minRecordingMs &&
          now - silenceSince >= silenceDurationMs
        ) {
          fired = true;
          onSilenceRef.current();
          return;
        }
      } else {
        silenceSince = null;
        setIsSilent(false);
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      void audioCtx.close();
    };
  }, [stream, enabled, silenceDurationMs, minRecordingMs, threshold]);

  return { isSilent };
}
