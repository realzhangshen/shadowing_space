"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type LiveWaveformStatus = "idle" | "live" | "degraded";

type LiveWaveformResult = {
  peaks: Float32Array | null;
  peaksRef: { readonly current: Float32Array | null };
  subscribe: (cb: () => void) => () => void;
  clearPeaks: () => void;
  isLive: boolean;
  status: LiveWaveformStatus;
  error: string | null;
};

function toErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unknown waveform error.";
}

export function useLiveWaveform(
  stream: MediaStream | null,
  isRecording: boolean
): LiveWaveformResult {
  const [peaks, setPeaks] = useState<Float32Array | null>(null);
  const [status, setStatus] = useState<LiveWaveformStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Derive isLive from current status so degraded mode does not look "active".
  const isLive = status === "live";

  const peaksBufferRef = useRef<number[]>([]);
  const rafRef = useRef<number>(0);
  const livePeaksRef = useRef<Float32Array | null>(null);
  const subscribersRef = useRef(new Set<() => void>());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const warnedFailureRef = useRef(false);

  const subscribe = useCallback((cb: () => void): (() => void) => {
    subscribersRef.current.add(cb);
    return () => { subscribersRef.current.delete(cb); };
  }, []);

  const clearPeaks = useCallback(() => {
    setPeaks(null);
  }, []);

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

  const reportFailure = useCallback(
    (reason: string, cause: unknown) => {
      teardown();
      setStatus("degraded");
      setError(`${reason} ${toErrorMessage(cause)}`);

      if (!warnedFailureRef.current) {
        warnedFailureRef.current = true;
        console.warn(`[useLiveWaveform] ${reason}`, cause);
      }
    },
    [teardown]
  );

  // Freeze peaks when recording stops (separate from setup/teardown to avoid
  // race condition with stream going null)
  const wasRecordingRef = useRef(false);
  useEffect(() => {
    if (wasRecordingRef.current && !isRecording) {
      // Just stopped: freeze current buffer into React state
      if (peaksBufferRef.current.length > 0) {
        setPeaks(new Float32Array(peaksBufferRef.current));
      }
      livePeaksRef.current = null;
    }
    wasRecordingRef.current = isRecording;
  }, [isRecording]);

  // Setup/teardown audio pipeline — no isLive dependency
  useEffect(() => {
    if (!isRecording || !stream) {
      teardown();
      setStatus("idle");
      setError(null);
      return;
    }

    // Reset for new recording
    peaksBufferRef.current = [];
    livePeaksRef.current = null;
    setPeaks(null);

    let cancelled = false;

    const setup = async () => {
      let ctx: AudioContext;
      try {
        ctx = new AudioContext();
      } catch (setupError) {
        if (!cancelled) {
          reportFailure("Failed to initialize waveform AudioContext.", setupError);
        }
        return;
      }

      if (cancelled) {
        void ctx.close();
        return;
      }

      if (ctx.state === "suspended") {
        try {
          await ctx.resume();
        } catch (resumeError) {
          void ctx.close();
          if (!cancelled) {
            reportFailure("Failed to resume waveform AudioContext.", resumeError);
          }
          return;
        }
      }

      if (cancelled) {
        void ctx.close();
        return;
      }

      let analyser: AnalyserNode;
      let source: MediaStreamAudioSourceNode;
      try {
        analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        source = ctx.createMediaStreamSource(stream);
        source.connect(analyser);
      } catch (nodeError) {
        void ctx.close();
        if (!cancelled) {
          reportFailure("Failed to initialize waveform analyser.", nodeError);
        }
        return;
      }

      if (cancelled) {
        source.disconnect();
        void ctx.close();
        return;
      }

      audioCtxRef.current = ctx;
      analyserRef.current = analyser;
      sourceRef.current = source;
      setStatus("live");
      setError(null);

      const timeDomainData = new Uint8Array(analyser.fftSize);

      const tick = () => {
        if (cancelled) return;

        try {
          analyser.getByteTimeDomainData(timeDomainData);
        } catch (sampleError) {
          reportFailure("Failed to read waveform sample.", sampleError);
          return;
        }

        // Compute peak amplitude (0..1) from time-domain data
        let peak = 0;
        for (let i = 0; i < timeDomainData.length; i++) {
          const amplitude = Math.abs(timeDomainData[i] - 128) / 128;
          if (amplitude > peak) peak = amplitude;
        }

        const buffer = peaksBufferRef.current;
        buffer.push(peak);

        // Write to ref + notify subscribers (bypasses React)
        livePeaksRef.current = new Float32Array(buffer);
        for (const cb of subscribersRef.current) cb();

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);
    };

    void setup();

    return () => {
      cancelled = true;
      teardown();
    };
  }, [isRecording, reportFailure, stream, teardown]);

  return { peaks, peaksRef: livePeaksRef, subscribe, clearPeaks, isLive, status, error };
}
