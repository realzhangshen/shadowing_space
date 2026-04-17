import { db } from "@/features/storage/db";
import { buildVocabularyId } from "@/features/storage/ids";
import { cleanVocabularyText, normalizeVocabularyKey } from "@/features/vocabulary/words";
import type { VocabularyRecord } from "@/types/models";

export async function listVocabularyWords(params?: {
  trackId?: string;
  videoId?: string;
}): Promise<VocabularyRecord[]> {
  const { trackId, videoId } = params ?? {};

  if (trackId) {
    const entries = await db.vocabulary.where("trackId").equals(trackId).toArray();
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  if (videoId) {
    const entries = await db.vocabulary.where("videoId").equals(videoId).toArray();
    return entries.sort((a, b) => b.updatedAt - a.updatedAt);
  }

  return db.vocabulary.orderBy("updatedAt").reverse().toArray();
}

export async function saveVocabularyWord(params: {
  text: string;
  videoId: string;
  videoTitle: string;
  trackId: string;
  segmentIndex?: number;
  segmentText?: string;
}): Promise<{ record: VocabularyRecord; created: boolean }> {
  const word = cleanVocabularyText(params.text);
  const normalizedWord = normalizeVocabularyKey(params.text);

  if (!word || !normalizedWord) {
    throw new Error("Vocabulary word cannot be empty.");
  }

  const now = Date.now();
  const id = buildVocabularyId(params.trackId, normalizedWord);
  const existing = await db.vocabulary.get(id);

  const record: VocabularyRecord = {
    id,
    word,
    normalizedWord,
    videoId: params.videoId,
    videoTitle: params.videoTitle,
    trackId: params.trackId,
    segmentIndex: params.segmentIndex ?? existing?.segmentIndex,
    segmentText: params.segmentText ?? existing?.segmentText,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await db.vocabulary.put(record);
  return { record, created: !existing };
}

export async function deleteVocabularyWord(id: string): Promise<void> {
  await db.vocabulary.delete(id);
}
