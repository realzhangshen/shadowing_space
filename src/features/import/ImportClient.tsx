"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, fetchProxyHealth, fetchTranscriptSegments, fetchTranscriptTracks } from "@/lib/apiClient";
import { buildTrackId, mapSegments, mapTracks, saveImportBundle } from "@/features/storage/repository";
import type { FetchTranscriptResponse, ProxyHealthResponse, TrackSummary } from "@/types/api";
import type { VideoRecord } from "@/types/models";

const DEFAULT_YOUTUBE_URL = "";

type ErrorDisplay = {
  message: string;
  errorCode?: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

function friendlyMessage(errorCode: string | undefined): string | undefined {
  switch (errorCode) {
    case "INVALID_VIDEO_URL":
      return "Please enter a valid single YouTube video URL.";
    case "VIDEO_UNAVAILABLE":
      return "This video is unavailable or has been removed.";
    case "TRANSCRIPTS_DISABLED":
      return "Transcripts are disabled for this video.";
    case "NO_CAPTION_TRACKS":
      return "No caption tracks were found for this video.";
    case "CAPTION_CONTENT_EMPTY":
      return "The caption track exists but has no content.";
    case "CAPTION_PARSING_FAILED":
      return "Failed to parse the caption data from YouTube.";
    case "YOUTUBE_UPSTREAM_ERROR":
      return "YouTube is not responding. Please try again later.";
    case "TOO_MANY_REQUESTS":
      return "Too many requests. Please wait a moment and try again.";
    case "TRACK_TOKEN_INVALID":
      return "The track selection is invalid. Please re-fetch tracks.";
    case "TRACK_TOKEN_EXPIRED":
      return "The track selection has expired. Please re-fetch tracks.";
    default:
      return undefined;
  }
}

function normalizeApiError(error: unknown): ErrorDisplay {
  if (error instanceof ApiError) {
    const friendly = friendlyMessage(error.errorCode);
    return {
      message: friendly ?? error.message,
      errorCode: error.errorCode,
      details: error.details,
      requestId: error.requestId
    };
  }

  return {
    message: error instanceof Error ? error.message : "Failed to process request."
  };
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

function ErrorBlock({ error }: { error: ErrorDisplay }): JSX.Element {
  const hasDetails = error.errorCode || error.requestId || (error.details && Object.keys(error.details).length > 0);

  return (
    <div className="error-block">
      <p className="error-text">{error.message}</p>
      {hasDetails ? (
        <details className="error-details">
          <summary>Details</summary>
          <dl className="error-detail-list">
            {error.errorCode ? (
              <>
                <dt>Error code</dt>
                <dd>{error.errorCode}</dd>
              </>
            ) : null}
            {error.details?.videoId ? (
              <>
                <dt>Video ID</dt>
                <dd>{String(error.details.videoId)}</dd>
              </>
            ) : null}
            {error.details?.step ? (
              <>
                <dt>Failed step</dt>
                <dd>{String(error.details.step)}</dd>
              </>
            ) : null}
            {Array.isArray(error.details?.strategiesAttempted) ? (
              <>
                <dt>Strategies attempted</dt>
                <dd>{(error.details.strategiesAttempted as string[]).join(", ")}</dd>
              </>
            ) : null}
            {error.details?.networkCause ? (
              <>
                <dt>Network cause</dt>
                <dd>{String(error.details.networkCause)}</dd>
              </>
            ) : null}
            {error.details?.reason ? (
              <>
                <dt>Reason</dt>
                <dd>{String(error.details.reason)}</dd>
              </>
            ) : null}
            {error.details?.languageCode ? (
              <>
                <dt>Language</dt>
                <dd>{String(error.details.languageCode)}</dd>
              </>
            ) : null}
            {error.requestId ? (
              <>
                <dt>Request ID</dt>
                <dd>{error.requestId}</dd>
              </>
            ) : null}
          </dl>
        </details>
      ) : null}
    </div>
  );
}

export function ImportClient(): JSX.Element {
  const router = useRouter();

  const [youtubeUrl, setYoutubeUrl] = useState(DEFAULT_YOUTUBE_URL);
  const [fetchResult, setFetchResult] = useState<FetchTranscriptResponse | null>(null);
  const [selectedTrackToken, setSelectedTrackToken] = useState<string>("");
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<ErrorDisplay | undefined>();
  const [useProxy, setUseProxy] = useState(true);
  const [proxyStatus, setProxyStatus] = useState<ProxyHealthResponse | null>(null);
  const [proxyChecking, setProxyChecking] = useState(false);

  const canImport = Boolean(fetchResult && selectedTrackToken) && !isImporting;

  const onTestProxy = async () => {
    setProxyChecking(true);
    setProxyStatus(null);
    try {
      const result = await fetchProxyHealth();
      setProxyStatus(result);
    } catch {
      setProxyStatus({ status: "down", proxyConfigured: false, latencyMs: null, httpStatus: null, checkedAt: new Date().toISOString(), cached: false, error: "Request failed" });
    } finally {
      setProxyChecking(false);
    }
  };

  const onFetchTracks = async () => {
    setError(undefined);
    setFetchResult(null);
    setSelectedTrackToken("");

    if (!youtubeUrl.trim()) {
      setError({ message: "Please enter a YouTube URL first." });
      return;
    }

    setIsFetching(true);

    try {
      const data = await fetchTranscriptTracks({
        url: youtubeUrl.trim(),
        preferredLanguage: "en",
        useProxy
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
      setError({ message: "Please fetch tracks and choose one track first." });
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
            trackToken,
            useProxy
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

      await saveImportBundle({
        video: videoRecord,
        tracks: mappedTracks,
        targetTrackId,
        segments: mappedSegments
      });

      const practiceUrl = `/practice/${fetchResult.videoId}/${encodeURIComponent(targetTrackId)}`;
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

      <div className="proxy-row">
        <label className="proxy-toggle">
          <input
            type="checkbox"
            checked={useProxy}
            onChange={(event) => { setUseProxy(event.target.checked); setProxyStatus(null); }}
          />
          <span>Use proxy</span>
        </label>

        {useProxy ? (
          <>
            <button className="btn-link" type="button" onClick={onTestProxy} disabled={proxyChecking}>
              {proxyChecking ? "Testing..." : "Test Connection"}
            </button>
            {proxyStatus ? (
              <span className="proxy-check">
                <span className={`proxy-check-dot ${proxyStatus.status}`} />
                <span className="proxy-check-text">
                  {proxyStatus.status === "ok" ? `Operational (${proxyStatus.latencyMs}ms)` : proxyStatus.error ?? proxyStatus.status}
                </span>
              </span>
            ) : null}
          </>
        ) : null}
      </div>

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

      {error ? <ErrorBlock error={error} /> : null}
    </section>
  );
}
