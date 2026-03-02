import { create } from "zustand";

export type PlaybackMode = "idle" | "source" | "attempt";
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5;
export type PracticeMethod = "listen-repeat" | "shadow" | "listen";
export type PracticeScope = "sentence" | "all";

type PracticeState = {
  currentIndex: number;
  playbackMode: PlaybackMode;
  playbackSpeed: PlaybackSpeed;
  isRecording: boolean;
  isPlaying: boolean;
  transcriptHidden: boolean;
  practiceMethod: PracticeMethod;
  practiceScope: PracticeScope;
  autoAdvance: boolean;
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
  practiceMethod: "listen-repeat",
  practiceScope: "sentence",
  autoAdvance: true,
  setCurrentIndex: (currentIndex) => set({ currentIndex }),
  setPlaybackMode: (playbackMode) => set({ playbackMode }),
  setPlaybackSpeed: (playbackSpeed) => set({ playbackSpeed }),
  setIsRecording: (isRecording) => set({ isRecording }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  toggleTranscriptHidden: () => set((s) => ({ transcriptHidden: !s.transcriptHidden })),
  setPracticeMethod: (method) =>
    set((s) => {
      // "Listen & Repeat" + "All" is invalid — force scope to "sentence"
      if (method === "listen-repeat" && s.practiceScope === "all") {
        return { practiceMethod: method, practiceScope: "sentence" };
      }
      return { practiceMethod: method };
    }),
  setPracticeScope: (scope) =>
    set((s) => {
      // "All" + "Listen & Repeat" is invalid — switch method to "shadow"
      if (scope === "all" && s.practiceMethod === "listen-repeat") {
        return { practiceScope: scope, practiceMethod: "shadow" };
      }
      return { practiceScope: scope };
    }),
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
      practiceMethod: "listen-repeat",
      practiceScope: "sentence",
      autoAdvance: true,
      microphoneError: undefined,
      playerError: undefined
    })
}));
