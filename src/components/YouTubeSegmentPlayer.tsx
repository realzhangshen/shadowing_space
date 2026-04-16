"use client";

import {
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import {
  DEFAULT_PLAYBACK_SPEED,
  YOUTUBE_SUPPORTED_PLAYBACK_RATES,
  normalizePlaybackSpeed,
  snapToSupportedPlaybackRate,
} from "@/features/practice/playbackSpeed";
import type { PlaybackSpeed } from "@/store/practiceStore";

const SCRIPT_ID = "youtube-iframe-api-script";
const API_POLL_INTERVAL_MS = 50;
const API_LOAD_TIMEOUT_MS = 10_000;
let apiReadyPromise: Promise<void> | null = null;
type PlaybackRatePlayer = YT.Player & {
  getPlaybackRate?: () => number;
  getAvailablePlaybackRates?: () => number[];
};

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
        script.remove();
        apiReadyPromise = null;
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
        document.getElementById(SCRIPT_ID)?.remove();
        apiReadyPromise = null;
        reject(new Error("Timed out while loading YouTube API"));
      }
    }, API_LOAD_TIMEOUT_MS);
  });

  return apiReadyPromise;
}

export type YouTubeSegmentPlayerHandle = {
  playSegment: (startMs: number, endMs: number, speed: PlaybackSpeed) => void;
  toggleSegment: (startMs: number, endMs: number, speed: PlaybackSpeed) => void;
  playContinuous: (
    startMs: number,
    endMs: number,
    speed: PlaybackSpeed,
    onEnd: () => boolean | void,
  ) => void;
  playFreeRange: (
    startMs: number,
    endMs: number,
    speed: PlaybackSpeed,
    onTimeUpdate: (currentMs: number) => void,
    onEnd: () => void,
  ) => void;
  pause: () => void;
  getCurrentTimeMs: () => number;
  getPlaybackSpeed: () => PlaybackSpeed;
  setPlaybackSpeed: (speed: PlaybackSpeed) => PlaybackSpeed | undefined;
};

type YouTubeSegmentPlayerProps = {
  videoId: string;
  onPlayerError?: (message: string) => void;
  onPlayStateChange?: (playing: boolean) => void;
  onReady?: () => void;
  onPlaybackSpeedChange?: (speed: PlaybackSpeed) => void;
};

export const YouTubeSegmentPlayer = forwardRef<
  YouTubeSegmentPlayerHandle,
  YouTubeSegmentPlayerProps
