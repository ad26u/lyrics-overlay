# Lyrics Overlay Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tray/menu-bar Electron app for Windows 11 and macOS that shows synced lyrics on the desktop wallpaper layer while a song plays, plus an always-on-top side circle that slides out on hover to show the current and upcoming songs.

**Architecture:** The main process polls a platform "now playing" source, fetches and caches synced lyrics from LRCLIB, and pushes state over IPC to two windows: a click-through lyrics window parented to the wallpaper layer, and a small always-on-top side-circle window. Lyric styles are self-contained renderer modules behind one interface. Spotify login is optional and only adds the upcoming-songs queue.

**Tech Stack:** Electron 33+, TypeScript, Vite (electron-vite), Vitest, koffi (Win32 FFI), a .NET 8 console helper for Windows media (SMTC), `osascript` on macOS, electron-builder.

**Spec:** `docs/superpowers/specs/2026-11-21-lyrics-overlay-design.md`

## Global Constraints

- Platforms: Windows 11 (incl. 24H2+) and macOS on Apple silicon (MacBook Neo). One codebase.
- Core features work with **no login**. Spotify login only adds the queue.
- Lyrics source: LRCLIB only (`https://lrclib.net/api/get`, then `/api/search`). No API key.
- macOS now-playing: AppleScript for Spotify and Music only. Do not use MediaRemote.
- Idle (nothing playing): both windows hidden, no animation frames, now-playing poll every 2000 ms.
- Playing: now-playing poll every 1000 ms; position interpolated locally between polls.
- Lyrics window never takes mouse input except in edit mode.
- Arabic lyrics render RTL.
- No audio-reactive visualizer, no translation, no playback, no Spotify modification.

## Review Focus

1. **Song with no synced lyrics (plain only, or none)** → lyrics window stays hidden, no error dialog, no retry storm. Test in Task 4.
2. **User seeks or pauses mid-song** → current line follows on the next poll; paused freezes the line. Test in Task 3.
3. **Arabic / mixed RTL lyrics** → line direction is RTL, word order in the Stars style follows reading order. Test in Task 7.
4. **Player closed / app quits mid-song** → windows fade out within one poll; idle CPU rules apply. Test in Task 10.
5. **Monitor unplugged or resolution changed** → saved lyrics bounds are clamped back onto a visible display. Test in Task 5.

---

## File Structure

```
package.json, electron.vite.config.ts, tsconfig.json, vitest.config.ts
src/shared/types.ts            NowPlaying, LyricLine, LyricWord, Lyrics, AppSettings, OverlayState
src/main/main.ts               app bootstrap, single-instance lock
src/main/orchestrator.ts       poll loop, show/hide, IPC broadcast
src/main/tray.ts               tray / menu-bar menu
src/main/settings.ts           JSON settings in userData + bounds clamping
src/main/lyrics/lrc.ts         LRC parser (line + enhanced word tags)
src/main/lyrics/lrclib.ts      LRCLIB client
src/main/lyrics/cache.ts       disk cache
src/main/playback/clock.ts     position interpolation + current line lookup
src/main/nowplaying/index.ts   picks platform source
src/main/nowplaying/mac.ts     osascript source + output parser
src/main/nowplaying/windows.ts spawns helper, parses JSON lines
src/main/windows/desktopLayer.ts  attach a BrowserWindow to wallpaper layer
src/main/windows/lyricsWindow.ts
src/main/windows/sideCircleWindow.ts
src/main/spotify/auth.ts       PKCE login, token refresh
src/main/spotify/queue.ts      GET /me/player/queue
src/preload/index.ts           contextBridge: onState, onEditMode, finishEdit, hover
src/renderer/lyrics/index.html, main.ts
src/renderer/lyrics/styles/types.ts   LyricStyle interface
src/renderer/lyrics/styles/stars.ts, big.ts, simple.ts
src/renderer/lyrics/text.ts    isRtl, splitWords
src/renderer/lyrics/colors.ts  palette from cover
src/renderer/circle/index.html, main.ts, circle.css
helpers/win-media/             .NET 8 console app (SMTC → JSON lines)
tests/...                      mirrors src
```

---

### Task 1: Scaffold + shared types + LRC parser

