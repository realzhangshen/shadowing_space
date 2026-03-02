"use client";

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from "react";
import type { PlaybackSpeed } from "@/store/practiceStore";

const SCRIPT_ID = "youtube-iframe-api-script";
const API_POLL_INTERVAL_MS = 50;
const API_LOAD_TIMEOUT_MS = 10_000;
let apiReadyPromise: Promise<void> | null = null;

function loadYouTubeApi(): Promise<void> {
  if (window.YT?.Player) {
    return Promise.resolve();
  }

  if (apiReadyPromise) {
    return apiReadyPromise;
  }

  apiReadyPromise = new Promise((resolve, reject) => {
    let resolved = false;

    const done = () => {
      if (resolved) {
        return;
      }
      resolved = true;
      resolve();
    };

    const existingScript = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!existingScript) {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        reject(new Error("Failed to load YouTube API"));
      };
      document.body.appendChild(script);
    }

    const previousHandler = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previousHandler?.();
      done();
    };

    const checker = window.setInterval(() => {
      if (window.YT?.Player) {
        window.clearInterval(checker);
        done();
      }
    }, API_POLL_INTERVAL_MS);

    window.setTimeout(() => {
      if (!resolved && !window.YT?.Player) {
        window.clearInterval(checker);
        reject(new Error("Timed out while loading YouTube API"));
      }
    }, API_LOAD_TIMEOUT_MS);
  });

  return apiReadyPromise;
}

export type YouTubeSegmentPlayerHandle = {
  playSegment: (startMs: number, endMs: number, speed: PlaybackSpeed) => void;
  toggleSegment: (startMs: number, endMs: number, speed: PlaybackSpeed) => void;
  playContinuous: (startMs: number, endMs: number, speed: PlaybackSpeed, onEnd: () => void) => void;
  pause: () => void;
  getCurrentTimeMs: () => number;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
};

type YouTubeSegmentPlayerProps = {
  videoId: string;
  onPlayerError?: (message: string) => void;
  onPlayStateChange?: (playing: boolean) => void;
};

export const YouTubeSegmentPlayer = forwardRef<YouTubeSegmentPlayerHandle, YouTubeSegmentPlayerProps>(
  function YouTubeSegmentPlayer({ videoId, onPlayerError, onPlayStateChange }, ref) {
    const elementId = useId().replace(/[:]/g, "");
    const playerRef = useRef<YT.Player | null>(null);
    const endTimerRef = useRef<number | null>(null);
    const [isReady, setIsReady] = useState(false);

    const clearEndTimer = () => {
      if (endTimerRef.current) {
        window.clearTimeout(endTimerRef.current);
        endTimerRef.current = null;
      }
    };

    useEffect(() => {
      let mounted = true;

      loadYouTubeApi()
        .then(() => {
          if (!mounted) {
            return;
          }

          playerRef.current = new window.YT!.Player(elementId, {
            width: "100%",
            height: "320",
            videoId,
            playerVars: {
              rel: 0,
              playsinline: 1
            },
            events: {
              onReady: () => {
                setIsReady(true);
              },
              onError: () => {
                onPlayerError?.("YouTube player error. Please refresh and try again.");
              },
              onStateChange: (event: YT.PlayerEvent) => {
                onPlayStateChange?.(event.data === window.YT.PlayerState.PLAYING);
              }
            }
          });
        })
        .catch(() => {
          onPlayerError?.("Failed to load YouTube API.");
        });

      return () => {
        mounted = false;
        clearEndTimer();
        playerRef.current?.destroy();
        playerRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
      if (!isReady || !playerRef.current) {
        return;
      }

      playerRef.current.cueVideoById(videoId, 0);
      clearEndTimer();
    }, [isReady, videoId]);

    const seekAndPlay = (startMs: number, endMs: number, speed: PlaybackSpeed) => {
      clearEndTimer();
      const startSeconds = Math.max(0, startMs / 1_000);
      const durationSeconds = Math.max(0.2, (endMs - startMs) / 1_000);

      playerRef.current!.setPlaybackRate(speed);
      playerRef.current!.seekTo(startSeconds, true);
      playerRef.current!.playVideo();

      endTimerRef.current = window.setTimeout(() => {
        playerRef.current?.pauseVideo();
      }, (durationSeconds * 1_000) / speed);
    };

    useImperativeHandle(
      ref,
      () => ({
        playSegment: (startMs, endMs, speed) => {
          if (!isReady || !playerRef.current) return;
          seekAndPlay(startMs, endMs, speed);
        },
        toggleSegment: (startMs, endMs, speed) => {
          if (!isReady || !playerRef.current) return;

          if (playerRef.current.getPlayerState() === window.YT.PlayerState.PLAYING) {
            clearEndTimer();
            playerRef.current.pauseVideo();
            return;
          }

          seekAndPlay(startMs, endMs, speed);
        },
        playContinuous: (startMs, endMs, speed, onEnd) => {
          if (!isReady || !playerRef.current) return;
          clearEndTimer();
          const startSeconds = Math.max(0, startMs / 1_000);
          const durationSeconds = Math.max(0.2, (endMs - startMs) / 1_000);

          playerRef.current.setPlaybackRate(speed);
          playerRef.current.seekTo(startSeconds, true);
          playerRef.current.playVideo();

          endTimerRef.current = window.setTimeout(() => {
            playerRef.current?.pauseVideo();
            onEnd();
          }, (durationSeconds * 1_000) / speed);
        },
        pause: () => {
          clearEndTimer();
          playerRef.current?.pauseVideo();
        },
        getCurrentTimeMs: () => {
          if (!playerRef.current) return 0;
          const player = playerRef.current as YT.Player & { getCurrentTime?: () => number };
          return (player.getCurrentTime?.() ?? 0) * 1_000;
        },
        setPlaybackSpeed: (speed) => {
          playerRef.current?.setPlaybackRate(speed);
        }
      }),
      [isReady]
    );

    return (
      <div className="youtube-shell-wrap" aria-label="YouTube video player">
        <div id={elementId} className="youtube-shell" />
      </div>
    );
  }
);
