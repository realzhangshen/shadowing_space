"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  ApiError,
  fetchProxyHealth,
  fetchTranscriptSegments,
  fetchTranscriptTracks,
} from "@/lib/apiClient";
import {
  buildTrackId,
  mapSegments,
  mapTracks,
  saveImportBundle,
} from "@/features/storage/repository";
import type { FetchTranscriptResponse, ProxyHealthResponse, TrackSummary } from "@/types/api";
import type { VideoRecord } from "@/types/models";

const DEFAULT_YOUTUBE_URL = "";

type ErrorDisplay = {
  message: string;
  errorCode?: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

const ERROR_CODE_KEYS: Record<string, string> = {
  INVALID_VIDEO_URL: "errorINVALID_VIDEO_URL",
  VIDEO_UNAVAILABLE: "errorVIDEO_UNAVAILABLE",
  TRANSCRIPTS_DISABLED: "errorTRANSCRIPTS_DISABLED",
  NO_CAPTION_TRACKS: "errorNO_CAPTION_TRACKS",
  CAPTION_CONTENT_EMPTY: "errorCAPTION_CONTENT_EMPTY",
  CAPTION_PARSING_FAILED: "errorCAPTION_PARSING_FAILED",
  YOUTUBE_UPSTREAM_ERROR: "errorYOUTUBE_UPSTREAM_ERROR",
  TOO_MANY_REQUESTS: "errorTOO_MANY_REQUESTS",
  TRACK_TOKEN_INVALID: "errorTRACK_TOKEN_INVALID",
  TRACK_TOKEN_EXPIRED: "errorTRACK_TOKEN_EXPIRED",
};

function isRecoverableCaptionError(error: unknown): error is ApiError {
  return error instanceof ApiError && error.status === 404;
}

function mergeTrackSummaries(original: TrackSummary[], resolved: TrackSummary): TrackSummary[] {
  if (original.some((track) => track.token === resolved.token)) {
    return original;
  }

  return [resolved, ...original];
}

function ErrorBlock({
  error,
  t,
}: {
  error: ErrorDisplay;
  t: ReturnType<typeof useTranslations<"ImportClient">>;
}): JSX.Element {
  const hasDetails =
    error.errorCode || error.requestId || (error.details && Object.keys(error.details).length > 0);

  return (
    <div className="error-block">
      <p className="error-text">{error.message}</p>
      {hasDetails ? (
        <details className="error-details">
          <summary>{t("details")}</summary>
          <dl className="error-detail-list">
            {error.errorCode ? (
              <>
                <dt>{t("errorCode")}</dt>
                <dd>{error.errorCode}</dd>
              </>
            ) : null}
            {error.details?.videoId ? (
              <>
                <dt>{t("videoId")}</dt>
                <dd>{String(error.details.videoId)}</dd>
              </>
            ) : null}
            {error.details?.step ? (
              <>
                <dt>{t("failedStep")}</dt>
                <dd>{String(error.details.step)}</dd>
              </>
            ) : null}
            {Array.isArray(error.details?.strategiesAttempted) ? (
              <>
                <dt>{t("strategiesAttempted")}</dt>
                <dd>{(error.details.strategiesAttempted as string[]).join(", ")}</dd>
              </>
            ) : null}
            {error.details?.networkCause ? (
              <>
                <dt>{t("networkCause")}</dt>
                <dd>{String(error.details.networkCause)}</dd>
              </>
            ) : null}
            {error.details?.reason ? (
              <>
                <dt>{t("reason")}</dt>
                <dd>{String(error.details.reason)}</dd>
              </>
            ) : null}
            {error.details?.languageCode ? (
              <>
                <dt>{t("languageLabel")}</dt>
                <dd>{String(error.details.languageCode)}</dd>
              </>
            ) : null}
            {error.requestId ? (
              <>
                <dt>{t("requestId")}</dt>
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
  const t = useTranslations("ImportClient");
  const locale = useLocale();
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

  function friendlyMessage(errorCode: string | undefined): string | undefined {
    if (!errorCode) return undefined;
    const key = ERROR_CODE_KEYS[errorCode];
    if (!key) return undefined;
    return t(key as Parameters<typeof t>[0]);
  }

  function normalizeApiError(apiError: unknown): ErrorDisplay {
    if (apiError instanceof ApiError) {
      const friendly = friendlyMessage(apiError.errorCode);
      return {
        message: friendly ?? apiError.message,
        errorCode: apiError.errorCode,
        details: apiError.details,
        requestId: apiError.requestId,
      };
    }

    return {
      message: apiError instanceof Error ? apiError.message : t("errorFallback"),
    };
  }

  const onTestProxy = async () => {
    setProxyChecking(true);
    setProxyStatus(null);
    try {
      const result = await fetchProxyHealth();
      setProxyStatus(result);
    } catch (requestError) {
      setProxyStatus({
        status: "down",
        proxyConfigured: false,
        latencyMs: null,
        httpStatus: null,
        checkedAt: new Date().toISOString(),
        cached: false,
        error: requestError instanceof Error ? requestError.message : "Request failed",
      });
    } finally {
      setProxyChecking(false);
    }
  };

  const onFetchTracks = async () => {
    setError(undefined);
    setFetchResult(null);
    setSelectedTrackToken("");

    if (!youtubeUrl.trim()) {
      setError({ message: t("errorUrlEmpty") });
      return;
    }

    setIsFetching(true);

    try {
      const data = await fetchTranscriptTracks({
        url: youtubeUrl.trim(),
        preferredLanguage: locale,
        useProxy,
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
      setError({ message: t("errorFetchFirst") });
      return;
    }

    setIsImporting(true);
    setError(undefined);

    try {
      const trackTokensToTry = [
        selectedTrackToken,
        ...fetchResult.tracks
          .map((track) => track.token)
          .filter((token) => token !== selectedTrackToken),
      ];

      let resolved: Awaited<ReturnType<typeof fetchTranscriptSegments>> | null = null;
      let lastRecoverableError: ApiError | null = null;

      for (const trackToken of trackTokensToTry) {
        try {
          const candidate = await fetchTranscriptSegments({
            videoId: fetchResult.videoId,
            trackToken,
            useProxy,
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
        throw lastRecoverableError ?? new ApiError(t("errorNoContent"), 404);
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
        createdAt: now,
      };

      const { effectiveTargetTrackId } = await saveImportBundle({
        video: videoRecord,
        tracks: mappedTracks,
        targetTrackId,
        segments: mappedSegments,
      });

      const practiceUrl = `/practice/${fetchResult.videoId}/${encodeURIComponent(effectiveTargetTrackId)}`;
      router.push(practiceUrl);
    } catch (requestError) {
      setError(normalizeApiError(requestError));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <section className="card">
      <h2>{t("title")}</h2>
      <p className="muted">{t("description")}</p>

      <label className="field">
        <span>{t("youtubeUrlLabel")}</span>
        <input
          type="url"
          placeholder={t("youtubeUrlPlaceholder")}
          value={youtubeUrl}
          onChange={(event) => setYoutubeUrl(event.target.value)}
        />
      </label>

      <div className="proxy-row">
        <label className="proxy-toggle">
          <input
            type="checkbox"
            checked={useProxy}
            onChange={(event) => {
              setUseProxy(event.target.checked);
              setProxyStatus(null);
            }}
          />
          <span>{t("useProxy")}</span>
        </label>

        {useProxy ? (
          <>
            <button
              className="btn-link"
              type="button"
              onClick={onTestProxy}
              disabled={proxyChecking}
            >
              {proxyChecking ? t("testing") : t("testConnection")}
            </button>
            {proxyStatus ? (
              <span className="proxy-check">
                <span className={`proxy-check-dot ${proxyStatus.status}`} />
                <span className="proxy-check-text">
                  {proxyStatus.status === "ok"
                    ? t("proxyOperational", { latencyMs: proxyStatus.latencyMs ?? 0 })
                    : (proxyStatus.error ?? proxyStatus.status)}
                </span>
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      <div className="actions-row">
        <button
          className="btn primary"
          type="button"
          onClick={onFetchTracks}
          disabled={isFetching || isImporting}
        >
          {isFetching ? t("fetching") : t("fetchTracks")}
        </button>
        <button className="btn secondary" type="button" onClick={onImport} disabled={!canImport}>
          {isImporting ? t("importing") : t("importAndStart")}
        </button>
      </div>

      {fetchResult ? (
        <>
          <h3>{t("availableTracks")}</h3>
          <p className="muted">{fetchResult.title}</p>

          <div className="track-list" role="radiogroup" aria-label={t("captionTracks")}>
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
                  {track.isAutoGenerated ? t("trackAutoSuffix") : ""}
                </span>
                <small>{track.languageCode}</small>
              </label>
            ))}
          </div>
        </>
      ) : null}

      {error ? <ErrorBlock error={error} t={t} /> : null}
    </section>
  );
}