**Files:**
- Create: `package.json`, `electron.vite.config.ts`, `tsconfig.json`, `vitest.config.ts`, `src/shared/types.ts`, `src/main/lyrics/lrc.ts`
- Test: `tests/main/lyrics/lrc.test.ts`

**Interfaces:**
- Produces:
  - `type LyricWord = { text: string; startMs: number }`
  - `type LyricLine = { startMs: number; text: string; words: LyricWord[] }`
  - `type Lyrics = { synced: boolean; lines: LyricLine[] }`
  - `type NowPlaying = { title: string; artist: string; album: string; durationMs: number; positionMs: number; playing: boolean; coverUrl?: string; coverDataUrl?: string; source: 'spotify' | 'music' | 'smtc' }`
  - `type AppSettings = { enabled: boolean; style: 'stars' | 'big' | 'simple'; lyricsBounds?: { x: number; y: number; width: number; height: number; displayId: number }; circleSide: 'left' | 'right'; openAtLogin: boolean; spotify?: { refreshToken: string } }`
  - `type OverlayState = { nowPlaying: NowPlaying | null; lyrics: Lyrics | null; lineIndex: number; positionMs: number; queue: { title: string; artist: string; coverUrl?: string }[] }`
  - `parseLrc(text: string): LyricLine[]` — sorted by `startMs`, blank lines dropped.

- [ ] **Step 1:** Scaffold with electron-vite (TypeScript template), add vitest, `npm test` runs vitest.
- [ ] **Step 2: Write failing tests** in `lrc.test.ts`:
  - `parses line timestamps`: `"[00:12.50]hello world"` → `[{startMs:12500,text:'hello world',words:[{text:'hello',startMs:12500},{text:'world',startMs:12500}]}]`
  - `parses enhanced word tags`: `"[00:01.00]<00:01.00>a <00:01.40>b"` → words `[{a,1000},{b,1400}]`, text `'a b'`
  - `multiple timestamps on one line produce one line each`: `"[00:01.00][00:05.00]x"` → two lines at 1000 and 5000
  - `ignores metadata tags and empty text`: `"[ar:x]\n[00:02.00]\n[00:03.00]y"` → one line at 3000
  - `sorts by time`
- [ ] **Step 3:** Run `npm test -- lrc` → FAIL (module missing).
- [ ] **Step 4:** Implement `parseLrc`. Without word tags, every word gets the line's `startMs` (Task 3 spreads them).
- [ ] **Step 5:** Run `npm test -- lrc` → PASS.
- [ ] **Step 6:** `git commit -m "feat: scaffold app and LRC parser"`

### Task 2: Wallpaper-layer window spike (risk first)

Throwaway proof that a transparent window can live on the wallpaper layer on Ahmad's machines. Manual verification; no unit tests.

**Files:**
- Create: `src/main/windows/desktopLayer.ts`, `scripts/spike-desktop.ts`

**Interfaces:**
- Produces: `attachToDesktop(win: BrowserWindow): Promise<boolean>` — `true` if attached.

- [ ] **Step 1:** Windows path with koffi: `FindWindowW("Progman")`, `SendMessageTimeoutW(progman, 0x052C, 0xD, 0x1, SMTO_NORMAL, 1000)` then `0x052C, 0, 0`. Find the target: first try a `WorkerW` that is a **child of Progman** (24H2+ layout); else enumerate top-level `WorkerW` windows, find the one containing `SHELLDLL_DefView`, and take the **next** `WorkerW` sibling. `SetParent(hwnd, target)`. Window created with `transparent:true, frame:false, focusable:false, skipTaskbar:true` and `setIgnoreMouseEvents(true)`.
- [ ] **Step 2:** macOS path: create the window with `type: 'desktop'`, `transparent:true, frame:false`, then `setVisibleOnAllWorkspaces(true)`, `setIgnoreMouseEvents(true)`.
- [ ] **Step 3:** `scripts/spike-desktop.ts` opens a window showing large red text "SPIKE".
- [ ] **Step 4: Verify on Windows 11:** text visible over the wallpaper, under desktop icons or with them, covered by any app window, survives Win+D. Record Windows build (`winver`) in the commit message.
- [ ] **Step 5: Verify on the MacBook:** text above wallpaper, below all apps, on every Space.
- [ ] **Step 6:** If Windows attach fails, stop and report to Ahmad before Task 6. Else `git commit -m "spike: wallpaper layer works on <build>"`

