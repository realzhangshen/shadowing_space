"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecordingPlayback = {
  isPlaying: boolean;
  progress: number; // 0..1
  play: (blob: Blob) => void;
  stop: () => void;
  seek: (fraction: number) => void; // 0..1
};

export function useRecordingPlayback(): RecordingPlayback {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlRef = useRef<string | null>(null);
  const rafRef = useRef<number>(0);

  const cleanup = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.onended = null;
      audioRef.current = null;
    }
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = null;
    }
  }, []);

  const startRafLoop = useCallback(() => {
    const tick = () => {
      const audio = audioRef.current;
      if (!audio || audio.paused) return;

      const p = audio.duration > 0 ? audio.currentTime / audio.duration : 0;
      setProgress(Math.min(1, Math.max(0, p)));
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const play = useCallback(
    (blob: Blob) => {
      cleanup();

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);

      urlRef.current = url;
      audioRef.current = audio;

      audio.onended = () => {
        setIsPlaying(false);
        setProgress(0);
        if (rafRef.current) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = 0;
        }
      };

      setProgress(0);
      setIsPlaying(true);
      audio.play().catch(() => {
        setIsPlaying(false);
        cleanup();
      });
      startRafLoop();
    },
    [cleanup, startRafLoop],
  );

  const stop = useCallback(() => {
    cleanup();
    setIsPlaying(false);
    setProgress(0);
  }, [cleanup]);

  const seek = useCallback(
    (fraction: number) => {
      const audio = audioRef.current;
      if (!audio || !Number.isFinite(audio.duration)) return;

      const clamped = Math.min(1, Math.max(0, fraction));
      audio.currentTime = clamped * audio.duration;
      setProgress(clamped);

      if (audio.paused) {
        setIsPlaying(true);
        audio.play().catch(() => {
          setIsPlaying(false);
        });
        startRafLoop();
      }
    },
    [startRafLoop],
  );

  useEffect(() => cleanup, [cleanup]);

  return { isPlaying, progress, play, stop, seek };
}
