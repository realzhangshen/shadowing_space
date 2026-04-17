import Dexie, { type Table } from "dexie";
import type {
  FreeRecordingRecord,
  PracticeSessionRecord,
  ProgressRecord,
  RecordingRecord,
  SegmentRecord,
  StudySessionRecord,
  TrackRecord,
  VocabularyRecord,
  VideoRecord,
} from "@/types/models";

/**
 * Adding a version: copy LATEST_STORES into a new const, change only the keys
 * you need, point the new version() at it, then make LATEST_STORES = the new
 * const. Never mutate an existing const — prior versions must keep returning
 * the exact shape they shipped with so installed clients upgrade correctly.
 */

const V1_STORES = {
  videos: "id, youtubeVideoId, createdAt",
  tracks: "id, videoId, createdAt, [videoId+createdAt]",
  segments: "id, trackId, [trackId+index], index",
  progress: "trackId, updatedAt",
  recordings: "id, trackId, segmentIndex, updatedAt, [trackId+segmentIndex]",
};

// v2: introduce freeRecordings (free-shadowing range takes).
const V2_STORES = {
  ...V1_STORES,
  freeRecordings: "id, trackId, createdAt, [trackId+createdAt]",
};

// v3: introduce vocabulary (saved words + context).
const V3_STORES = {
  ...V2_STORES,
  vocabulary: "id, trackId, videoId, updatedAt, createdAt",
};

// v4: introduce practiceSessions for the dashboard summary.
const V4_STORES = {
  ...V3_STORES,
  practiceSessions: "id, trackId, videoId, createdAt, dayKey, [videoId+createdAt]",
};

// v5: introduce studySessions (active time tracking).
const V5_STORES = {
  ...V4_STORES,
  studySessions: "id, trackId, videoId, endedAt, dayKey, [videoId+endedAt]",
};

const LATEST_STORES = V5_STORES;

class ShadowingDB extends Dexie {
  videos!: Table<VideoRecord, string>;
  tracks!: Table<TrackRecord, string>;
  segments!: Table<SegmentRecord, string>;
  progress!: Table<ProgressRecord, string>;
  recordings!: Table<RecordingRecord, string>;
  freeRecordings!: Table<FreeRecordingRecord, string>;
  practiceSessions!: Table<PracticeSessionRecord, string>;
  studySessions!: Table<StudySessionRecord, string>;
  vocabulary!: Table<VocabularyRecord, string>;

  constructor() {
    super("shadowing-next-db");
    this.version(1).stores(V1_STORES);
    this.version(2).stores(V2_STORES);
    this.version(3).stores(V3_STORES);
    this.version(4).stores(V4_STORES);
    this.version(5).stores(LATEST_STORES);
  }
}

export const db = new ShadowingDB();
