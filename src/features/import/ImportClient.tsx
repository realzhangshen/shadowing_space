"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchTranscriptSegments, fetchTranscriptTracks } from "@/lib/apiClient";
import { buildTrackId, mapSegments, mapTracks, saveImportBundle } from "@/features/storage/repository";
import type { FetchTranscriptResponse, TrackSummary } from "@/types/api";
import type { VideoRecord } from "@/types/models";

const DEFAULT_YOUTUBE_URL = "";

function withRequestId(message: string, requestId?: string): string {
  if (!requestId) {
    return message;
  }
  return `${message} (request id: ${requestId})`;
}

function normalizeApiError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 422) {
      return withRequestId("Please enter a valid single YouTube video URL.", error.requestId);
    }

    if (error.status === 404) {
      if (error.message === "No caption tracks available for this video") {
        return withRequestId("No caption tracks available for this video.", error.requestId);
      }

      return withRequestId(error.message || "No usable caption content was found for this track.", error.requestId);
    }

    if (error.status === 429) {
      return withRequestId("Too many requests. Please try again in a minute.", error.requestId);
    }

    return withRequestId(error.message, error.requestId);
  }

  return error instanceof Error ? error.message : "Failed to process request.";
}

function isRecoverableCaptionError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

function mergeTrackSummaries(original: TrackSummary[], resolved: TrackSummary): TrackSummary[] {
  if (original.some((track) => track.token === resolved.token)) {
    return original;
  }

  return [resolved, ...original];
}

export function ImportClient(): JSX.Element {
  const router = useRouter();

  const [youtubeUrl, setYoutubeUrl] = useState(DEFAULT_YOUTUBE_URL);
  const [fetchResult, setFetchResult] = useState<FetchTranscriptResponse | null>(null);
  const [selectedTrackToken, setSelectedTrackToken] = useState<string>("");
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const canImport = useMemo(
    () => Boolean(fetchResult && selectedTrackToken) && !isImporting,
    [fetchResult, selectedTrackToken, isImporting]
  );

  const onFetchTracks = async () => {
    setError(undefined);
    setFetchResult(null);
    setSelectedTrackToken("");

    if (!youtubeUrl.trim()) {
      setError("Please enter a YouTube URL first.");
      return;
    }

    setIsFetching(true);

    try {
      const data = await fetchTranscriptTracks({
        url: youtubeUrl.trim(),
        preferredLanguage: "en"
      });

      setFetchResult(data);
      setSelectedTrackToken(data.defaultTrackToken || data.tracks[0]?.token || "");
    } catch (requestError) {
      setError(normalizeApiError(requestError));
    } finally {
      setIsFetching(false);
    }
  };

  const onImport = async () => {
    if (!fetchResult || !selectedTrackToken) {
      setError("Please fetch tracks and choose one track first.");
      return;
    }

    setIsImporting(true);
    setError(undefined);

    try {
      const trackTokensToTry = [
        selectedTrackToken,
        ...fetchResult.tracks.map((track) => track.token).filter((token) => token !== selectedTrackToken)
      ];

      let resolved: Awaited<ReturnType<typeof fetchTranscriptSegments>> | null = null;
      let lastRecoverableError: ApiError | null = null;

      for (const trackToken of trackTokensToTry) {
        try {
          const candidate = await fetchTranscriptSegments({
            videoId: fetchResult.videoId,
            trackToken
          });

          if (candidate.segments.length === 0) {
            lastRecoverableError = new ApiError("Caption payload is empty for this track.", 404);
            continue;
          }

          resolved = candidate;
          break;
        } catch (requestError) {
          if (isRecoverableCaptionError(requestError)) {
            lastRecoverableError = requestError;
            continue;
          }
          throw requestError;
        }
      }

      if (!resolved) {
        throw (
          lastRecoverableError ??
          new ApiError("No usable caption content was found in available tracks. Please try another video.", 404)
        );
      }

      if (resolved.track.token !== selectedTrackToken) {
        setSelectedTrackToken(resolved.track.token);
      }

      const now = Date.now();
      const mergedTracks = mergeTrackSummaries(fetchResult.tracks, resolved.track);
      const mappedTracks = mapTracks(fetchResult.videoId, mergedTracks, now);
      const targetTrackId = buildTrackId(fetchResult.videoId, resolved.track.token);

      const mappedSegments = mapSegments(targetTrackId, resolved.segments);

      const videoRecord: VideoRecord = {
        id: fetchResult.videoId,
        youtubeVideoId: fetchResult.videoId,
        title: fetchResult.title,
        thumbnailUrl: fetchResult.thumbnailUrl,
        createdAt: now
      };

      console.log("[debug] saving import bundle", {
        videoId: videoRecord.id,
        targetTrackId,
        trackIds: mappedTracks.map((t) => t.id),
        segmentCount: mappedSegments.length
      });

      await saveImportBundle({
        video: videoRecord,
        tracks: mappedTracks,
        targetTrackId,
        segments: mappedSegments
      });

      const practiceUrl = `/practice/${fetchResult.videoId}/${encodeURIComponent(targetTrackId)}`;
      console.log("[debug] navigating to", practiceUrl);
      router.push(practiceUrl);
    } catch (requestError) {
      setError(normalizeApiError(requestError));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="card">
      <h2>Import YouTube Captions</h2>
      <p className="muted">
        Input a YouTube URL, fetch available tracks, choose one track, then start sentence-by-sentence shadowing.
      </p>

      <label className="field">
        <span>YouTube URL</span>
        <input
          type="url"
          placeholder="https://www.youtube.com/watch?v=..."
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
        />
      </label>

      <div className="actions-row">
        <button className="btn primary" type="button" onClick={onFetchTracks} disabled={isFetching || isImporting}>
          {isFetching ? "Fetching..." : "Fetch Tracks"}
        </button>
        <button className="btn secondary" type="button" onClick={onImport} disabled={!canImport}>
          {isImporting ? "Importing..." : "Import and Start"}
        </button>
      </div>

      {fetchResult ? (
        <>
          <h3>Available Tracks</h3>
          <p className="muted">{fetchResult.title}</p>

          <div className="track-list" role="radiogroup" aria-label="Caption tracks">
            {fetchResult.tracks.map((track) => (
              <label key={track.token} className="track-item">
                <input
                  type="radio"
                  name="track"
                  checked={selectedTrackToken === track.token}
                  onChange={() => setSelectedTrackToken(track.token)}
                />
                <span>
                  {track.label}
                  {track.isAutoGenerated ? " (auto)" : ""}
                </span>
                <small>{track.languageCode}</small>
              </label>
            ))}
          </div>
        </>
      ) : null}

      {error ? <p className="error-text">{error}</p> : null}
    </section>
  );
}
