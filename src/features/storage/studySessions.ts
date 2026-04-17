import { db } from "@/features/storage/db";
import { buildLocalDayKey, buildStudySessionId } from "@/features/storage/ids";
import type { StudySessionRecord } from "@/types/models";

export async function saveStudySessionChunk(params: {
  trackId: string;
  startedAt: number;
  endedAt: number;
  activeMs: number;
}): Promise<StudySessionRecord | undefined> {
  if (params.activeMs <= 0 || params.endedAt <= params.startedAt) {
    return undefined;
  }

  const track = await db.tracks.get(params.trackId);
  const video = track ? await db.videos.get(track.videoId) : undefined;

  if (!track || !video) {
    return undefined;
  }

  const record: StudySessionRecord = {
    id: buildStudySessionId(params.trackId, params.endedAt),
    trackId: params.trackId,
    videoId: video.id,
    videoTitle: video.title,
    startedAt: params.startedAt,
    endedAt: params.endedAt,
    activeMs: params.activeMs,
    dayKey: buildLocalDayKey(params.endedAt),
  };

  await db.studySessions.put(record);
  return record;
}

export async function listStudySessions(): Promise<StudySessionRecord[]> {
  return db.studySessions.orderBy("endedAt").reverse().toArray();
}