>(function YouTubeSegmentPlayer(
  { videoId, onPlayerError, onPlayStateChange, onReady, onPlaybackSpeedChange },
  ref,
) {
  const elementId = useId().replace(/[:]/g, "");
  const playerRef = useRef<YT.Player | null>(null);
  const endTimerRef = useRef<number | null>(null);
  const pollIntervalRef = useRef<number | null>(null);
  const [isReady, setIsReady] = useState(false);

  const clearTimers = () => {
    if (endTimerRef.current) {
      window.clearTimeout(endTimerRef.current);
      endTimerRef.current = null;
    }
    if (pollIntervalRef.current) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const applyPlaybackSpeed = useCallback(
    (speed: PlaybackSpeed): PlaybackSpeed => {
      const requestedSpeed = normalizePlaybackSpeed(speed);
      const player = playerRef.current as PlaybackRatePlayer | null;
      if (!player) {
        return requestedSpeed;
      }

      const availableRates = player.getAvailablePlaybackRates?.() ?? [
        ...YOUTUBE_SUPPORTED_PLAYBACK_RATES,
      ];
      const appliedSpeed = snapToSupportedPlaybackRate(requestedSpeed, availableRates);
      player.setPlaybackRate(appliedSpeed);
      onPlaybackSpeedChange?.(appliedSpeed);
      return appliedSpeed;
    },
    [onPlaybackSpeedChange],
  );

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
            playsinline: 1,
          },
          events: {
            onReady: () => {
              setIsReady(true);
              onReady?.();
            },
            onError: () => {
              onPlayerError?.("YouTube player error. Please refresh and try again.");
            },
            onStateChange: (event: YT.PlayerEvent) => {
              const state = event.data;
              if (state === window.YT.PlayerState.PLAYING) {
                onPlayStateChange?.(true);
              } else if (
                state === window.YT.PlayerState.PAUSED ||
                state === window.YT.PlayerState.ENDED
              ) {
                onPlayStateChange?.(false);
              }
            },
          },
        });
      })
      .catch(() => {
        onPlayerError?.("Failed to load YouTube API.");
      });

    return () => {
      mounted = false;
      clearTimers();
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
    clearTimers();
  }, [isReady, videoId]);

  const seekAndPlay = useCallback(
    (startMs: number, endMs: number, speed: PlaybackSpeed) => {
      clearTimers();
      const startSeconds = Math.max(0, startMs / 1_000);
      const durationSeconds = Math.max(0.2, (endMs - startMs) / 1_000);

      const appliedSpeed = applyPlaybackSpeed(speed);
      playerRef.current!.seekTo(startSeconds, true);
      playerRef.current!.playVideo();

      endTimerRef.current = window.setTimeout(
        () => {
          playerRef.current?.pauseVideo();
        },
        (durationSeconds * 1_000) / appliedSpeed,
      );
    },
    [applyPlaybackSpeed],
  );

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
          clearTimers();
          playerRef.current.pauseVideo();
          return;
        }

        seekAndPlay(startMs, endMs, speed);
      },
      playContinuous: (startMs, endMs, speed, onEnd) => {
        if (!isReady || !playerRef.current) return;
        clearTimers();
        const startSeconds = Math.max(0, startMs / 1_000);
        const durationSeconds = Math.max(0.2, (endMs - startMs) / 1_000);

        const appliedSpeed = applyPlaybackSpeed(speed);
        playerRef.current.seekTo(startSeconds, true);
        playerRef.current.playVideo();

        const timer = window.setTimeout(
          () => {
            if (endTimerRef.current === timer) {
              endTimerRef.current = null;
            }
            const shouldContinue = onEnd() === true;
            if (!shouldContinue) {
              playerRef.current?.pauseVideo();
            }
          },
          (durationSeconds * 1_000) / appliedSpeed,
        );
        endTimerRef.current = timer;
      },
      playFreeRange: (startMs, endMs, speed, onTimeUpdate, onEnd) => {
        if (!isReady || !playerRef.current) return;
        clearTimers();
        const startSeconds = Math.max(0, startMs / 1_000);
        const endSeconds = endMs / 1_000;

        applyPlaybackSpeed(speed);
        playerRef.current.seekTo(startSeconds, true);
        playerRef.current.playVideo();

        pollIntervalRef.current = window.setInterval(() => {
          if (!playerRef.current) return;
          const player = playerRef.current as YT.Player & { getCurrentTime?: () => number };
          const currentMs = (player.getCurrentTime?.() ?? 0) * 1_000;
          onTimeUpdate(currentMs);

          if (currentMs / 1_000 >= endSeconds) {
            clearTimers();
            playerRef.current?.pauseVideo();
            onEnd();
          }
        }, 250);
      },
      pause: () => {
        clearTimers();
        playerRef.current?.pauseVideo();
      },
      getCurrentTimeMs: () => {
        if (!playerRef.current) return 0;
        const player = playerRef.current as YT.Player & { getCurrentTime?: () => number };
        return (player.getCurrentTime?.() ?? 0) * 1_000;
      },
      getPlaybackSpeed: () => {
        if (!playerRef.current) {
          return DEFAULT_PLAYBACK_SPEED;
        }
        const player = playerRef.current as PlaybackRatePlayer;
        return normalizePlaybackSpeed(player.getPlaybackRate?.() ?? DEFAULT_PLAYBACK_SPEED);
      },
      setPlaybackSpeed: (speed) => {
        if (!playerRef.current) {
          return undefined;
        }
        return applyPlaybackSpeed(speed);
      },
    }),
    [applyPlaybackSpeed, isReady, seekAndPlay],
  );

  return (
    <div className="youtube-shell-wrap" aria-label="YouTube video player">
      <div id={elementId} className="youtube-shell" />
    </div>
  );
});
