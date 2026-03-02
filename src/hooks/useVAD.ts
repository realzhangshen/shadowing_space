"use client";

import { useEffect, useRef, useState } from "react";

type UseVADParams = {
  stream: MediaStream | null;
  enabled: boolean;
  onSilenceDetected: () => void;
  audioFinishedRef: React.RefObject<boolean>;
  silenceDurationMs?: number;
  threshold?: number;
};

export function useVAD({
  stream,
  enabled,
  onSilenceDetected,
  audioFinishedRef,
  silenceDurationMs = 1800,
  threshold = 0.01
}: UseVADParams): { isSilent: boolean; hasSpoken: boolean } {
  const [isSilent, setIsSilent] = useState(false);
  const [hasSpoken, setHasSpoken] = useState(false);
  const onSilenceRef = useRef(onSilenceDetected);
  onSilenceRef.current = onSilenceDetected;

  // Reset hasSpoken when VAD is re-enabled (new recording session)
  useEffect(() => {
    if (enabled) {
      setHasSpoken(false);
    }
  }, [enabled]);

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
    let silenceSince: number | null = null;
    let fired = false;
    let spokenInLoop = false;
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

      if (rms >= threshold) {
        // User is speaking
        silenceSince = null;
        setIsSilent(false);
        if (!spokenInLoop) {
          spokenInLoop = true;
          setHasSpoken(true);
        }
      } else {
        // Silence
        if (silenceSince === null) {
          silenceSince = now;
        }
        setIsSilent(true);

        // Fire only when all gates pass:
        // 1. User has spoken at least once
        // 2. Original audio has finished playing
        // 3. Sustained silence for silenceDurationMs
        if (
          spokenInLoop &&
          audioFinishedRef.current &&
          now - silenceSince >= silenceDurationMs
        ) {
          fired = true;
          onSilenceRef.current();
          return;
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafId);
      source.disconnect();
      void audioCtx.close();
    };
  }, [stream, enabled, silenceDurationMs, threshold, audioFinishedRef]);

  return { isSilent, hasSpoken };
}