### Task 3: Playback clock + current line

**Files:**
- Create: `src/main/playback/clock.ts`
- Test: `tests/main/playback/clock.test.ts`

**Interfaces:**
- Consumes: `NowPlaying`, `LyricLine` (Task 1)
- Produces:
  - `class PlaybackClock { update(np: NowPlaying, atMs: number): void; positionAt(nowMs: number): number }`
  - `currentLineIndex(lines: LyricLine[], positionMs: number): number` — `-1` before the first line.
  - `spreadWords(line: LyricLine, nextStartMs: number): LyricWord[]` — if all words share `startMs`, space them evenly between `line.startMs` and `nextStartMs` weighted by character count; otherwise return words unchanged.

- [ ] **Step 1: Write failing tests:**
  - `interpolates while playing`: update `{positionMs:10000, playing:true}` at t=0 → `positionAt(500) === 10500`
  - `freezes while paused`: `{positionMs:10000, playing:false}` → `positionAt(5000) === 10000`
  - `seek resets`: update 10000 at t=0, update 60000 at t=1000 → `positionAt(1200) === 60200`
  - `clamps to duration`
  - `currentLineIndex`: lines at 1000/5000/9000 → pos 500 → -1, 5000 → 1, 99999 → 2
  - `spreadWords`: line at 0 `"ab cd"`, next 1000 → starts `[0, 500]`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. `currentLineIndex` uses binary search.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `git commit -m "feat: playback clock and line lookup"`

### Task 4: LRCLIB client + cache

**Files:**
- Create: `src/main/lyrics/lrclib.ts`, `src/main/lyrics/cache.ts`
- Test: `tests/main/lyrics/lrclib.test.ts`

**Interfaces:**
- Consumes: `parseLrc`, `Lyrics`, `NowPlaying`
- Produces:
  - `class LyricsCache { constructor(dir: string); get(key: string): Lyrics | null | undefined; set(key: string, value: Lyrics | null): void }` — `undefined` = not cached, `null` = cached miss.
  - `cacheKey(np: NowPlaying): string` — lowercased `artist|title|round(durationMs/1000)`.
  - `fetchLyrics(np: NowPlaying, deps: { fetch: typeof fetch; cache: LyricsCache }): Promise<Lyrics | null>`

- [ ] **Step 1: Write failing tests** (fake `fetch`, temp dir cache):
  - `uses /api/get with track_name, artist_name, album_name, duration (seconds)` and parses `syncedLyrics`
  - `falls back to /api/search?track_name&artist_name` when get is 404; picks the first result with `syncedLyrics` and `|duration - np| <= 3s`
  - `returns null when only plainLyrics exist` (Review Focus 1)
  - `caches hits and misses`: second call makes zero fetches, including after a null result
  - `network error returns null and does not cache` (so it retries next song change)
  - sets header `User-Agent: LyricsOverlay/0.1 (https://github.com/ad26u)`
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Cache = one JSON file per sha1(key) in `userData/lyrics-cache`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** `git commit -m "feat: LRCLIB client with disk cache"`

### Task 5: Settings store

**Files:**
- Create: `src/main/settings.ts`
- Test: `tests/main/settings.test.ts`

**Interfaces:**
- Produces:
  - `loadSettings(file: string): AppSettings` — defaults `{enabled:true, style:'stars', circleSide:'left', openAtLogin:false}`; corrupt file → defaults.
  - `saveSettings(file: string, s: AppSettings): void` — atomic write (tmp + rename).
  - `clampBounds(b: Bounds, displays: { id: number; workArea: Rect }[]): Bounds` — if the bounds' display is gone or bounds are <50% visible, move to the primary display's work area, keeping size (shrunk to fit).

- [ ] **Step 1: Write failing tests:** defaults on missing file; defaults on corrupt JSON; round-trip; `clampBounds` with removed display moves onto `displays[0]` (Review Focus 5); bounds larger than work area are shrunk.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** `git commit -m "feat: settings store"`

### Task 6: Now-playing sources

