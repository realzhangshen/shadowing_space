import { create } from "zustand";
import {
  DEFAULT_PLAYBACK_SPEED,
  DEFAULT_PLAYBACK_SPEEDS,
  normalizePlaybackSpeed,
} from "@/features/practice/playbackSpeed";

type PlaybackMode = "idle" | "source" | "attempt";
export type PlaybackSpeed = number;
export const SPEEDS = [...DEFAULT_PLAYBACK_SPEEDS] satisfies readonly PlaybackSpeed[];
export type RepeatFlow = "manual" | "auto" | "free";
export type FreeRange = { startIndex: number; endIndex: number };

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
  freeRange: FreeRange | null;
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
  setFreeRange: (range: FreeRange | null) => void;
  setFreeHighlightIndex: (index: number) => void;
  setFreeSessionActive: (active: boolean) => void;
  resetForSession: (startIndex: number) => void;
};

export const usePracticeStore = create<PracticeState>((set) => ({
  currentIndex: 0,
  playbackMode: "idle",
  playbackSpeed: DEFAULT_PLAYBACK_SPEED,
  isRecording: false,
  isPlaying: false,
  transcriptHidden: false,
  repeatFlow: "manual",
  freeRange: null,
  freeHighlightIndex: 0,
  freeSessionActive: false,
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackMode: (playbackMode) => set({ playbackMode }),
  setPlaybackSpeed: (playbackSpeed) =>
    set({ playbackSpeed: normalizePlaybackSpeed(playbackSpeed) }),
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
      playbackSpeed: DEFAULT_PLAYBACK_SPEED,
      isRecording: false,
      isPlaying: false,
      repeatFlow: "manual",
      microphoneError: undefined,
      playerError: undefined,
      freeRange: null,
      freeHighlightIndex: 0,
      freeSessionActive: false,
    }),
}));
