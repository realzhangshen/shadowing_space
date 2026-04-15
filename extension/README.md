# Shadowing Space Importer

This is an experimental Chrome Manifest V3 extension that imports YouTube captions into Shadowing Space using the viewer's own browser network.

## What it does

1. You open a normal YouTube watch page.
2. You click the extension action.
3. The extension reads the current video's caption metadata inside `youtube.com`.
4. It fetches one preferred caption track using the user's own browser session and IP.
5. It opens `https://shadowing.space/en/import` and hands the transcript payload to the app.
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
3. Wait for the Shadowing Space import page to open.
4. If extraction succeeds, the app should redirect into the practice session automatically.

## Development notes

- The default target page is `https://shadowing.space/en/import`.
- For local app testing, change `DEFAULT_IMPORT_URL` in [background.js](./background.js) to `http://localhost:3000/en/import?source=extension`.
- This MVP chooses one preferred caption track instead of exposing a full track picker inside the extension.
- End-to-end extension flow is not covered by automated tests yet; only the app-side payload contract is tested.