**Files:**
- Create: `src/main/nowplaying/mac.ts`, `src/main/nowplaying/windows.ts`, `src/main/nowplaying/index.ts`, `helpers/win-media/Program.cs`, `helpers/win-media/win-media.csproj`
- Test: `tests/main/nowplaying/mac.test.ts`, `tests/main/nowplaying/windows.test.ts`

**Interfaces:**
- Produces:
  - `interface NowPlayingSource { read(): Promise<NowPlaying | null>; dispose(): void }`
  - `createNowPlayingSource(): NowPlayingSource` — picks by `process.platform`.
  - `parseMacOutput(raw: string, source: 'spotify'|'music'): NowPlaying | null`
  - `parseHelperLine(line: string): NowPlaying | null`

- [ ] **Step 1: Write failing parser tests:**
  - mac: the script prints fields joined by `\u001f`: `state, title, artist, album, durationMs, positionSec, artworkUrl`. Spotify `duration` is ms, Music `duration` is seconds — the script normalizes to ms. `"playing\u001fT\u001fA\u001fAl\u001f200000\u001f12.5\u001fhttps://x"` → `{positionMs:12500, playing:true, durationMs:200000, coverUrl:'https://x'}`; `"stopped"` → `null`; empty → `null`.
  - windows: helper emits one JSON object per line: `{"title","artist","album","durationMs","positionMs","playing","thumbnailBase64"}` or `{"none":true}`. Map thumbnail to `coverDataUrl` (`data:image/png;base64,...`). Malformed line → `null`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** mac: `read()` runs `osascript -e` first against Spotify, then Music, **only if** the app is running (`application "Spotify" is running`) so it never launches them. Return the first that is playing, else the first paused, else `null`.
- [ ] **Step 4:** windows helper (.NET 8, `net8.0-windows10.0.19041.0`): every 1000 ms read `GlobalSystemMediaTransportControlsSessionManager.GetCurrentSession()`; prefer a session whose `SourceAppUserModelId` contains `Spotify`; write one JSON line; flush. Position = `TimelineProperties.Position` + (now − `LastUpdatedTime`) if playing. `windows.ts` spawns the published exe from `resources/`, keeps the last parsed value, restarts the helper if it exits.
- [ ] **Step 5:** Run tests → PASS. Manual: play a song in Spotify on each OS, log `read()` once a second, position tracks within ~1 s.
- [ ] **Step 6:** `git commit -m "feat: now-playing sources for mac and windows"`

### Task 7: Lyrics renderer + three styles

**Files:**
- Create: `src/preload/index.ts`, `src/renderer/lyrics/index.html`, `main.ts`, `text.ts`, `colors.ts`, `styles/types.ts`, `styles/stars.ts`, `styles/big.ts`, `styles/simple.ts`
- Test: `tests/renderer/text.test.ts`, `tests/renderer/colors.test.ts`

**Interfaces:**
- Consumes: `OverlayState`, `spreadWords` (Task 3) — main sends lines already spread.
- Produces:
  - preload `window.overlay = { onState(cb: (s: OverlayState) => void), onStyle(cb: (style: AppSettings['style']) => void), onEditMode(cb: (on: boolean) => void), finishEdit(): void }`
  - `interface LyricStyle { mount(root: HTMLElement): void; setLyrics(l: Lyrics, palette: Palette): void; frame(positionMs: number, lineIndex: number): void; unmount(): void }`
  - `type Palette = { primary: string; accent: string; glow: string }`
  - `isRtl(text: string): boolean` — true if first strong char is Arabic/Hebrew.
  - `splitWords(text: string): string[]`
  - `paletteFromImage(pixels: Uint8ClampedArray): Palette` — most saturated dominant hue; fallback `{primary:'#ffffff', accent:'#ffb347', glow:'#ff8c1a'}`.

- [ ] **Step 1: Write failing tests:** `isRtl('مرحبا hello') === true`, `isRtl('hello مرحبا') === false`; `splitWords` keeps Arabic words intact and drops empty strings; `paletteFromImage` of an all-red buffer gives a red `accent`; of all-grey gives the fallback.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement helpers. **Step 4:** Run → PASS.
- [ ] **Step 5:** Styles (visual, verified manually against the two reference reels):
  - **stars:** each word of the current line is a small 4-point star with its label, placed along a zig-zag, joined by thin lines in `accent`; the active word scales up and glows; past lines fade out over 600 ms. Lines whose `isRtl` is true lay words out right-to-left (Review Focus 3).
  - **big:** one heavy condensed sans line (e.g. Anton/Bebas via bundled font), words slide in one by one at their `startMs`; `dir` set from `isRtl`.
  - **simple:** single centered line, active word in `accent`, others white at 70% opacity.
