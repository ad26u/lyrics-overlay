# Lyrics Overlay — context for Claude Code

Owner: Ahmad (ad26u). Talk to him in **Arabic**, short and simple.
Repo: `github.com/ad26u/lyrics-overlay` (private). Active branch: **`spike/drawn`** (has everything on `main` + the newest work).

## What the app is

A small Electron app for **Windows 11 and macOS** that stays hidden until a song plays, then:

1. Shows **synced lyrics on the desktop wallpaper layer** (above the wallpaper, below every app window).
2. Shows a **"disc" (الأسطوانة)**: a small round album cover half-hidden on the screen edge, always on top. Hover → it slides out and lists the current song + upcoming songs.

Lyrics come from **LRCLIB** (free, no key). Now-playing comes from the OS (Windows SMTC helper / macOS AppleScript). Spotify login is optional and only adds the upcoming-songs queue.

Inspiration: two Instagram reels (stars-connected lyrics on a MacBook; big lyrics on a wallpaper with a disc + queue on the left).

## Files to read first

- `docs/superpowers/specs/2026-11-21-lyrics-overlay-design.md` — original design (Arabic).
- `docs/superpowers/plans/2026-11-21-lyrics-overlay.md` — the 12-task plan that was implemented.
- `README.md`, `dev/README.md`.

## Layout

```
src/shared/types.ts              NowPlaying, Lyrics, AppSettings, OverlayState, StyleName
src/main/main.ts                 bootstrap; LYRICS_SPIKE=1 runs only the wallpaper spike
src/main/orchestrator.ts         poll loop (1 s playing / 2 s idle), show/hide, fetch lyrics + queue
src/main/lyrics/{lrc,lrclib,cache}.ts   LRC parser, LRCLIB client (+ disk cache), cache key "v2|artist|title|secs"
src/main/playback/clock.ts       position interpolation, currentLineIndex, spreadWords
src/main/nowplaying/{mac,windows,parse,index}.ts
src/main/windows/desktopLayer.ts attach a window to the wallpaper layer (Win: WorkerW via koffi; mac: type 'desktop')
src/main/windows/{lyricsWindow,sideCircleWindow,pages}.ts
src/main/spotify/{auth,queue,wire}.ts   PKCE login on 127.0.0.1:43821, GET /me/player/queue
src/main/{settings,tray}.ts
src/preload/index.ts             window.overlay IPC bridge (built as index.cjs — package is "type":"module")
src/renderer/lyrics/             lyrics page; styles/{stars,big,simple,drawn}.ts; fonts/ (downloaded, gitignored)
src/renderer/circle/             the disc page
helpers/win-media/               .NET 8 SMTC reader (Windows only)
scripts/get-fonts.{sh,ps1}       download Kalam + Marhey into src/renderer/lyrics/fonts
dev/harness.ts, dev/circle-harness.ts, dev/fonts.html   preview styles in a browser without Electron
```

Settings file: `~/Library/Application Support/lyrics-overlay/settings.json` (mac), `%APPDATA%\lyrics-overlay\settings.json` (Win).
Lyrics cache: `<same dir>/lyrics-cache/`.

## Commands

```bash
npm install          # package.json allowScripts lets electron/esbuild/koffi postinstall run (npm 11 blocks them otherwise)
npm run setup        # downloads fonts (Kalam, Marhey)
npm test             # node:test via tsx — 63 tests, all must pass
npx tsc -p tsconfig.core.json   # typecheck the pure-logic modules
npm run dev          # electron-vite dev
LYRICS_SPIKE=1 npm run dev      # only the wallpaper-layer test: red "SPIKE" text on the wallpaper
```

If `npm install` still says scripts were blocked: `npm install-scripts approve electron esbuild koffi && npm rebuild electron esbuild koffi`.

## Rules we follow

- TDD for pure logic: write the failing test, watch it fail, then fix. Tests in `tests/` mirror `src/`.
- Electron-only code can't be unit-tested; verify it by running the app and looking at the screen.
- Commit small, push to `spike/drawn` unless Ahmad says otherwise.
- Don't add colors back — see decisions below.

