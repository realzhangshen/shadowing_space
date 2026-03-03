"use client";

import { useEffect, useRef, useState } from "react";

type WaveformResult = {
  peaks: Float32Array | null;
  durationMs: number;
};

const DEFAULT_BINS = 128;

export function useWaveform(blob: Blob | null, bins: number = DEFAULT_BINS): WaveformResult {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [durationMs, setDurationMs] = useState(0);
  const prevBlobRef = useRef<Blob | null>(null);

  useEffect(() => {
    if (blob === prevBlobRef.current) return;
    prevBlobRef.current = blob;

    if (!blob) {
      setPeaks(null);
      setDurationMs(0);
      return;
    }

    let cancelled = false;

    async function decode() {
      try {
        const arrayBuffer = await blob!.arrayBuffer();
        const audioCtx = new AudioContext();
        try {
          const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
          if (cancelled) return;

          const channelData = audioBuffer.getChannelData(0);
          const totalSamples = channelData.length;
          const samplesPerBin = Math.floor(totalSamples / bins);

          const result = new Float32Array(bins);
          for (let i = 0; i < bins; i++) {
            let max = 0;
            const start = i * samplesPerBin;
            const end = Math.min(start + samplesPerBin, totalSamples);
            for (let j = start; j < end; j++) {
              const abs = Math.abs(channelData[j]);
              if (abs > max) max = abs;
            }
            result[i] = max;
          }

          setPeaks(result);
          setDurationMs(audioBuffer.duration * 1000);
        } finally {
          void audioCtx.close();
        }
      } catch (err) {
        console.warn("[useWaveform] Failed to decode audio blob:", err);
        if (!cancelled) {
          setPeaks(null);
          setDurationMs(0);
        }
      }
    }

    void decode();

    return () => {
      cancelled = true;
    };
  }, [blob, bins]);

  return { peaks, durationMs };
}
