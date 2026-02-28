export const SHARED_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
  "Accept-Language": "en-US,en;q=0.9"
};

function isAbortError(error: unknown): boolean {
  return typeof error === "object" && error !== null && "name" in error && error.name === "AbortError";
}

function mapNetworkCode(code: string, fallback: string): string {
  if (code === "ENOTFOUND") {
    return `${fallback}: DNS failed`;
  }
  if (code === "ECONNRESET") {
    return `${fallback}: connection reset`;
  }
  if (code === "ECONNREFUSED") {
    return `${fallback}: connection refused`;
  }
  if (code === "ETIMEDOUT") {
    return `${fallback}: request timed out`;
  }
  return fallback;
}

export function describeFetchError(error: unknown, fallback: string): string {
  if (isAbortError(error)) {
    return `${fallback}: request timed out`;
  }

  if (typeof error === "object" && error !== null && "cause" in error) {
    const cause = (error as { cause?: unknown }).cause;
    if (typeof cause === "object" && cause !== null && "code" in cause) {
      const code = (cause as { code?: unknown }).code;
      if (typeof code === "string") {
        return mapNetworkCode(code, fallback);
      }
    }
  }

  if (error instanceof Error && error.message) {
    return `${fallback}: ${error.message}`;
  }

  return fallback;
}

export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
      cache: "no-store"
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchWithProxy(
  input: string,
  init: RequestInit,
  timeoutMs: number,
  proxyUrl?: string
): Promise<Response> {
  if (!proxyUrl) {
    return fetchWithTimeout(input, init, timeoutMs);
  }

  const { ProxyAgent, fetch: undiciFetch } = await import("undici");
  const dispatcher = new ProxyAgent(proxyUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  try {
    const headers: Record<string, string> = {
      ...(init.headers as Record<string, string> | undefined),
      Connection: "close"
    };

    const res = await undiciFetch(input, {
      method: init.method,
      headers,
      body: init.body as string | undefined,
      signal: controller.signal,
      dispatcher
    });

    // Wrap undici response to match global Response interface
    const bodyText = await res.text();
    return new Response(bodyText, {
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries(res.headers.entries())
    });
  } finally {
    clearTimeout(timeout);
  }
}
