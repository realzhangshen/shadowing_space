# Shadowing Web App (Next.js)

English shadowing web app rebuilt as a single Next.js full-stack project.

## Stack
- Next.js (App Router + Route Handlers)
- TypeScript
- Zustand (practice session state)
- Dexie + IndexedDB (local persistence)
- zod (request validation)

## Features
- Import a single YouTube video URL
- Fetch available caption tracks from YouTube
- Choose one track and start sentence-by-sentence shadowing
- Manual sentence controls (play/pause, prev/next)
- Browser recording and A/B replay (Original vs My Recording)
- Fixed speed presets: `0.75x / 1.0x / 1.25x / 1.5x`
- Local history and resume from last sentence

## API
- `POST /api/youtube/transcript/fetch`
  - Request: `{ url, preferredLanguage? }`
  - Response: `{ videoId, title, durationSec?, thumbnailUrl?, tracks, defaultTrackToken }`
- `POST /api/youtube/transcript/segments`
  - Request: `{ videoId, trackToken }`
  - Response: `{ videoId, track, segments }`

## Environment Variables
- `YOUTUBE_FETCH_TIMEOUT_MS` (default `15000`)
- `TRANSCRIPT_RATE_LIMIT_MAX_REQUESTS` (default `30`)
- `TRANSCRIPT_RATE_LIMIT_WINDOW_MS` (default `60000`)
- `TRACK_TOKEN_SECRET` (default `shadowing-dev-secret`)
- `TRACK_TOKEN_TTL_SECONDS` (default `86400`)
- `LOG_LEVEL` (`debug` / `info` / `warn` / `error`, default `info`)

## Run
```bash
npm install
npm run dev
```

Open: [http://localhost:3000](http://localhost:3000)

## Check
```bash
npm run typecheck
npm run test
```

## Debugging
- API responses now include `x-request-id` header (and `requestId` in error JSON payload).
- The server prints structured JSON logs with the same `requestId`, so you can quickly trace a failed `fetch`/`segments` call end-to-end.
- Set `LOG_LEVEL=debug` only when you need full step-by-step diagnostics.
