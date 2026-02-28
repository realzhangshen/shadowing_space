export {};

declare global {
  interface Window {
    YT?: typeof YT;
    onYouTubeIframeAPIReady?: () => void;
  }

  namespace YT {
    interface Player {
      destroy(): void;
      pauseVideo(): void;
      playVideo(): void;
      seekTo(seconds: number, allowSeekAhead?: boolean): void;
      getPlayerState(): number;
      cueVideoById(videoId: string, startSeconds?: number): void;
      setPlaybackRate(suggestedRate: number): void;
    }

    interface PlayerEvent {
      target: Player;
      data: number;
    }

    interface PlayerOptions {
      videoId: string;
      height?: string;
      width?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: (event: PlayerEvent) => void;
        onError?: (event: PlayerEvent) => void;
        onStateChange?: (event: PlayerEvent) => void;
      };
    }

    const PlayerState: {
      UNSTARTED: number;
      ENDED: number;
      PLAYING: number;
      PAUSED: number;
      BUFFERING: number;
      CUED: number;
    };

    const Player: {
      new (elementId: string, options: PlayerOptions): Player;
    };
  }
}
