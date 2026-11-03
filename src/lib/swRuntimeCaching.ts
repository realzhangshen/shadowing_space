/**
 * Pure helpers that keep Serwist's runtime caching same-origin only.
 *
 * Serwist's `defaultCache` contains rules whose matchers (notably the global
 * image regex `/\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i`) also match cross-origin
 * URLs such as YouTube thumbnails on `i.ytimg.com`. The service worker handler
 * then calls `fetch()` inside the worker, but `/sw.js` is served with the site
 * CSP whose `connect-src` does not allow those hosts, so every such fetch throws
 * `TypeError: Failed to fetch` and the image request fails. Browser-level
 * `<img>` loads are governed by the page CSP (`img-src`) instead, so the fix is
 * to never intercept cross-origin requests in the worker.
 *
 * This module intentionally has no serwist imports so it can be unit-tested in
 * plain Node.
 */

/** Options passed to a runtime-caching matcher; only `url` is needed here. */
export interface MatcherOptions {
  url: URL;
}

/** A runtime-caching matcher that first requires the request to be same-origin. */
export type SameOriginMatcher = (options: MatcherOptions) => boolean;

/** An entry whose matcher now only matches same-origin requests. */
export type SameOriginEntry<TEntry extends { matcher: unknown }> = Omit<TEntry, "matcher"> & {
  matcher: SameOriginMatcher;
};

/**
 * Returns true when `url` resolves to the same origin as `origin`.
 *
 * Relative and protocol-relative URLs are resolved against `origin`, mirroring
 * how the service worker receives absolute request URLs. Unparsable input is
 * treated as cross-origin so a malformed URL can never be cached.
 */
export function isSameOriginUrl(url: string, origin: string): boolean {
  let workerOrigin: URL;
  let target: URL;

  try {
    workerOrigin = new URL(origin);
    target = new URL(url, workerOrigin);
  } catch {
    return false;
  }

  return target.origin === workerOrigin.origin;
}

/**
 * Wraps a Serwist runtime-caching matcher so it only matches same-origin URLs.
 *
 * Cross-origin requests are rejected before the original matcher runs; matches
 * made by the wrapped matcher are delegated to the original matcher exactly as
 * Serwist would: `RegExp` is tested against the full `url.href`, a `string` is
 * compared against the URL resolved relative to the worker origin, and a
 * function receives the original options object.
 */
export function sameOriginOnlyMatcher(matcher: unknown, origin: string): SameOriginMatcher {
  return (options) => {
    if (!isSameOriginUrl(options.url.href, origin)) {
      return false;
    }

    if (matcher instanceof RegExp) {
      return matcher.test(options.url.href);
    }

    if (typeof matcher === "string") {
      try {
        return new URL(matcher, origin).href === options.url.href;
      } catch {
        return false;
      }
    }

    if (typeof matcher === "function") {
      const delegate = matcher as (options: MatcherOptions) => unknown;
      return Boolean(delegate(options));
    }

    return false;
  };
}

/**
 * Returns copies of the given runtime-caching entries whose matchers only match
 * same-origin requests. Entry order is preserved, the input array and its
 * entries are left untouched, and all other fields (handler, method, …) are
 * copied over.
 */
export function restrictRuntimeCachingToSameOrigin<TEntry extends { matcher: unknown }>(
  entries: readonly TEntry[],
  origin: string,
): SameOriginEntry<TEntry>[] {
  return entries.map((entry) => ({
    ...entry,
    matcher: sameOriginOnlyMatcher(entry.matcher, origin),
  }));
}
