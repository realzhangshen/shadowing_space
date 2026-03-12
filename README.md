# Shadowing Space

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A free, open-source YouTube-based **shadowing practice** tool. Listen to native speakers, record yourself repeating, and compare side-by-side to improve pronunciation, rhythm, and fluency.

**Live:** [shadowing.space](https://shadowing.space)

## Features

- Import any YouTube video URL and fetch available caption tracks
- Sentence-by-sentence shadowing with manual controls (play/pause, prev/next)
- Browser-based recording with A/B replay (Original vs My Recording)
- Speed presets: 0.75x / 1.0x / 1.25x / 1.5x
- Local history and session resume (IndexedDB via Dexie)
- Structured JSON server logs with request tracing

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
npm run test         # Run main test suite
npm run test:all     # Main + diagnostic tests
npm run test:catalog # Catalog coverage check
npm run build        # Production build
```

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
