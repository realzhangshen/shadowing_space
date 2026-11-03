import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

import { restrictRuntimeCachingToSameOrigin } from "./lib/swRuntimeCaching";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope & typeof globalThis;

// Serwist's `defaultCache` matchers (e.g. the global image regex) also match
// cross-origin URLs such as YouTube thumbnails. The worker's `fetch()` is
// subject to the CSP served with `/sw.js`, whose `connect-src` does not allow
// those hosts, so intercepting them breaks image loading. Restrict every rule
// to the worker origin so cross-origin requests go straight to the browser,
// where the page's `img-src` governs them.
const runtimeCaching = restrictRuntimeCachingToSameOrigin(defaultCache, self.location.origin);

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching,
  // Universal /offline fallback — the SW doesn't have locale context at registration time,
  // so we serve a single page for all locales rather than locale-prefixed paths.
  fallbacks: {
    entries: [
      {
        url: "/offline",
        matcher({ request }) {
          return request.destination === "document";
        },
      },
    ],
  },
});

serwist.addEventListeners();
