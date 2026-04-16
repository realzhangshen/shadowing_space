# Shadowing Space Importer

A Chrome Manifest V3 extension that imports YouTube captions into Shadowing Space using the viewer's own browser network.

## What it does

1. You open a normal YouTube watch page.
2. You click the extension action.
3. The extension reads the current video's caption metadata inside `youtube.com`.
4. It fetches one preferred caption track using the user's own browser session and IP.
5. It opens your configured Shadowing Space import URL and hands the transcript payload to the app.
6. The app stores the imported video locally and jumps into practice.

## Why this approach

- The fragile part of YouTube transcript access runs on `youtube.com`, not on Vercel/Cloudflare.
- Requests go out from the end user's browser, which tends to have a cleaner reputation than cloud IP ranges.
- The main app stays local-first. It only receives a structured payload and saves it to IndexedDB.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this `extension/` folder.

## Usage

1. Open a YouTube video page with captions.
2. Click the `Shadowing Space Importer` toolbar icon.
   - The toolbar badge shows status: `…` while working, `✓` on success, `!` on failure.
   - Errors are delivered via Chrome notifications with the actual error message.
3. Wait for the Shadowing Space import page to open.
4. If extraction succeeds, the app should redirect into the practice session automatically.

## Options page

Open the extension's **Options** page (right-click the toolbar icon → `Options`, or from `chrome://extensions`) to choose where transcripts are delivered:

- **Production · shadowing.space** (default)
- **Localhost · http://localhost:3000** — for local `npm run dev`
- **Custom / self-hosted** — any http(s) URL. The first save will prompt for host permission.

Settings are synced via `chrome.storage.sync`.

## Feedback & status

- Success → badge `✓` for 4 s, then clears.
- Failure → badge `!` for 8 s + a Chrome notification with the error text.
- Non-YouTube page → a notification reminding you to open a watch page.

## Visual assets

Icons in `icons/` are auto-generated solid-color PNGs by `scripts/extension/generate-icons.mjs`. Run `node scripts/extension/generate-icons.mjs` to regenerate them; swap in branded artwork at the same paths to rebrand.

## Development notes

- The default destination is `https://shadowing.space/en/import?source=extension`. Override via the options page, not by editing source.
- End-to-end extension flow is not covered by automated tests; only `extension/lib/endpoint.js` (endpoint resolution) and the app-side payload contract are tested.
- The extension uses `world: "MAIN"` content script isolation to read `ytInitialPlayerResponse`. The isolated world bridge (`youtube-bridge.js`) mediates between main-world extraction and the extension background service worker.
