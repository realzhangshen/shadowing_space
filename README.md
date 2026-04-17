# Shadowing Space

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A free, open-source YouTube-based **shadowing practice** tool. Listen to native speakers, record yourself repeating, and compare side-by-side to improve pronunciation, rhythm, and fluency.

**Live:** [shadowing.space](https://shadowing.space)

## Features

- Import any YouTube video URL and fetch available caption tracks (server-side fetch or via the browser extension)
- Four practice modes on the same segment list:
  - **Manual** — press record per sentence, then review
  - **Auto** — play → record → auto-advance, hands-free shadowing
  - **Free** — record a continuous range of sentences as one take
  - **Listen** — play segments back-to-back with optional mid-stream "Shadow this one" capture
- Browser-based recording with A/B replay (Original vs My Recording) and a live scrolling waveform
- Speed controls: presets (0.5×–1.5×) plus a custom numeric input that snaps to the nearest player-supported rate
- Vocabulary capture — select a word in the transcript, save it with sentence context, browse per-video
- Study-time tracking — active foreground minutes roll up into a dashboard summary per video and per day
- Local-first storage: session resume, history, recordings, and vocabulary all live in IndexedDB via Dexie
- Keyboard shortcuts for every transport action (see [Shortcuts](#keyboard-shortcuts))
- Virtualized sentence list stays smooth on long (1000+ segment) lectures
- Structured JSON server logs with end-to-end `x-request-id` tracing
- Segment-level React error boundaries keep one broken panel from blanking the whole page
- PWA — installable on mobile and desktop
- Multi-language UI (English, 简体中文, 繁體中文, 日本語, Русский) with a CI gate that fails the build on missing/extra keys
- Companion Chrome extension for pages where server-side fetch is blocked (see [`extension/README.md`](extension/README.md))

## Tech Stack

- **Framework:** [Next.js](https://nextjs.org) (App Router + Route Handlers)
- **Language:** TypeScript
- **State:** [Zustand](https://github.com/pmndrs/zustand)
- **Local storage:** [Dexie](https://dexie.org) (IndexedDB)
- **Validation:** [Zod](https://zod.dev)
- **Analytics:** [@vercel/analytics](https://vercel.com/analytics) + [@vercel/speed-insights](https://vercel.com/docs/speed-insights) (auto-detected on Vercel, renders nothing elsewhere)

## Getting Started

```bash
git clone https://github.com/realzhangshen/shadowing_space.git
cd shadowing_space
npm install
cp .env.example .env.local   # edit as needed
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

All variables are optional for local development. See [`.env.example`](.env.example) for the full list.

| Variable                             | Default                   | Description                                               |
| ------------------------------------ | ------------------------- | --------------------------------------------------------- |
| `NEXT_PUBLIC_SITE_URL`               | `https://shadowing.space` | Site URL for SEO / Open Graph metadata                    |
| `YOUTUBE_PROXY_URLS`                 | _(none)_                  | Comma-separated proxy URLs for YouTube fetches            |
| `YOUTUBE_FETCH_TIMEOUT_MS`           | `15000`                   | Timeout for YouTube requests (ms)                         |
| `TRANSCRIPT_RATE_LIMIT_MAX_REQUESTS` | `30`                      | Max transcript requests per rate limit window             |
| `TRANSCRIPT_RATE_LIMIT_WINDOW_MS`    | `60000`                   | Rate limit window (ms)                                    |
| `TRACK_TOKEN_SECRET`                 | `shadowing-dev-secret`    | **Required in production.** Signs transcript track tokens |
| `TRACK_TOKEN_TTL_SECONDS`            | `86400`                   | Track token time-to-live (seconds)                        |
| `LOG_LEVEL`                          | `info`                    | Server log level: `debug` / `info` / `warn` / `error`     |

## Self-Hosting

### Vercel (recommended)

1. Fork this repository
2. Import the project into [Vercel](https://vercel.com/new)
3. Set environment variables in the Vercel dashboard (at minimum, `TRACK_TOKEN_SECRET`)
4. Deploy

Vercel Analytics and Speed Insights activate automatically on Vercel and are inert elsewhere.

### Docker / VPS

```bash
npm install
npm run build
npm start
```

Set all required environment variables (especially `TRACK_TOKEN_SECRET`) before running `npm start`. The app listens on port 3000 by default.

## Development

```bash
npm run dev          # Start dev server
npm run typecheck    # TypeScript check
npm run lint         # ESLint
npm run lint:fix     # ESLint with autofix
npm run format       # Prettier write
npm run format:check # Prettier check (read-only)
npm run i18n:check   # Diff locale key sets against en.json
npm run test         # Run main test suite
npm run test:all     # Main + diagnostic tests
npm run test:catalog # Catalog coverage check
npm run ci:local     # typecheck + lint + format:check + i18n:check + test + build
npm run build        # Production build
```

Before opening a PR, `npm run ci:local` is the single command that must pass.

## Architecture

```
app/                     Next.js App Router
├── [locale]/            Localized routes (home, import, practice, dashboard, guide)
├── api/                 Route handlers (proxy-health + transcript fetch/segments)
└── globals.css          Global styles

src/
├── components/          Reusable UI (PlaybackControlBar, SegmentNavigator, WaveformCanvas, ErrorBoundary, …)
├── features/
│   ├── practice/        PracticeClient + mode capabilities, listen/free helpers, segment watcher
│   ├── import/          Import flow (URL + extension handoff + JSON upload)
│   ├── history/         Dashboard + summaries (practice / study sessions)
│   ├── storage/         Dexie db + split repository modules (ids / recordings / vocabulary / studySessions / videos)
│   └── vocabulary/      Word cleaning + normalization helpers
├── hooks/               Shared React hooks (recorder, live waveform, practice actions, shortcuts, …)
├── i18n/                next-intl navigation + request config
├── lib/                 Framework-agnostic utilities
├── server/              Server-only code (logger, rate limit, errors, YouTube scraping)
├── store/               Zustand practice store
└── types/               Shared TypeScript types

extension/               MV3 Chrome extension (optional transcript importer)
messages/                Per-locale JSON (en, ja, ru, zh-Hans, zh-Hant)
scripts/
├── i18n/                check.ts (locale drift gate)
└── tests/               status.ts (catalog-driven test runner)
tests/                   Mirrors src/, plus catalog.yaml for governance
```

Storage is local-first: every recording, vocabulary entry, and study session lives in the user's browser (Dexie schema versioned v1 → v5). The server only mediates YouTube transcript fetches.

## Keyboard Shortcuts

All shortcuts are active on the practice page while focus is outside inputs.

| Key       | Action                                                  |
| --------- | ------------------------------------------------------- |
| `Space`   | Play / pause source (in Auto mode: start shadow take)   |
| `R`       | Start / stop recording (in Listen mode: shadow current) |
| `A`       | Play original segment                                   |
| `B`       | Play latest recording                                   |
| `←` / `→` | Previous / next segment                                 |
| `T`       | Toggle transcript visibility                            |
| `M`       | Cycle practice flow (Manual → Auto → Free → Listen)     |
| `F`       | Start / stop a Free or Listen session                   |

## API Endpoints

| Method | Endpoint                           | Description                                        |
| ------ | ---------------------------------- | -------------------------------------------------- |
| `POST` | `/api/youtube/transcript/fetch`    | Fetch available caption tracks for a YouTube video |
| `POST` | `/api/youtube/transcript/segments` | Fetch transcript segments for a specific track     |
| `GET`  | `/api/proxy-health`                | Check YouTube proxy connectivity                   |

### Debugging

API responses include an `x-request-id` header. Server logs are structured JSON with the same `requestId` for end-to-end tracing. Set `LOG_LEVEL=debug` for step-by-step diagnostics.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

[MIT](LICENSE)
