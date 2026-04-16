# Shadowing Space Importer

A Chrome Manifest V3 extension that imports YouTube captions into Shadowing Space using the viewer's own browser network.

## Install locally

1. Open `chrome://extensions`.
2. Enable `Developer mode`.
3. Click `Load unpacked`.
4. Select this `extension/` folder.

## Usage

1. Open any YouTube **watch** page (`/watch?v=…`).
2. Click the `Shadowing Space` toolbar icon.
3. The popup shows:
   - The current video's title, ID, and thumbnail.
   - A radio-button list of every caption track YouTube exposes (manual + `auto` labels).
   - An inline status area and a **Debug log** (click to expand).
4. Pick the track you want and choose one of two actions:
   - **Send to Shadowing Space** — extracts the track, opens your configured import endpoint, and hands the payload over. The status line updates each step; delivery attempts are logged in the Debug log.
   - **Download JSON** — saves the transcript to a `shadowing-<videoId>-<lang>.json` file. You can re-import this later on the site via the "Import from JSON file" button.

There are **no Chrome notifications**. Every outcome appears inline in the popup and mirrors to the page console (under a `[SS]` prefix) for easy debugging.

## Options page

Right-click the toolbar icon → `Options` (or open from `chrome://extensions`). Choose where transcripts are delivered:

- **Production · shadowing.space** (default)
- **Localhost · http://localhost:3000** — for local `npm run dev`
- **Custom / self-hosted** — any http(s) URL. The first save prompts for host permission.

Settings are stored in `chrome.storage.sync`.

## How it works

- **youtube-main.js** (MAIN world): reads `ytInitialPlayerResponse` and its fallbacks (`ytplayer.config.args.player_response`, `ytd-watch-flexy.__data`), then fetches the selected caption track using the user's own YouTube session.
- **youtube-bridge.js** (ISOLATED world): mediates between the popup's `chrome.tabs.sendMessage` and the MAIN-world script's window events.
- **popup.js**: drives the UX — track listing, action buttons, status line, debug log, and delivery/download.
- **background.js**: install hint only. The popup owns the work because MV3 service workers suspend aggressively and losing state mid-delivery would hide errors.

## Debugging tips

1. Open the popup → click **Debug log** to see a time-stamped record of every step.
2. Right-click the popup → `Inspect` to open DevTools on the popup itself; look at the Console for `[SS]` logs.
3. If the popup reports "Content script unreachable", refresh the YouTube tab — SPA navigation can occasionally leave the bridge inactive.
4. If delivery keeps looping: open the Shadowing Space import tab in DevTools and check the Network tab + console for the delivery handshake.

## Files

```
extension/
├── manifest.json
├── background.js           # install hint only
├── popup.html / popup.js   # primary UI
├── options.html / options.js
├── youtube-bridge.js       # ISOLATED-world bridge
├── youtube-main.js         # MAIN-world extractor
├── shadowing-space-bridge.js # injected on shadowing.space / localhost
├── icons/                  # auto-generated (scripts/extension/generate-icons.mjs)
└── lib/
    ├── endpoint.js         # import URL resolution (unit tested)
    └── player-response.js  # YouTube player data extraction (unit tested)
```

`lib/` is the canonical source for the pure helpers. `youtube-main.js` inlines a matching copy because MV3 manifest-declared scripts cannot `import`. If you edit one, update the other.
