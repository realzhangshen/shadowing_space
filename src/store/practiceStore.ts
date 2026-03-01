import { create } from "zustand";

export type PlaybackMode = "idle" | "source" | "attempt";
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5;

type PracticeState = {
  currentIndex: number;
  playbackMode: PlaybackMode;
  playbackSpeed: PlaybackSpeed;
  isRecording: boolean;
  isPlaying: boolean;
  transcriptHidden: boolean;
  autoAdvance: boolean;
  microphoneError?: string;
  playerError?: string;
  setCurrentIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setIsRecording: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  toggleTranscriptHidden: () => void;
  toggleAutoAdvance: () => void;
  setMicrophoneError: (message?: string) => void;
  setPlayerError: (message?: string) => void;
  resetForSession: (startIndex: number) => void;
};

export const usePracticeStore = create<PracticeState>((set) => ({
  currentIndex: 0,
  playbackMode: "idle",
  playbackSpeed: 1,
  isRecording: false,
  isPlaying: false,
  transcriptHidden: false,
  autoAdvance: false,
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackMode: (playbackMode) => set({ playbackMode }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleTranscriptHidden: () => set((s) => ({ transcriptHidden: !s.transcriptHidden })),
  toggleAutoAdvance: () => set((s) => ({ autoAdvance: !s.autoAdvance })),
  setMicrophoneError: (microphoneError) => set({ microphoneError }),
  setPlayerError: (playerError) => set({ playerError }),
  resetForSession: (startIndex) =>
    set({
      currentIndex: startIndex,
      playbackMode: "idle",
      playbackSpeed: 1,
      isRecording: false,
      isPlaying: false,
      microphoneError: undefined,
      playerError: undefined
    })
}));
