import { NextResponse } from "next/server";
import { ZodError } from "zod";

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

export function toErrorResponse(
  error: unknown,
  requestId: string,
  headers: Record<string, string>,
): NextResponse {
  let statusCode: number;
  let message: string;
  let errorCode: string | undefined;
  let details: Record<string, unknown> | undefined;

  if (error instanceof AppError) {
    statusCode = error.statusCode;
    message = error.message;
    errorCode = error.errorCode;
    details = error.details;
  } else if (error instanceof ZodError) {
    statusCode = 400;
    message = "Invalid request body";
    details = { fields: error.flatten().fieldErrors };
  } else if (error instanceof SyntaxError) {
    statusCode = 400;
    message = "Malformed JSON in request body";
  } else {
    statusCode = 500;
    message = "Internal server error";
  }

  return NextResponse.json(
    {
      message,
      requestId,
      ...(errorCode && { errorCode }),
      ...(details && Object.keys(details).length > 0 && { details }),
    },
    {
      status: statusCode,
      headers,
    },
  );
}
