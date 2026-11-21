import { BrowserWindow, ipcMain, screen } from 'electron';
import type { AppSettings, Bounds, OverlayState, StyleName } from '../../shared/types.ts';
import { clampBounds } from '../settings.ts';
import { attachToDesktop, desktopWindowOptions, detachFromDesktop, placeOnDesktop } from './desktopLayer.ts';
import { PRELOAD, loadPage } from './pages.ts';

function defaultBounds(): Bounds {
  const d = screen.getPrimaryDisplay();
  const wa = d.workArea;
  const width = Math.round(wa.width * 0.6);
  const height = Math.round(wa.height * 0.3);
  return { x: wa.x + Math.round((wa.width - width) / 2), y: wa.y + Math.round(wa.height * 0.35 - height / 2), width, height, displayId: d.id };
}

export class LyricsWindow {
  private win: BrowserWindow;
  private ready: Promise<void>;
  private visible = false;
  private hideTimer: NodeJS.Timeout | null = null;
  private editing = false;

  constructor(settings: AppSettings) {
    const displays = screen.getAllDisplays().map((d) => ({ id: d.id, workArea: d.workArea }));
    const b = settings.lyricsBounds ? clampBounds(settings.lyricsBounds, displays) : defaultBounds();
    this.win = new BrowserWindow({
      ...desktopWindowOptions(),
      x: b.x, y: b.y, width: b.width, height: b.height,
      webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true, backgroundThrottling: true },
    });
    this.ready = loadPage(this.win, 'lyrics').then(async () => {
      this.win.webContents.send('overlay:style', settings.style);
      this.win.showInactive();
      await attachToDesktop(this.win);
      placeOnDesktop(this.win, b);
      this.win.setOpacity(0);
      this.win.hide();
    });
  }

  show(): void {
    if (this.visible || this.editing) return;
    this.visible = true;
    if (this.hideTimer) clearTimeout(this.hideTimer);
    void this.ready.then(() => {
      this.win.showInactive();
      this.fade(1);
    });
  }

  hide(): void {
    if (!this.visible || this.editing) return;
    this.visible = false;
    this.fade(0);
    this.hideTimer = setTimeout(() => this.win.hide(), 400);
  }

  private fade(to: number) {
    const from = this.win.getOpacity();
    const steps = 8;
    for (let i = 1; i <= steps; i++) setTimeout(() => this.win.setOpacity(from + ((to - from) * i) / steps), (400 / steps) * i);
  }

  send(state: OverlayState): void {
    if (!this.win.isDestroyed()) this.win.webContents.send('overlay:state', state);
  }

  setStyle(s: StyleName): void {
    void this.ready.then(() => this.win.webContents.send('overlay:style', s));
  }

  /** Lifts the window off the desktop so the user can move/resize it. Resolves with the new bounds. */
  async enterEditMode(): Promise<Bounds> {
    await this.ready;
    this.editing = true;
    detachFromDesktop(this.win);
    this.win.setResizable(true);
    this.win.setMovable(true);
    this.win.setFocusable(true);
    this.win.setOpacity(1);
    this.win.show();
    this.win.focus();
    this.win.webContents.send('overlay:edit', true);

    const onResize = (e: Electron.IpcMainEvent, factor: number) => {
      if (e.sender !== this.win.webContents || !(factor > 0.5 && factor < 2)) return;
      const r = this.win.getBounds();
      const width = Math.max(240, Math.round(r.width * factor));
      const height = Math.max(80, Math.round(r.height * factor));
      this.win.setBounds({ x: r.x + Math.round((r.width - width) / 2), y: r.y + Math.round((r.height - height) / 2), width, height });
    };
    ipcMain.on('overlay:resize', onResize);
    await new Promise<void>((resolve) => ipcMain.once('overlay:finish-edit', () => resolve()));
    ipcMain.off('overlay:resize', onResize);

    const r = this.win.getBounds();
    const bounds: Bounds = { ...r, displayId: screen.getDisplayMatching(r).id };
    this.win.webContents.send('overlay:edit', false);
    this.win.setResizable(false);
    this.win.setFocusable(false);
    await attachToDesktop(this.win);
    placeOnDesktop(this.win, r);
    this.editing = false;
    if (!this.visible) {
      this.win.setOpacity(0);
      this.win.hide();
    }
    return bounds;
  }

  destroy(): void {
    this.win.destroy();
  }
}
