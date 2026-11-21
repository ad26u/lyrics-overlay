import { BrowserWindow, ipcMain, screen } from 'electron';
import type { OverlayState } from '../../shared/types.ts';
import { PRELOAD, loadPage } from './pages.ts';

const W = 420, H = 360;

export class SideCircleWindow {
  private win: BrowserWindow;
  private ready: Promise<void>;
  private visible = false;

  constructor(private side: 'left' | 'right') {
    this.win = new BrowserWindow({
      width: W, height: H, show: false, transparent: true, frame: false, resizable: false, movable: false,
      focusable: false, skipTaskbar: true, hasShadow: false, backgroundColor: '#00000000',
      webPreferences: { preload: PRELOAD, sandbox: true, contextIsolation: true },
    });
    if (process.platform === 'darwin') {
      this.win.setAlwaysOnTop(true, 'screen-saver');
      this.win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
    } else {
      this.win.setAlwaysOnTop(true);
    }
    this.win.setIgnoreMouseEvents(true, { forward: true });
    this.place();
    ipcMain.on('overlay:hover', (e, hover: boolean) => {
      if (e.sender !== this.win.webContents) return;
      this.win.setIgnoreMouseEvents(!hover, { forward: true });
    });
    screen.on('display-metrics-changed', () => this.place());
    screen.on('display-removed', () => this.place());
    this.ready = loadPage(this.win, 'circle').then(() => this.win.webContents.send('overlay:side', this.side));
  }

  /** Window sits flush with the screen edge; the page pushes half the disc off-screen. */
  private place() {
    const wa = screen.getPrimaryDisplay().workArea;
    const x = this.side === 'left' ? wa.x : wa.x + wa.width - W;
    this.win.setBounds({ x, y: Math.round(wa.y + (wa.height - H) / 2), width: W, height: H });
  }

  setSide(side: 'left' | 'right'): void {
    this.side = side;
    this.place();
    void this.ready.then(() => this.win.webContents.send('overlay:side', side));
  }

  show(): void {
    if (this.visible) return;
    this.visible = true;
    void this.ready.then(() => this.win.showInactive());
  }

  hide(): void {
    if (!this.visible) return;
    this.visible = false;
    this.win.hide();
  }

  send(state: OverlayState): void {
    if (!this.win.isDestroyed()) this.win.webContents.send('overlay:state', state);
  }

  destroy(): void {
    this.win.destroy();
  }
}