- [ ] **Step 6:** `main.ts` runs `requestAnimationFrame` only while state has a playing song; stops the loop otherwise. Edit mode shows a dashed border and a "تم" button that calls `finishEdit()`.
- [ ] **Step 7:** Manual: dev harness page that feeds a fixed LRC and fake clock; check all three styles with an English and an Arabic song.
- [ ] **Step 8:** `git commit -m "feat: lyrics renderer with stars, big and simple styles"`

### Task 8: Lyrics window + edit mode

**Files:**
- Create: `src/main/windows/lyricsWindow.ts`

**Interfaces:**
- Consumes: `attachToDesktop` (Task 2), `loadSettings/saveSettings/clampBounds` (Task 5)
- Produces: `class LyricsWindow { constructor(settings: AppSettings); show(): void; hide(): void; send(state: OverlayState): void; setStyle(s: AppSettings['style']): void; enterEditMode(): Promise<Bounds> }`

- [ ] **Step 1:** Create window with saved bounds (clamped) or default: 60% width, centered horizontally, at 35% of primary work-area height. Attach to desktop. `show/hide` fade via renderer CSS opacity, then `win.hide()` after 400 ms.
- [ ] **Step 2:** `enterEditMode()`: on Windows `SetParent(hwnd, 0)`; on mac `setAlwaysOnTop(true,'floating')`; `setIgnoreMouseEvents(false)`, `setResizable(true)`, `setMovable(true)`, send `onEditMode(true)`. On `finishEdit`: save bounds, re-attach to desktop, ignore mouse again. Resolve with the new bounds.
- [ ] **Step 3:** Manual on both OSes: move + resize, restart the app, position persists; unplug external monitor, restart, window lands on the laptop screen.
- [ ] **Step 4:** `git commit -m "feat: lyrics window on wallpaper layer with edit mode"`

### Task 9: Side circle window

**Files:**
- Create: `src/main/windows/sideCircleWindow.ts`, `src/renderer/circle/index.html`, `main.ts`, `circle.css`

**Interfaces:**
- Consumes: `OverlayState`
- Produces: `class SideCircleWindow { constructor(side: 'left'|'right'); show(): void; hide(): void; send(state: OverlayState): void; setSide(side: 'left'|'right'): void }`; preload adds `window.overlay.setHover(on: boolean)`.

- [ ] **Step 1:** Window 420×360, transparent, frameless, `alwaysOnTop('screen-saver')` on mac / `alwaysOnTop(true)` on Windows, `skipTaskbar`, `focusable:false`, vertically centered on the primary display, x so only half of a 96 px circle is on-screen.
- [ ] **Step 2:** Click-through except the circle: `setIgnoreMouseEvents(true, {forward:true})`; renderer toggles via `setHover` on `mouseenter`/`mouseleave` of the circle and the open panel.
- [ ] **Step 3:** Renderer: collapsed = half circle with spinning cover (slow, 20 s/turn while playing). Hover → circle slides fully in (250 ms ease-out) and a list fans out: current song bold, then up to 4 queue items with small round covers. Empty queue → show only current song. Leave → collapse after 300 ms.
- [ ] **Step 4:** Manual: hover works over a fullscreen-windowed game and a browser; clicks elsewhere pass through.
- [ ] **Step 5:** `git commit -m "feat: side circle with hover queue"`

### Task 10: Orchestrator + tray

**Files:**
- Create: `src/main/orchestrator.ts`, `src/main/tray.ts`, `src/main/main.ts`
- Test: `tests/main/orchestrator.test.ts`

**Interfaces:**
- Consumes: everything above; `getQueue` from Task 11 is optional (`() => Promise<OverlayState['queue']>`, default returns `[]`).
- Produces: `class Orchestrator { constructor(deps: { source: NowPlayingSource; fetchLyrics: (np: NowPlaying) => Promise<Lyrics|null>; getQueue: () => Promise<OverlayState['queue']>; lyrics: Pick<LyricsWindow,'show'|'hide'|'send'>; circle: Pick<SideCircleWindow,'show'|'hide'|'send'>; now: () => number; setTimer: (fn: () => void, ms: number) => unknown }); start(): void; stop(): void; setEnabled(on: boolean): void }`

