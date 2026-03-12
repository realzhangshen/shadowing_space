export class AppError extends Error {
  statusCode: number;
  errorCode: string;
  details: Record<string, unknown>;

  constructor(
    message: string,
    statusCode: number,
    errorCode = "UNKNOWN_ERROR",
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details;
  }
}

export class InvalidVideoUrlError extends AppError {
  constructor(url: string) {
    super("Only single YouTube video URLs are supported", 422, "INVALID_VIDEO_URL", { url });
    this.name = "InvalidVideoUrlError";
  }
}

export class VideoUnavailableError extends AppError {
  constructor(videoId: string, cause?: string) {
    super("This video is unavailable", 404, "VIDEO_UNAVAILABLE", { videoId, cause });
    this.name = "VideoUnavailableError";
  }
}

export class TranscriptsDisabledError extends AppError {
  constructor(videoId: string) {
    super("Transcripts are disabled for this video", 404, "TRANSCRIPTS_DISABLED", { videoId });
    this.name = "TranscriptsDisabledError";
  }
}

export class NoCaptionTracksError extends AppError {
  constructor(videoId: string, strategiesAttempted: string[]) {
    super("No caption tracks available for this video", 404, "NO_CAPTION_TRACKS", {
      videoId,
      strategiesAttempted,
    });
    this.name = "NoCaptionTracksError";
  }
}

export class CaptionContentEmptyError extends AppError {
  constructor(videoId: string, languageCode: string) {
    super("Caption content is empty", 404, "CAPTION_CONTENT_EMPTY", { videoId, languageCode });
    this.name = "CaptionContentEmptyError";
  }
}

export class CaptionParsingFailedError extends AppError {
  constructor(videoId: string, reason: string) {
    super(`Caption parsing failed: ${reason}`, 502, "CAPTION_PARSING_FAILED", { videoId, reason });
    this.name = "CaptionParsingFailedError";
  }
}

export class YouTubeUpstreamError extends AppError {
  constructor(videoId: string, step: string, httpStatus?: number, networkCause?: string) {
    const parts = [`Unable to reach YouTube (${step})`];
    if (httpStatus) parts.push(`HTTP ${httpStatus}`);
    if (networkCause) parts.push(networkCause);
    super(parts.join(": "), 502, "YOUTUBE_UPSTREAM_ERROR", {
      videoId,
      step,
      ...(httpStatus !== undefined && { httpStatus }),
      ...(networkCause !== undefined && { networkCause }),
    });
    this.name = "YouTubeUpstreamError";
  }
}

export class TooManyRequestsError extends AppError {
  constructor() {
    super("Too many requests, please retry later", 429, "TOO_MANY_REQUESTS");
    this.name = "TooManyRequestsError";
  }
}

export class TrackTokenInvalidError extends AppError {
  constructor(reason: string) {
    super("Track token is invalid", 400, "TRACK_TOKEN_INVALID", { reason });
    this.name = "TrackTokenInvalidError";
  }
}

export class TrackTokenExpiredError extends AppError {
  constructor() {
    super("Track token has expired, please re-fetch tracks", 400, "TRACK_TOKEN_EXPIRED");
    this.name = "TrackTokenExpiredError";
  }
}

export function toMessage(error: unknown, fallback: string): string {
  if (error instanceof AppError) {
    return error.message;
  }

  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallback;
}
