import type { RepeatFlow } from "@/store/practiceStore";

export type RecordingStorage = "segment" | "free";
export type PostRecordBehavior = "idle" | "attempt" | "continueSession" | "autoAdvance";
export type PlaybackContinuity = "none" | "sequential" | "range";

export type ModeCapabilities = {
  hasSession: boolean;
  continuity: PlaybackContinuity;
  recordingStorage: RecordingStorage;
  postRecord: PostRecordBehavior;
  pausesPlaybackOnRecord: boolean;
};

export const MODE_CAPABILITIES: Record<RepeatFlow, ModeCapabilities> = {
  manual: {
    hasSession: false,
    continuity: "none",
    recordingStorage: "segment",
    postRecord: "attempt",
    pausesPlaybackOnRecord: true,
  },
  auto: {
    hasSession: false,
    continuity: "none",
    recordingStorage: "segment",
    postRecord: "autoAdvance",
    pausesPlaybackOnRecord: false,
  },
  free: {
    hasSession: true,
    continuity: "range",
    recordingStorage: "free",
    postRecord: "idle",
    pausesPlaybackOnRecord: false,
  },
  listen: {
    hasSession: true,
    continuity: "sequential",
    recordingStorage: "segment",
    postRecord: "continueSession",
    pausesPlaybackOnRecord: false,
  },
};

export function capabilitiesFor(flow: RepeatFlow): ModeCapabilities {
  return MODE_CAPABILITIES[flow];
}
