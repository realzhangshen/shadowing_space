import { create } from "zustand";

export type PlaybackMode = "idle" | "source" | "attempt";
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5;
export type PracticeMethod = "listen-repeat" | "shadow";
export type PracticeScope = "sentence" | "free";
export type RepeatFlow = "manual" | "auto";

type PracticeState = {
  currentIndex: number;
  playbackMode: PlaybackMode;
  playbackSpeed: PlaybackSpeed;
  isRecording: boolean;
  isPlaying: boolean;
  transcriptHidden: boolean;
  practiceMethod: PracticeMethod;
  practiceScope: PracticeScope;
  repeatFlow: RepeatFlow;
  microphoneError?: string;
  playerError?: string;
  setCurrentIndex: (index: number) => void;
  setPlaybackMode: (mode: PlaybackMode) => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  setIsRecording: (value: boolean) => void;
  setIsPlaying: (value: boolean) => void;
  toggleTranscriptHidden: () => void;
  setPracticeMethod: (method: PracticeMethod) => void;
  setPracticeScope: (scope: PracticeScope) => void;
  setRepeatFlow: (flow: RepeatFlow) => void;
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
  practiceMethod: "listen-repeat",
  practiceScope: "sentence",
  repeatFlow: "manual",
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackMode: (playbackMode) => set({ playbackMode }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleTranscriptHidden: () => set((s) => ({ transcriptHidden: !s.transcriptHidden })),
  setPracticeMethod: (method) =>
    set((s) => {
      // "Listen & Repeat" + "Free" is invalid — force scope to "sentence"
      if (method === "listen-repeat" && s.practiceScope === "free") {
        return { practiceMethod: method, practiceScope: "sentence" };
      }
      return { practiceMethod: method };
    }),
  setPracticeScope: (scope) =>
    set(() => {
      // "Free" forces Shadow method
      if (scope === "free") {
        return { practiceScope: scope, practiceMethod: "shadow" };
      }
      return { practiceScope: scope };
    }),
  setRepeatFlow: (repeatFlow) => set({ repeatFlow }),
  setMicrophoneError: (microphoneError) => set({ microphoneError }),
  setPlayerError: (playerError) => set({ playerError }),
  resetForSession: (startIndex) =>
    set({
      currentIndex: startIndex,
      playbackMode: "idle",
      playbackSpeed: 1,
      isRecording: false,
      isPlaying: false,
      practiceMethod: "listen-repeat",
      practiceScope: "sentence",
      repeatFlow: "manual",
      microphoneError: undefined,
      playerError: undefined
    })
}));
