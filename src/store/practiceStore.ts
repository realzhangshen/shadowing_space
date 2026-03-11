import { create } from "zustand";

export type PlaybackMode = "idle" | "source" | "attempt";
export type PlaybackSpeed = 0.5 | 0.75 | 1 | 1.25 | 1.5;
export type RepeatFlow = "manual" | "auto" | "free";

type PracticeState = {
  currentIndex: number;
  playbackMode: PlaybackMode;
  playbackSpeed: PlaybackSpeed;
  isRecording: boolean;
  isPlaying: boolean;
  transcriptHidden: boolean;
  repeatFlow: RepeatFlow;
  microphoneError?: string;
  playerError?: string;
  freeRange: { startIndex: number; endIndex: number } | null;
  freeHighlightIndex: number;
  freeSessionActive: boolean;
  setCurrentIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setIsRecording: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  toggleTranscriptHidden: () => void;
  setRepeatFlow: (flow: RepeatFlow) => void;
  setMicrophoneError: (message?: string) => void;
  setPlayerError: (message?: string) => void;
  setFreeRange: (range: { startIndex: number; endIndex: number } | null) => void;
  setFreeHighlightIndex: (index: number) => void;
  setFreeSessionActive: (active: boolean) => void;
  resetForSession: (startIndex: number) => void;
};

export const usePracticeStore = create<PracticeState>((set) => ({
  currentIndex: 0,
  playbackMode: "idle",
  playbackSpeed: 1,
  isRecording: false,
  isPlaying: false,
  transcriptHidden: false,
  repeatFlow: "manual",
  freeRange: null,
  freeHighlightIndex: 0,
  freeSessionActive: false,
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackMode: (playbackMode) => set({ playbackMode }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleTranscriptHidden: () => set((s) => ({ transcriptHidden: !s.transcriptHidden })),
  setRepeatFlow: (repeatFlow) => set({ repeatFlow }),
  setMicrophoneError: (microphoneError) => set({ microphoneError }),
  setPlayerError: (playerError) => set({ playerError }),
  setFreeRange: (freeRange) => set({ freeRange }),
  setFreeHighlightIndex: (freeHighlightIndex) => set({ freeHighlightIndex }),
  setFreeSessionActive: (freeSessionActive) => set({ freeSessionActive }),
  resetForSession: (startIndex) =>
    set({
      currentIndex: startIndex,
      playbackMode: "idle",
      playbackSpeed: 1,
      isRecording: false,
      isPlaying: false,
      repeatFlow: "manual",
      microphoneError: undefined,
      playerError: undefined,
      freeRange: null,
      freeHighlightIndex: 0,
      freeSessionActive: false
    })
}));
