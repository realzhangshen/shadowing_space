import type {
  FetchTranscriptRequest,
  FetchTranscriptResponse,
  ProxyHealthResponse,
  ResolveTranscriptRequest,
  ResolveTranscriptResponse
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  requestId?: string;
  errorCode?: string;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, requestId?: string, errorCode?: string, details?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
    this.errorCode = errorCode;
    this.details = details;
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payloadText = await response.text();
  let payload: Record<string, unknown> = {};

  if (payloadText) {
    try {
      payload = JSON.parse(payloadText) as Record<string, unknown>;
    } catch {
      payload = { message: payloadText };
    }
  }

  if (!response.ok) {
    const message = typeof payload.message === "string" ? payload.message : "Request failed";
    const requestId = typeof payload.requestId === "string" ? payload.requestId : undefined;
    const errorCode = typeof payload.errorCode === "string" ? payload.errorCode : undefined;
    const details = typeof payload.details === "object" && payload.details !== null
      ? payload.details as Record<string, unknown>
      : undefined;
    throw new ApiError(message, response.status, requestId, errorCode, details);
  }

  return payload as T;
}

export async function fetchTranscriptTracks(input: FetchTranscriptRequest): Promise<FetchTranscriptResponse> {
  const response = await fetch("/api/youtube/transcript/fetch", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<FetchTranscriptResponse>(response);
}

export async function fetchProxyHealth(): Promise<ProxyHealthResponse> {
  const response = await fetch("/api/proxy-health");
  return parseResponse<ProxyHealthResponse>(response);
}

export async function fetchTranscriptSegments(input: ResolveTranscriptRequest): Promise<ResolveTranscriptResponse> {
  const response = await fetch("/api/youtube/transcript/segments", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(input)
  });

  return parseResponse<ResolveTranscriptResponse>(response);
}