- [ ] **Step 1: Write failing tests** (fakes for all deps):
  - `idle polls every 2000 ms and keeps windows hidden`
  - `playing polls every 1000 ms`
  - `song change fetches lyrics once`; same song next tick → no refetch
  - `no lyrics → circle shown, lyrics window hidden` (Review Focus 1)
  - `source returns null after playing → both hide on that tick` (Review Focus 4)
  - `paused keeps windows shown with frozen line`
  - `setEnabled(false) hides both and stops sending`
  - `queue refreshed on song change and every 15 s while playing`
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. Broadcast `OverlayState` to windows every poll; renderers interpolate between. **Step 4:** Run → PASS.
- [ ] **Step 5:** `tray.ts` menu (Arabic labels): تشغيل/إيقاف الكلمات، الستايل ▸ (نجوم، كلمات كبيرة، بسيط)، تعديل مكان الكلمات، جهة الدائرة ▸ (يسار، يمين)، ربط Spotify / فصل Spotify، التشغيل مع بداية الجهاز (`app.setLoginItemSettings`)، خروج. mac: `app.dock.hide()`.
- [ ] **Step 6:** `main.ts`: single-instance lock, load settings, build windows, start orchestrator.
- [ ] **Step 7:** Manual: Task Manager / Activity Monitor shows ~0% CPU with Spotify closed for 1 minute.
- [ ] **Step 8:** `git commit -m "feat: orchestrator and tray"`

### Task 11: Optional Spotify queue

**Files:**
- Create: `src/main/spotify/auth.ts`, `src/main/spotify/queue.ts`
- Test: `tests/main/spotify/auth.test.ts`, `tests/main/spotify/queue.test.ts`

**Interfaces:**
- Produces:
  - `pkcePair(): { verifier: string; challenge: string }` — verifier 64 chars, challenge = base64url(sha256(verifier)).
  - `login(clientId: string): Promise<string /* refreshToken */>` — opens browser to `https://accounts.spotify.com/authorize` with scopes `user-read-playback-state user-read-currently-playing`, redirect `http://127.0.0.1:43821/callback`, local http server catches the code, exchanges at `https://accounts.spotify.com/api/token`.
  - `class SpotifyClient { constructor(clientId: string, refreshToken: string, fetch: typeof fetch); queue(): Promise<OverlayState['queue']> }`
- Client ID comes from `SPOTIFY_CLIENT_ID` in a build-time `.env` (Ahmad creates the app in the Spotify dashboard and adds that redirect URI).

- [ ] **Step 1: Write failing tests:** challenge matches a known RFC 7636 vector; `queue()` maps `queue[].name/artists[0].name/album.images[last].url` and returns max 4; 401 → refreshes once then retries; refresh failure → returns `[]` and does not throw; token response with a new `refresh_token` is persisted via a callback.
- [ ] **Step 2:** Run → FAIL. **Step 3:** Implement. **Step 4:** Run → PASS.
- [ ] **Step 5:** Wire into tray + orchestrator `getQueue`. Manual: login, queue appears in the circle; logout clears it.
- [ ] **Step 6:** `git commit -m "feat: optional Spotify queue"`

### Task 12: Packaging

**Files:**
- Create: `electron-builder.yml`, `scripts/build-helper.ps1`

- [ ] **Step 1:** `build-helper.ps1` publishes `helpers/win-media` self-contained single-file to `resources/win-media.exe`; electron-builder `extraResources` includes it on Windows only.
- [ ] **Step 2:** Targets: Windows NSIS (x64), macOS dmg (arm64). mac `Info.plist` gets `NSAppleEventsUsageDescription: "يقرأ الأغنية الحالية من Spotify و Music لعرض الكلمات."`
- [ ] **Step 3:** Verify: fresh install on each OS, first song shows lyrics; mac shows the Automation permission prompt once.
- [ ] **Step 4:** `git commit -m "build: installers for windows and mac"`
