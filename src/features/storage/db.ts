import Dexie, { type Table } from "dexie";
import type { ProgressRecord, RecordingRecord, SegmentRecord, TrackRecord, VideoRecord } from "@/types/models";

class ShadowingDB extends Dexie {
  videos!: Table<VideoRecord, string>;
  tracks!: Table<TrackRecord, string>;
  segments!: Table<SegmentRecord, string>;
  progress!: Table<ProgressRecord, string>;
  recordings!: Table<RecordingRecord, string>;

  constructor() {
    super("shadowing-next-db");
    this.version(1).stores({
      videos: "id, youtubeVideoId, createdAt",
      tracks: "id, videoId, createdAt, [videoId+createdAt]",
      segments: "id, trackId, [trackId+index], index",
      progress: "trackId, updatedAt",
      recordings: "id, trackId, segmentIndex, updatedAt, [trackId+segmentIndex]"
    });
  }
}

export const db = new ShadowingDB();
