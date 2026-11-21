import { Menu, Tray, nativeImage, app } from 'electron';
import type { AppSettings, StyleName } from '../shared/types.ts';

export type TrayActions = {
  toggleEnabled(on: boolean): void;
  setStyle(s: StyleName): void;
  editPosition(): void;
  setSide(side: 'left' | 'right'): void;
  spotifyLogin(): void;
  spotifyLogout(): void;
  setOpenAtLogin(on: boolean): void;
};

const STYLE_LABELS: Record<StyleName, string> = { stars: 'نجوم', big: 'كلمات كبيرة', simple: 'بسيط' };

export class AppTray {
  private tray: Tray;

  constructor(iconPath: string, private getSettings: () => AppSettings, private a: TrayActions) {
    const icon = nativeImage.createFromPath(iconPath);
    if (process.platform === 'darwin') icon.setTemplateImage(true);
    this.tray = new Tray(icon);
    this.tray.setToolTip('Lyrics Overlay');
    this.refresh();
  }

  refresh(): void {
    const s = this.getSettings();
    const menu = Menu.buildFromTemplate([
      { label: 'تشغيل الكلمات', type: 'checkbox', checked: s.enabled, click: (i) => this.a.toggleEnabled(i.checked) },
      {
        label: 'الستايل',
        submenu: (Object.keys(STYLE_LABELS) as StyleName[]).map((k) => ({
          label: STYLE_LABELS[k], type: 'radio' as const, checked: s.style === k, click: () => this.a.setStyle(k),
        })),
      },
      { label: 'تعديل مكان الكلمات', click: () => this.a.editPosition() },
      {
        label: 'جهة الدائرة',
        submenu: [
          { label: 'يسار', type: 'radio', checked: s.circleSide === 'left', click: () => this.a.setSide('left') },
          { label: 'يمين', type: 'radio', checked: s.circleSide === 'right', click: () => this.a.setSide('right') },
        ],
      },
      { type: 'separator' },
      s.spotify
        ? { label: 'فصل Spotify', click: () => this.a.spotifyLogout() }
        : { label: 'ربط Spotify (للأغاني الجاية)', click: () => this.a.spotifyLogin() },
      { label: 'التشغيل مع بداية الجهاز', type: 'checkbox', checked: s.openAtLogin, click: (i) => this.a.setOpenAtLogin(i.checked) },
      { type: 'separator' },
      { label: 'خروج', click: () => app.quit() },
    ]);
    this.tray.setContextMenu(menu);
  }
}
