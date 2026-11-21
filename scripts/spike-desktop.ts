// Throwaway: run with `npx electron-vite dev --entry scripts/spike-desktop.ts`
// or build and `npx electron out/spike.js`. Shows big red SPIKE on the wallpaper.
import { app, BrowserWindow, screen } from 'electron';
import { attachToDesktop, desktopWindowOptions } from '../src/main/windows/desktopLayer.ts';

app.whenReady().then(async () => {
  const { workArea } = screen.getPrimaryDisplay();
  const win = new BrowserWindow({ ...desktopWindowOptions(), x: workArea.x + 100, y: workArea.y + 200, width: 900, height: 300 });
  await win.loadURL('data:text/html,<body style="margin:0;background:transparent;color:red;font:bold 160px sans-serif">SPIKE</body>');
  win.showInactive();
  const ok = await attachToDesktop(win);
  console.log('attached:', ok, 'platform:', process.platform, 'os:', process.getSystemVersion());
});
