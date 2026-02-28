import type {
  FetchTranscriptRequest,
  FetchTranscriptResponse,
  ResolveTranscriptRequest,
  ResolveTranscriptResponse
} from "@/types/api";

export class ApiError extends Error {
  status: number;
  requestId?: string;

  constructor(message: string, status: number, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.requestId = requestId;
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
    throw new ApiError(message, response.status, requestId);
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
