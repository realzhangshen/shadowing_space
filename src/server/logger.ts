import { AppError } from "@/server/errors";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogMetadata = Record<string, unknown>;

const LOG_LEVEL_RANK: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function readLogLevel(): LogLevel {
  const raw = process.env.LOG_LEVEL?.trim().toLowerCase();
  if (raw === "debug" || raw === "info" || raw === "warn" || raw === "error") {
    return raw;
  }
  return "info";
}

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVEL_RANK[level] >= LOG_LEVEL_RANK[readLogLevel()];
}

function serializeError(error: unknown): Record<string, unknown> {
  if (error instanceof AppError) {
    return {
      name: error.name,
      message: error.message,
      statusCode: error.statusCode,
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
    };
  }

  return { value: error };
}

function normalizeValue(value: unknown): unknown {
  if (value === undefined) {
    return null;
  }

  if (value instanceof Error || value instanceof AppError) {
    return serializeError(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((entry) => normalizeValue(entry));
  }

  if (value && typeof value === "object") {
    const objectValue = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(objectValue)) {
      normalized[key] = normalizeValue(entry);
    }
    return normalized;
  }

  if (typeof value === "string" && value.length > 160) {
    return `${value.slice(0, 160)}...<trimmed:${value.length - 160}>`;
  }

  return value;
}

function emit(level: LogLevel, event: string, metadata: LogMetadata): void {
  if (!shouldLog(level)) {
    return;
  }

  const normalizedMetadata = normalizeValue(metadata);
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...(typeof normalizedMetadata === "object" && normalizedMetadata
      ? (normalizedMetadata as Record<string, unknown>)
      : {}),
  };

  const line = JSON.stringify(payload);
  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export type RequestLogger = {
  requestId: string;
  route: string;
  debug: (event: string, metadata?: LogMetadata) => void;
  info: (event: string, metadata?: LogMetadata) => void;
  warn: (event: string, metadata?: LogMetadata) => void;
  error: (event: string, metadata?: LogMetadata) => void;
};

export function createRequestLogger(params: { requestId: string; route: string }): RequestLogger {
  const { requestId, route } = params;
  const base = { requestId, route };

  return {
    requestId,
    route,
    debug(event, metadata = {}) {
      emit("debug", event, { ...base, ...metadata });
    },
    info(event, metadata = {}) {
      emit("info", event, { ...base, ...metadata });
    },
    warn(event, metadata = {}) {
      emit("warn", event, { ...base, ...metadata });
    },
    error(event, metadata = {}) {
      emit("error", event, { ...base, ...metadata });
    },
  };
}
