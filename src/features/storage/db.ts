import Dexie, { type Table } from "dexie";
import type {
  FreeRecordingRecord,
  ProgressRecord,
  RecordingRecord,
  SegmentRecord,
  TrackRecord,
  VocabularyRecord,
  VideoRecord,
} from "@/types/models";

class ShadowingDB extends Dexie {
  videos!: Table<VideoRecord, string>;
  tracks!: Table<TrackRecord, string>;
  segments!: Table<SegmentRecord, string>;
  progress!: Table<ProgressRecord, string>;
  recordings!: Table<RecordingRecord, string>;
  freeRecordings!: Table<FreeRecordingRecord, string>;
  vocabulary!: Table<VocabularyRecord, string>;

  constructor() {
    super("shadowing-next-db");
    this.version(1).stores({
      videos: "id, youtubeVideoId, createdAt",
      tracks: "id, videoId, createdAt, [videoId+createdAt]",
      segments: "id, trackId, [trackId+index], index",
      progress: "trackId, updatedAt",
      recordings: "id, trackId, segmentIndex, updatedAt, [trackId+segmentIndex]",
    });
    this.version(2).stores({
      videos: "id, youtubeVideoId, createdAt",
      tracks: "id, videoId, createdAt, [videoId+createdAt]",
      segments: "id, trackId, [trackId+index], index",
      progress: "trackId, updatedAt",
      recordings: "id, trackId, segmentIndex, updatedAt, [trackId+segmentIndex]",
      freeRecordings: "id, trackId, createdAt, [trackId+createdAt]",
    });
    this.version(3).stores({
      videos: "id, youtubeVideoId, createdAt",
      tracks: "id, videoId, createdAt, [videoId+createdAt]",
      segments: "id, trackId, [trackId+index], index",
      progress: "trackId, updatedAt",
      recordings: "id, trackId, segmentIndex, updatedAt, [trackId+segmentIndex]",
      freeRecordings: "id, trackId, createdAt, [trackId+createdAt]",
      vocabulary: "id, trackId, videoId, updatedAt, createdAt",
    });
  }
}

export const db = new ShadowingDB();