## What happened on Windows (Ahmad's PC, Win 11 25H2)

- Wallpaper layer works: `attached: true`, text sits on the wallpaper. ✅
- Now-playing helper works (built with .NET 8; note the PC had an old 32-bit dotnet first in PATH — use `C:\Program Files\dotnet\dotnet.exe`). ✅
- Lyrics show and follow the song. ✅
- **Bug found & fixed:** Spotify's release of a song can be several seconds longer/shorter than LRCLIB's (Kiss from a Rose: 283 s vs 288 s). The old 3 s match rejected it and cached a false "no lyrics". Now: accept up to 10 s, pick the closest; cache key bumped to `v2|`.
- "Nothing shows" early in a song is expected: lyrics start when singing starts (e.g. 0:42).

## Decisions Ahmad made (not built yet unless marked)

1. **One color: white only.** Remove cover-derived colors (`colors.ts` palette) from every style. Stars/lines/glow white too.
2. **New style "مرسوم" (drawn)** — ✅ spike built in `styles/drawn.ts`: hand-drawn white text that "boils" like the game OMORI (SVG feTurbulence + feDisplacementMap, seed switches every 140 ms). Font **Kalam** (Latin) and **Marhey** (Arabic), soft dark shadow for readability. Smaller than full-screen, centered. Spike also forces full-screen lyrics bounds (`lyricsWindow.ts defaultBounds`) — revisit when the size control exists.
3. **Size is controlled by the user, per style**, saved in settings.
4. **All controls live in the disc (الأسطوانة):**
   - hover → current song + upcoming songs (exists);
   - click → small panel: the 4 styles, a size slider (− ●──── +) with live preview, "حرك الكلمات" (move: lift the lyrics window above apps, drag, "تم" puts it back), "إخفاء" (hide).
   - Tray menu keeps only: open at login, quit.
5. **Smoothness (proposed, Ahmad hasn't objected):** new word fades/rises in ~250 ms; old line dissolves upward while the new one enters from below; three white "breathing" dots during intros/instrumentals before the first line.
6. **Upcoming songs** need a Spotify developer app: Ahmad creates it at developer.spotify.com, redirect URI `http://127.0.0.1:43821/callback`, puts the Client ID in `.env` as `MAIN_VITE_SPOTIFY_CLIENT_ID`. Help him do it.

Next step in the process: write the design doc for points 1–6 (`docs/superpowers/specs/`), get Ahmad's OK, write a plan, then build.

## Doing it on the Mac (MacBook Neo, Apple silicon)

Nothing has run on macOS yet. Expected differences / risks:

- Now-playing uses `osascript` against **Spotify** and **Music** only (Apple blocked MediaRemote for third-party apps in macOS 15.4+). First run triggers an **Automation permission** prompt — Ahmad must allow it.
- Music.app gives no artwork URL → disc shows a blank cover for Music songs.
- Wallpaper layer uses `BrowserWindow({ type: 'desktop' })` + `setVisibleOnAllWorkspaces`. Verify with `LYRICS_SPIKE=1 npm run dev`: SPIKE must sit above the wallpaper, below windows, on every Space.
- Edit mode on mac uses `setAlwaysOnTop(true, 'floating')` on a desktop-type window — untested; may need to recreate the window as a normal one while editing.
- The disc window: transparent, `alwaysOnTop('screen-saver')`, click-through except the disc (`setIgnoreMouseEvents(true, { forward: true })`). Check hover works.
- `koffi` and `helpers/win-media` are Windows-only; ignore them on mac.
- Packaging later: `npm run dist:mac` (dmg, arm64), `LSUIElement` hides the Dock icon.

Suggested first session on the Mac:
1. `git clone https://github.com/ad26u/lyrics-overlay && cd lyrics-overlay && git checkout spike/drawn`
2. `npm install && npm run setup && npm test`
3. `LYRICS_SPIKE=1 npm run dev` → check SPIKE on the wallpaper, report to Ahmad.
4. Play a song in Spotify, `npm run dev`, confirm lyrics + disc. Fix what breaks (systematic debugging: find the cause first).
5. Then continue with the design doc for decisions 1–6.
