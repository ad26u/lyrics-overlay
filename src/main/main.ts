import { app, screen } from 'electron';
import { join } from 'node:path';
import type { AppSettings, QueueItem } from '../shared/types.ts';
import { loadSettings, saveSettings } from './settings.ts';
import { LyricsCache } from './lyrics/cache.ts';
import { fetchLyrics } from './lyrics/lrclib.ts';
import { createNowPlayingSource } from './nowplaying/index.ts';
import { LyricsWindow } from './windows/lyricsWindow.ts';
import { SideCircleWindow } from './windows/sideCircleWindow.ts';
import { Orchestrator } from './orchestrator.ts';
import { AppTray } from './tray.ts';
import { createSpotifyQueue } from './spotify/wire.ts';

if (!app.requestSingleInstanceLock()) app.quit();

// LYRICS_SPIKE=1 npm run dev  → only runs the wallpaper-layer spike (plan Task 2).
const SPIKE = !!process.env.LYRICS_SPIKE;
if (SPIKE) void import('../../scripts/spike-desktop.ts');

const resources = app.isPackaged ? process.resourcesPath : join(app.getAppPath(), 'resources');

app.whenReady().then(async () => {
  if (SPIKE) return;
  if (process.platform === 'darwin') app.dock?.hide();

  const settingsFile = join(app.getPath('userData'), 'settings.json');
  let settings: AppSettings = loadSettings(settingsFile);
  const save = (patch: Partial<AppSettings>) => {
    settings = { ...settings, ...patch };
    saveSettings(settingsFile, settings);
    tray.refresh();
  };

  const cache = new LyricsCache(join(app.getPath('userData'), 'lyrics-cache'));
  const source = await createNowPlayingSource(join(resources, 'win-media.exe'));
  const lyricsWin = new LyricsWindow(settings);
  const circle = new SideCircleWindow(settings.circleSide);
  const spotify = createSpotifyQueue(() => settings.spotify?.refreshToken, (refreshToken) =>
    save({ spotify: refreshToken ? { refreshToken } : undefined }),
  );

  const orch = new Orchestrator({
    source,
    fetchLyrics: (np) => fetchLyrics(np, { fetch, cache }),
    getQueue: (): Promise<QueueItem[]> => spotify.queue(),
    lyrics: lyricsWin,
    circle,
    now: () => Date.now(),
    setTimer: (fn, ms) => setTimeout(fn, ms),
  });

  const tray = new AppTray(join(resources, 'tray.png'), () => settings, {
    toggleEnabled: (on) => { save({ enabled: on }); orch.setEnabled(on); },
    setStyle: (style) => { save({ style }); lyricsWin.setStyle(style); },
    editPosition: async () => save({ lyricsBounds: await lyricsWin.enterEditMode() }),
    setSide: (circleSide) => { save({ circleSide }); circle.setSide(circleSide); },
    spotifyLogin: () => void spotify.login(),
    spotifyLogout: () => save({ spotify: undefined }),
    setOpenAtLogin: (on) => { save({ openAtLogin: on }); app.setLoginItemSettings({ openAtLogin: on }); },
  });

  orch.setEnabled(settings.enabled);
  orch.start();

  screen.on('display-removed', () => { app.relaunch(); app.exit(0); }); // simplest way to re-clamp windows
  app.on('window-all-closed', () => { /* stay in tray */ });
  app.on('before-quit', () => { orch.stop(); source.dispose(); });
});
