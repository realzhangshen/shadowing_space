"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import {
  ApiError,
  fetchProxyHealth,
  fetchTranscriptSegments,
  fetchTranscriptTracks,
} from "@/lib/apiClient";
import {
  createImportBundleFromExtensionPayload,
  parseExtensionImportMessage,
} from "@/features/import/extensionImport";
import { parseExtensionPayloadFromText } from "@/features/import/fileImport";
import {
  deriveImportMode,
  reduceExtensionHandoff,
  type ExtensionHandoffState,
  type ImportMode,
} from "@/features/import/importMode";
import {
  buildTrackId,
  mapSegments,
  mapTracks,
  saveImportBundle,
} from "@/features/storage/repository";
import type { FetchTranscriptResponse, ProxyHealthResponse, TrackSummary } from "@/types/api";
import type { VideoRecord } from "@/types/models";

const DEFAULT_YOUTUBE_URL = "";
const EXTENSION_TICK_INTERVAL_MS = 500;

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

function FileImportBlock({
  onPick,
  disabled,
  t,
}: {
  onPick: (file: File) => void;
  disabled: boolean;
  t: ReturnType<typeof useTranslations<"ImportClient">>;
}): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="file-import">
      <h3>{t("fileImportLabel")}</h3>
      <p className="muted">{t("fileImportHint")}</p>
      <input
        ref={inputRef}
        type="file"
        accept="application/json,.json"
        className="file-import-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          onPick(file);
          event.target.value = "";
        }}
        disabled={disabled}
        aria-label={t("fileImportButton")}
      />
      <button
        type="button"
        className="btn secondary"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
      >
        {t("fileImportButton")}
      </button>
    </div>
  );
}

function ExtensionHandoffPanel({
  state,
  onSwitchToManual,
  t,
}: {
  state: ExtensionHandoffState;
  onSwitchToManual: () => void;
  t: ReturnType<typeof useTranslations<"ImportClient">>;
}): JSX.Element {
  if (state.kind === "awaiting" || state.kind === "processing") {
    const title =
      state.kind === "awaiting" ? t("extensionAwaitingTitle") : t("extensionProcessingTitle");
    const body =
      state.kind === "awaiting" ? t("extensionAwaitingBody") : t("extensionProcessingBody");
    return (
      <div className="extension-handoff" role="status" aria-live="polite">
        <div className="extension-handoff-spinner" aria-hidden="true" />
        <h3>{title}</h3>
        <p className="muted">{body}</p>
      </div>
    );
  }

  if (state.kind === "timed_out") {
    return (
      <div className="extension-handoff extension-handoff-warn" role="status" aria-live="polite">
        <h3>{t("extensionTimeoutTitle")}</h3>
        <p className="muted">{t("extensionTimeoutBody")}</p>
        <button className="btn secondary" type="button" onClick={onSwitchToManual}>
          {t("extensionTimeoutAction")}
        </button>
        <p className="muted extension-handoff-hint">{t("extensionInstallHint")}</p>
      </div>
    );
  }

  return (
    <div className="extension-handoff extension-handoff-error" role="alert">
      <h3>{t("extensionErrorTitle")}</h3>
      <p>{t("extensionErrorBody", { message: state.message })}</p>
      <button className="btn secondary" type="button" onClick={onSwitchToManual}>
        {t("extensionErrorRetry")}
      </button>
    </div>
  );
}

