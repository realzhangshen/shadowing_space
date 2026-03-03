"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const DEFAULT_BINS = 150;
const SAMPLE_INTERVAL_MS = 50; // ~20 samples/sec

type LiveWaveformResult = {
  peaks: Float32Array | null;
  isLive: boolean;
};

export function useLiveWaveform(
  stream: MediaStream | null,
  isRecording: boolean,
  bins: number = DEFAULT_BINS
): LiveWaveformResult {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);

  // Derive isLive from props — no state needed, avoids dep cycle
  const isLive = isRecording && stream !== null;

  const peaksBufferRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const lastSampleRef = useRef<number>(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const binsRef = useRef(bins);
  binsRef.current = bins;

  const teardown = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    sourceRef.current?.disconnect();
    sourceRef.current = null;
    analyserRef.current = null;
    if (audioCtxRef.current) {
      void audioCtxRef.current.close();
      audioCtxRef.current = null;
    }
  }, []);

  // Freeze peaks when recording stops (separate from setup/teardown to avoid
  // race condition with stream going null)
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      // Just stopped: freeze current buffer
      if (peaksBufferRef.current.length > 0) {
        setPeaks(new Float32Array(peaksBufferRef.current));
      }
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  // Setup/teardown audio pipeline — no isLive dependency
  useEffect(() => {
    if (!isRecording || !stream) {
      teardown();
      return;
    }

    // Reset for new recording
    peaksBufferRef.current = [];
    lastSampleRef.current = 0;

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    const source = ctx.createMediaStreamSource(stream);
    source.connect(analyser);

    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    sourceRef.current = source;

    const timeDomainData = new Uint8Array(analyser.fftSize);

    function tick() {
      const now = performance.now();
      if (now - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
        lastSampleRef.current = now;

        analyser.getByteTimeDomainData(timeDomainData);

        // Compute peak amplitude (0..1) from time-domain data
        let peak = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const amplitude = Math.abs(timeDomainData[i] - 128) / 128;
          if (amplitude > peak) peak = amplitude;
        }

        const buffer = peaksBufferRef.current;
        buffer.push(peak);

        // Downsample: merge adjacent pairs when exceeding bin count
        if (buffer.length > binsRef.current) {
          const merged: number[] = [];
          for (let i = 0; i < buffer.length - 1; i += 2) {
            merged.push(Math.max(buffer[i], buffer[i + 1]));
          }
          // Keep last odd element if any
          if (buffer.length % 2 !== 0) {
            merged.push(buffer[buffer.length - 1]);
          }
          peaksBufferRef.current = merged;
        }

        setPeaks(new Float32Array(peaksBufferRef.current));
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      teardown();
    };
  }, [isRecording, stream, teardown]);

  return { peaks, isLive };
}
