import { db } from "@/features/storage/db";
import { buildRecordingId } from "@/features/storage/ids";
import type { FreeRecordingRecord, RecordingRecord } from "@/types/models";

export async function getRecordedSegmentIndices(trackId: string): Promise<Set<number>> {
  const recordings = await db.recordings.where("trackId").equals(trackId).toArray();
  return new Set(recordings.map((r) => r.segmentIndex));
}

export async function deleteRecordingsForVideo(videoId: string): Promise<void> {
  await db.transaction("rw", [db.tracks, db.recordings, db.freeRecordings], async () => {
    const tracks = await db.tracks.where("videoId").equals(videoId).toArray();
    for (const track of tracks) {
      await db.recordings.where("trackId").equals(track.id).delete();
      await db.freeRecordings.where("trackId").equals(track.id).delete();
    }
  });
}

export async function getLatestRecording(
  trackId: string,
  segmentIndex: number,
): Promise<RecordingRecord | undefined> {
  return db.recordings.get(buildRecordingId(trackId, segmentIndex));
}

export async function saveLatestRecording(params: {
  trackId: string;
  segmentIndex: number;
  blob: Blob;
  mimeType: string;
  durationMs: number;
}): Promise<RecordingRecord> {
  const now = Date.now();
  const record: RecordingRecord = {
    id: buildRecordingId(params.trackId, params.segmentIndex),
    trackId: params.trackId,
    segmentIndex: params.segmentIndex,
    blob: params.blob,
    mimeType: params.mimeType,
    durationMs: params.durationMs,
    updatedAt: now,
  };

  await db.recordings.put(record);

  return record;
}

export async function saveFreeRecording(params: {
  trackId: string;
  startSegmentIndex: number;
  endSegmentIndex: number;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  playbackSpeed: number;
}): Promise<FreeRecordingRecord> {
  const now = Date.now();
  const record: FreeRecordingRecord = {
    id: `${params.trackId}:free:${now}`,
    trackId: params.trackId,
    startSegmentIndex: params.startSegmentIndex,
    endSegmentIndex: params.endSegmentIndex,
    blob: params.blob,
    mimeType: params.mimeType,
    durationMs: params.durationMs,
    playbackSpeed: params.playbackSpeed,
    createdAt: now,
  };

  await db.freeRecordings.put(record);
  return record;
}