export function ImportClient(): JSX.Element {
  const t = useTranslations("ImportClient");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialMode = useMemo<ImportMode>(
    () =>
      deriveImportMode({
        searchParams: new URLSearchParams(searchParams?.toString() ?? ""),
      }),
    [searchParams],
  );

  const [mode, setMode] = useState<ImportMode>(initialMode);
  const [extensionState, setExtensionState] = useState<ExtensionHandoffState>(() =>
    initialMode === "extension"
      ? { kind: "awaiting", startedAt: Date.now() }
      : { kind: "awaiting", startedAt: 0 },
  );

  const [youtubeUrl, setYoutubeUrl] = useState(DEFAULT_YOUTUBE_URL);
  const [fetchResult, setFetchResult] = useState<FetchTranscriptResponse | null>(null);
  const [selectedTrackToken, setSelectedTrackToken] = useState<string>("");
  const [isFetching, setIsFetching] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<ErrorDisplay | undefined>();
  const [useProxy, setUseProxy] = useState(true);
  const [proxyStatus, setProxyStatus] = useState<ProxyHealthResponse | null>(null);
  const [proxyChecking, setProxyChecking] = useState(false);
  const extensionImportInFlightRef = useRef(false);

  const canImport = Boolean(fetchResult && selectedTrackToken) && !isImporting;

  const friendlyMessage = useCallback(
    (errorCode: string | undefined): string | undefined => {
      if (!errorCode) return undefined;
      const key = ERROR_CODE_KEYS[errorCode];
      if (!key) return undefined;
      return t(key as Parameters<typeof t>[0]);
    },
    [t],
  );

  const normalizeApiError = useCallback(
    (apiError: unknown): ErrorDisplay => {
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
    },
    [friendlyMessage, t],
  );

  const switchToManual = useCallback(() => {
    setMode("manual");
  }, []);

  const onImportFromFile = useCallback(
    async (file: File) => {
      setError(undefined);
      setIsImporting(true);
      try {
        const text = await file.text();
        const payload = parseExtensionPayloadFromText(text);
        const bundle = createImportBundleFromExtensionPayload(payload);
        const { effectiveTargetTrackId } = await saveImportBundle(bundle);
        const practiceUrl = `/practice/${bundle.video.id}/${encodeURIComponent(effectiveTargetTrackId)}`;
        router.push(practiceUrl);
      } catch (fileError) {
        const message = fileError instanceof Error ? fileError.message : String(fileError);
        setError({ message: t("fileImportInvalid", { message }) });
      } finally {
        setIsImporting(false);
      }
    },
    [router, t],
  );

  // Extension-mode ticker: flips to timed_out once the grace period elapses.
  useEffect(() => {
    if (mode !== "extension" || extensionState.kind !== "awaiting") {
      return;
    }

    const interval = window.setInterval(() => {
      setExtensionState((previous) =>
        reduceExtensionHandoff(previous, { type: "tick", now: Date.now() }),
      );
    }, EXTENSION_TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [mode, extensionState.kind]);

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

  useEffect(() => {
    const onExtensionImportMessage = (event: MessageEvent<unknown>) => {
      if (event.source !== window || extensionImportInFlightRef.current) {
        return;
      }

      const payload = parseExtensionImportMessage(event.data);
      if (!payload) {
        return;
      }

      extensionImportInFlightRef.current = true;
      setIsImporting(true);
      setError(undefined);
      setExtensionState((previous) =>
        reduceExtensionHandoff(previous, { type: "payload_received", at: Date.now() }),
      );

      // Tell the extension's bridge content script we got the payload so it
      // stops the every-500ms retry loop. Bridge ignores any payload field;
      // a same-origin postMessage with this type is enough.
      window.postMessage({ type: "shadowing-space-extension/ack" }, window.location.origin);

      void (async () => {
        try {
          const bundle = createImportBundleFromExtensionPayload(payload);
          const { effectiveTargetTrackId } = await saveImportBundle(bundle);
          const practiceUrl = `/practice/${bundle.video.id}/${encodeURIComponent(effectiveTargetTrackId)}`;
          router.push(practiceUrl);
        } catch (importError) {
          const display = normalizeApiError(importError);
          setError(display);
          setExtensionState((previous) =>
            reduceExtensionHandoff(previous, {
              type: "failed",
              message: display.message,
            }),
          );
        } finally {
          extensionImportInFlightRef.current = false;
          setIsImporting(false);
        }
      })();
    };

    window.addEventListener("message", onExtensionImportMessage);
    return () => {
      window.removeEventListener("message", onExtensionImportMessage);
    };
  }, [normalizeApiError, router]);

  if (mode === "extension") {
    return (
      <section className="card">
        <h2>{t("title")}</h2>
        <ExtensionHandoffPanel state={extensionState} onSwitchToManual={switchToManual} t={t} />
        {extensionState.kind === "timed_out" || extensionState.kind === "error" ? (
          <FileImportBlock onPick={onImportFromFile} disabled={isImporting} t={t} />
        ) : null}
        {error ? <ErrorBlock error={error} t={t} /> : null}
      </section>
    );
  }

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

      <FileImportBlock onPick={onImportFromFile} disabled={isImporting} t={t} />
    </section>
  );
}
