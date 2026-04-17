import { db } from "@/features/storage/db";
import type { HistoryItem, ProgressRecord, TrackRecord, VideoRecord } from "@/types/models";

export async function deleteVideo(videoId: string): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.videos,
      db.tracks,
      db.segments,
      db.progress,
      db.recordings,
      db.freeRecordings,
      db.practiceSessions,
      db.studySessions,
      db.vocabulary,
    ],
    async () => {
      const tracks = await db.tracks.where("videoId").equals(videoId).toArray();
      for (const track of tracks) {
        await db.segments.where("trackId").equals(track.id).delete();
        await db.recordings.where("trackId").equals(track.id).delete();
        await db.freeRecordings.where("trackId").equals(track.id).delete();
        await db.vocabulary.where("trackId").equals(track.id).delete();
        await db.progress.delete(track.id);
      }
      await db.practiceSessions.where("videoId").equals(videoId).delete();
      await db.studySessions.where("videoId").equals(videoId).delete();
      await db.tracks.where("videoId").equals(videoId).delete();
      await db.videos.delete(videoId);
    },
  );
}

export async function listHistory(): Promise<HistoryItem[]> {
  // Phase 1: load lightweight metadata only (no segment text or recording blobs)
  const [videos, tracks, progressItems] = await Promise.all([
    db.videos.toArray(),
    db.tracks.toArray(),
    db.progress.toArray(),
  ]);

  const tracksByVideo = new Map<string, TrackRecord[]>();
  for (const track of tracks) {
    const list = tracksByVideo.get(track.videoId) ?? [];
    list.push(track);
    tracksByVideo.set(track.videoId, list);
  }

  const progressByTrack = new Map<string, ProgressRecord>();
  for (const item of progressItems) {
    progressByTrack.set(item.trackId, item);
  }

  // Determine the active track per video before querying segments/recordings
  const videoEntries: Array<{
    video: VideoRecord;
    activeTrack?: TrackRecord;
    activeProgress?: ProgressRecord;
  }> = [];

  const activeTrackIds: string[] = [];

  for (const video of videos) {
    const videoTracks = tracksByVideo.get(video.id) ?? [];
    let activeTrack: TrackRecord | undefined;
    let activeProgress: ProgressRecord | undefined;

    for (const track of videoTracks) {
      const progress = progressByTrack.get(track.id);
      if (!progress) continue;
      if (!activeProgress || progress.updatedAt > activeProgress.updatedAt) {
        activeProgress = progress;
        activeTrack = track;
      }
    }

    if (!activeTrack && videoTracks.length > 0) {
      activeTrack = videoTracks[0];
    }

    videoEntries.push({ video, activeTrack, activeProgress });
    if (activeTrack) {
      activeTrackIds.push(activeTrack.id);
    }
  }

  // Phase 2: count segments (index-only, no text loaded) and load recordings
  // only for active tracks
  const [segmentCounts, recordingStats, freeRecordingStats] = await Promise.all([
    Promise.all(
      activeTrackIds.map(async (trackId) => {
        const count = await db.segments.where("trackId").equals(trackId).count();
        return [trackId, count] as const;
      }),
    ),
    Promise.all(
      activeTrackIds.map(async (trackId) => {
        const recordings = await db.recordings.where("trackId").equals(trackId).toArray();
        let totalSize = 0;
        for (const r of recordings) {
          totalSize += r.blob.size;
        }
        return [trackId, recordings.length, totalSize] as const;
      }),
    ),
    Promise.all(
      activeTrackIds.map(async (trackId) => {
        const freeRecs = await db.freeRecordings.where("trackId").equals(trackId).toArray();
        let totalSize = 0;
        for (const r of freeRecs) {
          totalSize += r.blob.size;
        }
        return [trackId, freeRecs.length, totalSize] as const;
      }),
    ),
  ]);

  const segmentCountByTrack = new Map(segmentCounts);
  const recordingCountByTrack = new Map<string, number>();
  const recordingSizeByTrack = new Map<string, number>();
  for (const [trackId, count, size] of recordingStats) {
    recordingCountByTrack.set(trackId, count);
    recordingSizeByTrack.set(trackId, size);
  }
  for (const [trackId, count, size] of freeRecordingStats) {
    recordingCountByTrack.set(trackId, (recordingCountByTrack.get(trackId) ?? 0) + count);
    recordingSizeByTrack.set(trackId, (recordingSizeByTrack.get(trackId) ?? 0) + size);
  }

  const items = videoEntries.map(({ video, activeTrack, activeProgress }) => {
    const segmentCount = activeTrack ? (segmentCountByTrack.get(activeTrack.id) ?? 0) : 0;
    const recordingCount = activeTrack ? (recordingCountByTrack.get(activeTrack.id) ?? 0) : 0;
    const recordingSizeBytes = activeTrack ? (recordingSizeByTrack.get(activeTrack.id) ?? 0) : 0;

    return {
      video,
      activeTrack,
      progress: activeProgress,
      segmentCount,
      recordingCount,
      recordingSizeBytes,
    } satisfies HistoryItem;
  });

  items.sort((a, b) => {
    const aTime = a.progress?.updatedAt ?? a.video.createdAt;
    const bTime = b.progress?.updatedAt ?? b.video.createdAt;
    return bTime - aTime;
  });

  return items;
}

export async function clearAllData(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.videos,
      db.tracks,
      db.segments,
      db.progress,
      db.recordings,
      db.freeRecordings,
      db.practiceSessions,
      db.studySessions,
      db.vocabulary,
    ],
    async () => {
      await Promise.all([
        db.studySessions.clear(),
        db.practiceSessions.clear(),
        db.vocabulary.clear(),
        db.freeRecordings.clear(),
        db.recordings.clear(),
        db.progress.clear(),
        db.segments.clear(),
        db.tracks.clear(),
        db.videos.clear(),
      ]);
    },
  );
}
